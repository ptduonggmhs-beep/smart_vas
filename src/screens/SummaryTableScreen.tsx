import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
  StatusBar,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Patient, Assessment, TimepointConfigItem, AppUser } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { StorageService } from '../services/storageService';
import { DEFAULT_CLINICAL_TIMEPOINTS } from '../config/timepointConfig';
import {
  ExcelExportService,
  PreparedExcelFile,
  formatSmartVasExportFilename,
} from '../utils/excelExport';

interface SummaryTableScreenProps {
  onBack: () => void;
  currentUser?: AppUser | null;
  onSelectPatient?: (patient: Patient) => void;
}

export const SummaryTableScreen: React.FC<SummaryTableScreenProps> = ({
  onBack,
  currentUser,
  onSelectPatient,
}) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [timepoints, setTimepoints] = useState<TimepointConfigItem[]>(DEFAULT_CLINICAL_TIMEPOINTS);
  const [loading, setLoading] = useState<boolean>(true);

  // Bộ lọc
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'complete' | 'missing'>('all');
  const [sortBy, setSortBy] = useState<'msba' | 'order'>('msba');

  // Modal Xuất Excel & Chia sẻ Zalo / Tệp (2 bước chuẩn iOS)
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [exportScope, setExportScope] = useState<'all' | 'filtered' | 'selected'>('all');
  const [exportIncludeNames, setExportIncludeNames] = useState<boolean>(false);
  const [preparedFile, setPreparedFile] = useState<PreparedExcelFile | null>(null);
  const [exportStatus, setExportStatus] = useState<
    'idle' | 'generating' | 'ready' | 'sharing' | 'shared' | 'cancelled' | 'unsupported' | 'error'
  >('idle');
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Chế độ Chọn bệnh nhân để xuất (Phần 4.3)
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false);
  const [selectedPatientIds, setSelectedPatientIds] = useState<Set<string>>(new Set());

  // Chọn hoặc bỏ chọn một bệnh nhân
  const toggleSelectPatient = (studyId: string) => {
    setSelectedPatientIds((prev) => {
      const next = new Set(prev);
      if (next.has(studyId)) {
        next.delete(studyId);
      } else {
        next.add(studyId);
      }
      return next;
    });
  };

  // Chọn tất cả bệnh nhân đang hiển thị theo bộ lọc
  const handleSelectAllVisible = () => {
    setSelectedPatientIds((prev) => {
      const next = new Set(prev);
      filteredPatients.forEach((p) => next.add(p.study_id));
      return next;
    });
  };

  // Bỏ chọn các bệnh nhân đang hiển thị theo bộ lọc
  const handleDeselectVisible = () => {
    setSelectedPatientIds((prev) => {
      const next = new Set(prev);
      filteredPatients.forEach((p) => next.delete(p.study_id));
      return next;
    });
  };

  // Bỏ chọn tất cả bệnh nhân
  const handleDeselectAll = () => {
    setSelectedPatientIds(new Set());
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [patientList, assessmentList, doctorTps] = await Promise.all([
        FirebaseService.getAllPatients(currentUser),
        FirebaseService.getAllAssessments(),
        StorageService.getDoctorCustomTimepoints(),
      ]);

      setPatients(patientList);
      setAssessments(assessmentList);
      if (doctorTps && doctorTps.length > 0) {
        setTimepoints(doctorTps);
      }
    } catch (e) {
      console.error('Lỗi tải dữ liệu bảng tổng hợp:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Nhóm đánh giá theo từng bệnh nhân và mốc T
  const assessmentsByPatient = useMemo(() => {
    const map: Record<string, Record<string, Assessment[]>> = {};

    assessments.forEach((a) => {
      const pKey = (a.patient_code || a.study_id).trim().toUpperCase();
      if (!map[pKey]) map[pKey] = {};

      const rawTp = (a.selected_timepoint || a.planned_timepoint || a.assessment_timepoint || a.timepoint_label || '').trim();
      const normTp = rawTp.replace('h', '').toUpperCase();

      if (!map[pKey][normTp]) {
        map[pKey][normTp] = [];
      }
      map[pKey][normTp].push(a);
    });

    // Sắp xếp các lần đánh giá theo thời gian thực tế mới nhất trước
    Object.keys(map).forEach((pKey) => {
      Object.keys(map[pKey]).forEach((tpKey) => {
        map[pKey][tpKey].sort(
          (a, b) =>
            new Date(b.actual_timestamp || b.submit_timestamp).getTime() -
            new Date(a.actual_timestamp || a.submit_timestamp).getTime()
        );
      });
    });

    return map;
  }, [assessments]);

  // Danh sách bệnh nhân sau khi áp dụng tìm kiếm, lọc và sắp xếp
  const filteredPatients = useMemo(() => {
    let result = [...patients];

    // 1. Tìm kiếm theo MSBA hoặc tên
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((p) => {
        const msba = (p.medical_record_number || p.study_id).toLowerCase();
        const name = (p.patient_name || '').toLowerCase();
        return msba.includes(q) || name.includes(q);
      });
    }

    // 2. Lọc theo trạng thái đủ/thiếu mốc
    if (statusFilter === 'complete' || statusFilter === 'missing') {
      const isComplete = (patient: Patient) => {
        const msba = (patient.medical_record_number || patient.study_id).trim().toUpperCase();
        const patientMap = assessmentsByPatient[msba] || {};
        return timepoints.every((tp) => {
          const normTp = tp.key.replace('h', '').toUpperCase();
          return (patientMap[normTp] || []).length > 0;
        });
      };

      if (statusFilter === 'complete') {
        result = result.filter(isComplete);
      } else {
        result = result.filter((p) => !isComplete(p));
      }
    }

    // 3. Sắp xếp
    if (sortBy === 'msba') {
      result.sort((a, b) => {
        const aCode = a.medical_record_number || a.study_id;
        const bCode = b.medical_record_number || b.study_id;
        return aCode.localeCompare(bCode, undefined, { numeric: true });
      });
    }

    return result;
  }, [patients, searchQuery, statusFilter, sortBy, assessmentsByPatient, timepoints]);

  // Định dạng ngày giờ hiển thị ngắn gọn trong ô bảng
  const formatTableDateTime = (isoString?: string | null) => {
    if (!isoString) return '—';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '—';
    const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    return `${time} ${date}`;
  };

  // Xác định tập bệnh nhân và đánh giá dự kiến xuất theo phạm vi (Phần 4.4)
  const targetExportPatients = useMemo(() => {
    if (exportScope === 'selected') {
      return patients.filter((p) => selectedPatientIds.has(p.study_id));
    }
    if (exportScope === 'filtered') {
      return filteredPatients;
    }
    return patients;
  }, [exportScope, patients, filteredPatients, selectedPatientIds]);

  const targetExportAssessments = useMemo(() => {
    const targetMsbaSet = new Set(
      targetExportPatients.map((p) => (p.medical_record_number || p.study_id).trim().toUpperCase())
    );
    return assessments.filter((a) =>
      targetMsbaSet.has((a.patient_code || a.study_id).trim().toUpperCase())
    );
  }, [targetExportPatients, assessments]);

  const expectedFilename = useMemo(() => {
    return isExportModalOpen ? formatSmartVasExportFilename() : formatSmartVasExportFilename();
  }, [isExportModalOpen]);

  // Kiểm tra cảnh báo dữ liệu trước khi xuất (Section VIII.4)
  const validation = useMemo(() => {
    return ExcelExportService.validateDataBeforeExport(patients, assessments, timepoints);
  }, [patients, assessments, timepoints]);

  // Bước 1: Tạo file Excel thật (.xlsx)
  const handlePrepareExport = async () => {
    if (exportScope === 'selected' && selectedPatientIds.size === 0) {
      Alert.alert('Chưa chọn bệnh nhân', 'Vui lòng chọn ít nhất một bệnh nhân trước khi xuất.');
      return;
    }

    if (targetExportPatients.length === 0) {
      Alert.alert('Không có dữ liệu', 'Không có bệnh nhân nào trong phạm vi xuất đã chọn.');
      return;
    }

    setExportStatus('generating');
    setExportError(null);
    setExportNotice(null);

    try {
      const prepared = await ExcelExportService.prepareExportFile(
        targetExportPatients,
        targetExportAssessments,
        timepoints,
        {
          includeNames: exportIncludeNames,
          filterScope: exportScope,
          customFilename: expectedFilename,
        }
      );

      setPreparedFile(prepared);
      setExportStatus('ready');
    } catch (err: any) {
      setExportStatus('error');
      setExportError(err?.message || 'Có lỗi xảy ra khi tạo file Excel.');
    }
  };

  // Bước 2: Kích hoạt bảng chia sẻ iOS (Zalo / Lưu vào Tệp) trực tiếp từ thao tác người dùng
  const handleShareFile = async () => {
    if (!preparedFile) return;

    setExportStatus('sharing');
    setExportError(null);
    setExportNotice(null);

    try {
      const res = await ExcelExportService.sharePreparedFile(preparedFile);

      if (res.status === 'shared') {
        setExportStatus('shared');
        setExportNotice('Đã kích hoạt bảng chia sẻ iPhone. Bạn hãy chọn Zalo hoặc Lưu vào Tệp.');
      } else if (res.status === 'cancelled') {
        setExportStatus('cancelled');
        setExportNotice('Bạn đã đóng bảng chia sẻ. File vẫn sẵn sàng nếu bạn muốn chia sẻ lại hoặc tải về.');
      } else if (res.status === 'unsupported') {
        setExportStatus('unsupported');
        setExportNotice('Trình duyệt chưa hỗ trợ chia sẻ trực tiếp. Vui lòng bấm nút Tải file về máy bên dưới.');
      } else {
        setExportStatus('error');
        setExportError(res.error || 'Không thể chia sẻ file.');
      }
    } catch (err: any) {
      setExportStatus('error');
      setExportError(err?.message || 'Có lỗi xảy ra khi chia sẻ file.');
    }
  };

  // Phương án dự phòng: Tải file về máy
  const handleDownloadFile = () => {
    if (!preparedFile) return;

    const res = ExcelExportService.downloadPreparedFile(preparedFile);
    if (res.success) {
      setExportNotice('Đã gửi yêu cầu tải file về máy. Bạn có thể mở ứng dụng Tệp (Files) trên iPhone để tìm file và gửi qua Zalo.');
    } else {
      Alert.alert('Thông báo', res.error || 'Vui lòng sử dụng tính năng Chia sẻ để Lưu vào Tệp trên iPhone.');
    }
  };

  // Đóng modal và giải phóng Blob URL
  const handleCloseExportModal = () => {
    if (preparedFile) {
      ExcelExportService.revokePreparedFile(preparedFile);
      setPreparedFile(null);
    }
    setExportStatus('idle');
    setExportError(null);
    setExportNotice(null);
    setIsExportModalOpen(false);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header Bar: Thiết kế lại theo cấu trúc 3 dòng riêng biệt (Phần 4.1) */}
      <View style={styles.header}>
        {/* Dòng 1: Nút quay lại “Danh sách BN” và nút Tải lại */}
        <View style={styles.headerLine1}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color="#334155" />
            <Text style={styles.backBtnText}>Danh sách BN</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.refreshBtn} onPress={loadData} activeOpacity={0.7}>
            <Ionicons name="reload" size={17} color="#0284C7" />
          </TouchableOpacity>
        </View>

        {/* Dòng 2: Tiêu đề lớn “BẢNG TỔNG HỢP DỮ LIỆU” */}
        <View style={styles.headerLine2}>
          <Text style={styles.headerTitleLarge}>BẢNG TỔNG HỢP DỮ LIỆU</Text>
          <Text style={styles.headerSubtitleText}>
            Theo dõi đau sau mổ • Thang đo chuẩn 10 cm
          </Text>
        </View>

        {/* Dòng 3: Nút “Xuất Excel” và Nút chuyển chế độ “Chọn bệnh nhân” */}
        <View style={styles.headerLine3}>
          <TouchableOpacity
            style={styles.exportExcelBtn}
            onPress={() => setIsExportModalOpen(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="document-text" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.exportExcelBtnText}>Xuất Excel (.xlsx)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.selectionModeToggleBtn,
              isSelectionMode && styles.selectionModeToggleBtnActive,
            ]}
            onPress={() => {
              setIsSelectionMode((prev) => {
                const next = !prev;
                if (next && selectedPatientIds.size === 0) {
                  // Mặc định chọn trước bệnh nhân đang hiển thị
                }
                return next;
              });
            }}
            activeOpacity={0.75}
          >
            <Ionicons
              name={isSelectionMode ? 'checkbox' : 'checkbox-outline'}
              size={17}
              color={isSelectionMode ? '#FFFFFF' : '#0284C7'}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.selectionModeToggleText,
                isSelectionMode && styles.selectionModeToggleTextActive,
              ]}
            >
              {isSelectionMode ? 'Đang chọn BN' : 'Chọn BN để xuất'}
            </Text>
            {selectedPatientIds.size > 0 && (
              <View
                style={[
                  styles.selectionCounterBadge,
                  isSelectionMode && styles.selectionCounterBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.selectionCounterBadgeText,
                    isSelectionMode && styles.selectionCounterBadgeTextActive,
                  ]}
                >
                  {selectedPatientIds.size}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Thanh điều khiển Chế độ Chọn bệnh nhân để xuất (Phần 4.3) */}
      {isSelectionMode && (
        <View style={styles.selectionControlBar}>
          <View style={styles.selectionControlInfo}>
            <Ionicons name="checkbox" size={18} color="#0284C7" style={{ marginRight: 6 }} />
            <Text style={styles.selectionControlInfoText}>
              Đã chọn <Text style={styles.boldText}>{selectedPatientIds.size}</Text> / {patients.length} bệnh nhân
            </Text>
          </View>

          <View style={styles.selectionControlActions}>
            <TouchableOpacity
              style={styles.selectionControlBtn}
              onPress={handleSelectAllVisible}
              activeOpacity={0.7}
            >
              <Text style={styles.selectionControlBtnText}>Chọn tất cả ({filteredPatients.length})</Text>
            </TouchableOpacity>

            {selectedPatientIds.size > 0 && (
              <TouchableOpacity
                style={[styles.selectionControlBtn, styles.selectionControlBtnClear]}
                onPress={handleDeselectAll}
                activeOpacity={0.7}
              >
                <Text style={styles.selectionControlBtnClearText}>Bỏ chọn tất cả</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Filter and Search Bar */}
      <View style={styles.filterSection}>
        <View style={styles.searchRow}>
          <View style={styles.searchInner}>
            <Ionicons name="search" size={16} color="#64748B" style={{ marginLeft: 10 }} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Tìm theo MSBA hoặc tên..."
              placeholderTextColor="#94A3B8"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 8 }}>
                <Ionicons name="close-circle" size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Sắp xếp */}
          <TouchableOpacity
            style={styles.sortToggleBtn}
            onPress={() => setSortBy((prev) => (prev === 'msba' ? 'order' : 'msba'))}
            activeOpacity={0.7}
          >
            <Ionicons name="swap-vertical" size={14} color="#0284C7" style={{ marginRight: 4 }} />
            <Text style={styles.sortToggleText}>
              {sortBy === 'msba' ? 'MSBA' : 'Thứ tự'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Status Filter Segment (Section VII.4) */}
        <View style={styles.statusSegmentRow}>
          <TouchableOpacity
            style={[styles.segmentBtn, statusFilter === 'all' && styles.segmentBtnActive]}
            onPress={() => setStatusFilter('all')}
            activeOpacity={0.7}
          >
            <Text style={[styles.segmentBtnText, statusFilter === 'all' && styles.segmentBtnTextActive]}>
              Tất cả ({patients.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, statusFilter === 'complete' && styles.segmentBtnActive]}
            onPress={() => setStatusFilter('complete')}
            activeOpacity={0.7}
          >
            <Text style={[styles.segmentBtnText, statusFilter === 'complete' && styles.segmentBtnTextActive]}>
              Đã đủ mốc
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, statusFilter === 'missing' && styles.segmentBtnActive]}
            onPress={() => setStatusFilter('missing')}
            activeOpacity={0.7}
          >
            <Text style={[styles.segmentBtnText, statusFilter === 'missing' && styles.segmentBtnTextActive]}>
              Thiếu mốc
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Cảnh báo chất lượng dữ liệu (Section VIII.4) */}
      {validation.warnings.length > 0 && (
        <View style={styles.validationNoticeBox}>
          <Ionicons name="information-circle-outline" size={15} color="#D97706" style={{ marginRight: 6 }} />
          <Text style={styles.validationNoticeText} numberOfLines={2}>
            {validation.warnings.join(' • ')}
          </Text>
        </View>
      )}

      {/* Main Content: Bảng tổng hợp dạng Excel cuộn ngang/dọc độc lập */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#0284C7" />
          <Text style={styles.loadingText}>Đang tải bảng tổng hợp dữ liệu...</Text>
        </View>
      ) : filteredPatients.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="grid-outline" size={48} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>Không có dữ liệu phù hợp</Text>
          <Text style={styles.emptySubtitle}>
            Thử thay đổi từ khóa tìm kiếm hoặc chọn bộ lọc &quot;Tất cả&quot;.
          </Text>
        </View>
      ) : (
        <View style={styles.tableCard}>
          {/* ScrollView Ngang cho riêng vùng bảng để không ép cột vào màn hình điện thoại (Section VII.3) */}
          <ScrollView horizontal={true} showsHorizontalScrollIndicator={true} bounces={false}>
            <View>
              {/* Header Hàng Bảng */}
              <View style={styles.tableHeaderRow}>
                {/* Cột Checkbox chọn bệnh nhân (Phần 4.3) */}
                {isSelectionMode && (
                  <View style={[styles.tableHeaderCell, { width: 44, justifyContent: 'center', alignItems: 'center' }]}>
                    <TouchableOpacity
                      onPress={() => {
                        const allVisibleSelected =
                          filteredPatients.length > 0 &&
                          filteredPatients.every((p) => selectedPatientIds.has(p.study_id));
                        if (allVisibleSelected) {
                          handleDeselectVisible();
                        } else {
                          handleSelectAllVisible();
                        }
                      }}
                    >
                      <Ionicons
                        name={
                          filteredPatients.length > 0 &&
                          filteredPatients.every((p) => selectedPatientIds.has(p.study_id))
                            ? 'checkbox'
                            : 'square-outline'
                        }
                        size={18}
                        color="#0284C7"
                      />
                    </TouchableOpacity>
                  </View>
                )}

                <View style={[styles.tableHeaderCell, { width: 46 }]}>
                  <Text style={styles.tableHeaderText}>STT</Text>
                </View>
                <View style={[styles.tableHeaderCell, { width: 95 }]}>
                  <Text style={styles.tableHeaderText}>MSBA</Text>
                </View>
                <View style={[styles.tableHeaderCell, { width: 140 }]}>
                  <Text style={styles.tableHeaderText}>Họ và tên</Text>
                </View>
                <View style={[styles.tableHeaderCell, { width: 75 }]}>
                  <Text style={styles.tableHeaderText}>Năm sinh</Text>
                </View>
                <View style={[styles.tableHeaderCell, { width: 110 }]}>
                  <Text style={styles.tableHeaderText}>T0 tham chiếu</Text>
                </View>

                {/* Các cột Mốc T (VAS và Giờ đánh giá) */}
                {timepoints.map((tp) => (
                  <React.Fragment key={tp.key}>
                    <View style={[styles.tableHeaderCell, styles.timepointVasHeaderCell, { width: 90 }]}>
                      <Text style={styles.timepointVasHeaderText}>VAS {tp.label}</Text>
                      <Text style={styles.timepointSubText}>(mm)</Text>
                    </View>
                    <View style={[styles.tableHeaderCell, { width: 110 }]}>
                      <Text style={styles.tableHeaderText}>Giờ {tp.label}</Text>
                    </View>
                  </React.Fragment>
                ))}
              </View>

              {/* Dữ liệu các dòng bệnh nhân (Cuộn dọc) */}
              <ScrollView style={styles.tableBodyScrollView} showsVerticalScrollIndicator={true} bounces={false}>
                {filteredPatients.map((patient, pIndex) => {
                  const msba = (patient.medical_record_number || patient.study_id).trim().toUpperCase();
                  const patientMap = assessmentsByPatient[msba] || {};
                  const isEven = pIndex % 2 === 0;
                  const isSelected = selectedPatientIds.has(patient.study_id);

                  return (
                    <TouchableOpacity
                      key={patient.study_id}
                      style={[
                        styles.tableDataRow,
                        isEven ? styles.rowEven : styles.rowOdd,
                        isSelected && styles.rowSelected,
                      ]}
                      onPress={() => {
                        if (isSelectionMode) {
                          toggleSelectPatient(patient.study_id);
                        } else if (onSelectPatient) {
                          onSelectPatient(patient);
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      {/* Checkbox chọn bệnh nhân */}
                      {isSelectionMode && (
                        <TouchableOpacity
                          style={[styles.tableCell, { width: 44, justifyContent: 'center', alignItems: 'center' }]}
                          onPress={() => toggleSelectPatient(patient.study_id)}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={isSelected ? 'checkbox' : 'square-outline'}
                            size={20}
                            color={isSelected ? '#0284C7' : '#94A3B8'}
                          />
                        </TouchableOpacity>
                      )}

                      {/* STT */}
                      <View style={[styles.tableCell, { width: 46 }]}>
                        <Text style={styles.cellMutedText}>{pIndex + 1}</Text>
                      </View>

                      {/* MSBA */}
                      <View style={[styles.tableCell, { width: 95 }]}>
                        <Text style={styles.cellMsbaText}>{msba}</Text>
                      </View>

                      {/* Họ và tên */}
                      <View style={[styles.tableCell, { width: 140 }]}>
                        <Text style={styles.cellNameText} numberOfLines={1}>
                          {patient.patient_name || '---'}
                        </Text>
                      </View>

                      {/* Năm sinh */}
                      <View style={[styles.tableCell, { width: 75 }]}>
                        <Text style={styles.cellText}>{patient.birth_year || '---'}</Text>
                      </View>

                      {/* T0 tham chiếu */}
                      <View style={[styles.tableCell, { width: 110 }]}>
                        <Text style={styles.cellTimeText}>
                          {formatTableDateTime(patient.t0_timestamp)}
                        </Text>
                      </View>

                      {/* Các cột Mốc T */}
                      {timepoints.map((tp) => {
                        const normTp = tp.key.replace('h', '').toUpperCase();
                        const list = patientMap[normTp] || [];
                        const hasData = list.length > 0;
                        const primary = hasData
                           ? list.find((item) => item.is_primary_assessment) || list[0]
                           : null;
                        const scoreVal = primary
                           ? (primary.vas_score ?? primary.eVAS_score)
                           : null;

                        return (
                          <React.Fragment key={tp.key}>
                            {/* Ô Điểm VAS (Không tự điền 0, để '—' nếu chưa có - Section VII.2) */}
                            <View style={[styles.tableCell, styles.cellVasScoreBox, { width: 90 }]}>
                              {scoreVal !== null && scoreVal !== undefined ? (
                                <View style={styles.scoreWithBadge}>
                                  <Text style={styles.cellScoreNumber}>
                                    {scoreVal.toFixed(1)}
                                  </Text>
                                  {list.length > 1 && (
                                    <View style={styles.multiCountBadge}>
                                      <Text style={styles.multiCountBadgeText}>x{list.length}</Text>
                                    </View>
                                  )}
                                </View>
                              ) : (
                                <Text style={styles.cellEmptyText}>—</Text>
                              )}
                            </View>

                            {/* Ô Giờ đo thực tế */}
                            <View style={[styles.tableCell, { width: 110 }]}>
                              <Text style={styles.cellTimeText}>
                                {primary
                                  ? formatTableDateTime(primary.actual_timestamp || primary.submit_timestamp)
                                  : '—'}
                              </Text>
                            </View>
                          </React.Fragment>
                        );
                      })}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </ScrollView>

          {/* Thanh trạng thái dưới bảng */}
          <View style={styles.tableFooterBar}>
            <Text style={styles.tableFooterText}>
              Đang hiển thị {filteredPatients.length} / {patients.length} bệnh nhân
              {selectedPatientIds.size > 0 && ` • Đã chọn ${selectedPatientIds.size} BN để xuất`}
              {' • Chạm vào hàng để mở hồ sơ'}
            </Text>
          </View>
        </View>
      )}

      {/* ============================================================ */}
      {/* MODAL XUẤT EXCEL .XLSX VỚI 3 SHEET & CHIA SẺ IPHONE (ZALO)     */}
      {/* ============================================================ */}
      <Modal
        visible={isExportModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseExportModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.exportDialog}>
            <View style={styles.exportDialogHeader}>
              <View style={styles.exportIconBox}>
                <Ionicons name="document-text" size={24} color="#059669" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.exportDialogTitle}>XUẤT EXCEL (.xlsx)</Text>
                <Text style={styles.exportDialogSubtitle}>
                  Tạo file thật • Chia sẻ qua Zalo hoặc Lưu vào Tệp
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleCloseExportModal}
                style={{ padding: 4 }}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* TRẠNG THÁI 1: IDLE - CẤU HÌNH PHẠM VI VÀ BẤM TẠO FILE */}
            {exportStatus === 'idle' && (
              <>
                {/* Chi tiết 3 Sheet chuẩn */}
                <View style={styles.exportSheetInfoBox}>
                  <Text style={styles.sheetInfoTitle}>File Excel sẽ bao gồm 3 Sheet:</Text>
                  <View style={styles.sheetInfoItem}>
                    <Ionicons name="layers-outline" size={14} color="#0284C7" />
                    <Text style={styles.sheetInfoText}>
                      <Text style={styles.boldText}>1. TONG_HOP:</Text> Mỗi dòng là 1 BN, các cột VAS & giờ từng mốc
                    </Text>
                  </View>
                  <View style={styles.sheetInfoItem}>
                    <Ionicons name="layers-outline" size={14} color="#0284C7" />
                    <Text style={styles.sheetInfoText}>
                      <Text style={styles.boldText}>2. CHI_TIET:</Text> Toàn bộ các lần đo của các BN được xuất
                    </Text>
                  </View>
                  <View style={styles.sheetInfoItem}>
                    <Ionicons name="layers-outline" size={14} color="#0284C7" />
                    <Text style={styles.sheetInfoText}>
                      <Text style={styles.boldText}>3. HUONG_DAN_BIEN:</Text> Từ điển tên biến và kiểu dữ liệu SPSS/R
                    </Text>
                  </View>
                </View>

                {/* Phạm vi xuất */}
                <View style={styles.exportOptionGroup}>
                  <Text style={styles.exportOptionLabel}>Phạm vi xuất dữ liệu:</Text>
                  <View style={styles.scopeButtonRow}>
                    <TouchableOpacity
                      style={[styles.scopeBtn, exportScope === 'all' && styles.scopeBtnActive]}
                      onPress={() => setExportScope('all')}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.scopeBtnText, exportScope === 'all' && styles.scopeBtnTextActive]}>
                        Toàn bộ ({patients.length})
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.scopeBtn, exportScope === 'filtered' && styles.scopeBtnActive]}
                      onPress={() => setExportScope('filtered')}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.scopeBtnText, exportScope === 'filtered' && styles.scopeBtnTextActive]}>
                        Đang lọc ({filteredPatients.length})
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.scopeBtn, exportScope === 'selected' && styles.scopeBtnActive]}
                      onPress={() => setExportScope('selected')}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.scopeBtnText, exportScope === 'selected' && styles.scopeBtnTextActive]}>
                        Đã chọn ({selectedPatientIds.size})
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Tóm tắt thông tin trước khi tạo file */}
                <View style={styles.exportPreSummaryBox}>
                  <Text style={styles.exportPreSummaryTitle}>Thông tin file dự kiến:</Text>
                  <Text style={styles.exportPreSummaryLine}>
                    • Số bệnh nhân: <Text style={styles.boldText}>{targetExportPatients.length} bệnh nhân</Text>
                  </Text>
                  <Text style={styles.exportPreSummaryLine}>
                    • Số lượt đánh giá: <Text style={styles.boldText}>{targetExportAssessments.length} lượt đo</Text>
                  </Text>
                  <Text style={styles.exportPreSummaryLine}>
                    • Tên file: <Text style={styles.boldText}>{expectedFilename}</Text>
                  </Text>
                  <Text style={styles.exportPreSummaryHighlight}>
                    Xuất dữ liệu {targetExportPatients.length} bệnh nhân với {targetExportAssessments.length} lượt đánh giá.
                  </Text>
                </View>

                {/* Tùy chọn bảo mật Họ tên */}
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setExportIncludeNames((prev) => !prev)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={exportIncludeNames ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={exportIncludeNames ? '#0284C7' : '#94A3B8'}
                  />
                  <Text style={styles.checkboxLabel}>
                    Kèm Họ và tên bệnh nhân (dữ liệu định danh)
                  </Text>
                </TouchableOpacity>

                {exportError && (
                  <View style={[styles.statusBanner, { backgroundColor: '#FEE2E2' }]}>
                    <Ionicons name="alert-circle" size={18} color="#DC2626" />
                    <Text style={[styles.statusBannerText, { color: '#B91C1C' }]}>{exportError}</Text>
                  </View>
                )}

                {/* Nút Tạo file */}
                <View style={styles.exportActionRow}>
                  <TouchableOpacity
                    style={styles.cancelExportBtn}
                    onPress={handleCloseExportModal}
                  >
                    <Text style={styles.cancelExportBtnText}>Đóng</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.doExportBtn}
                    onPress={handlePrepareExport}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="document-text-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.doExportBtnText}>TẠO FILE EXCEL (.xlsx)</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* TRẠNG THÁI 2: GENERATING - ĐANG TẠO FILE EXCEL THẬT */}
            {exportStatus === 'generating' && (
              <View style={styles.generatingStateBox}>
                <ActivityIndicator size="large" color="#059669" style={{ marginBottom: 14 }} />
                <Text style={styles.generatingTitle}>Đang tạo file Excel thật (.xlsx)...</Text>
                <Text style={styles.generatingSubtext}>
                  Đang xử lý dữ liệu {targetExportPatients.length} bệnh nhân và xác thực 3 Sheet (TONG_HOP, CHI_TIET, HUONG_DAN_BIEN).
                </Text>
              </View>
            )}

            {/* TRẠNG THÁI 3: READY / SHARING / SHARED / CANCELLED / UNSUPPORTED - FILE ĐÃ SẴN SÀNG */}
            {(exportStatus === 'ready' ||
              exportStatus === 'sharing' ||
              exportStatus === 'shared' ||
              exportStatus === 'cancelled' ||
              exportStatus === 'unsupported') &&
              preparedFile && (
                <View style={styles.fileReadyContainer}>
                  {/* Thẻ thông tin file đã tạo thành công */}
                  <View style={styles.readyFileCard}>
                    <View style={styles.readyFileHeader}>
                      <Ionicons name="checkmark-circle" size={24} color="#059669" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.readyFileName} numberOfLines={1}>
                          {preparedFile.filename}
                        </Text>
                        <Text style={styles.readyFileMeta}>
                          Dung lượng: {preparedFile.formattedSize} • {preparedFile.patientCount} BN • {preparedFile.assessmentCount} lượt đo
                        </Text>
                      </View>
                    </View>

                    <View style={styles.readySheetBadge}>
                      <Ionicons name="shield-checkmark" size={13} color="#166534" style={{ marginRight: 4 }} />
                      <Text style={styles.readySheetBadgeText}>
                        Đã xác thực 3 Sheet hợp lệ (TONG_HOP, CHI_TIET, HUONG_DAN_BIEN)
                      </Text>
                    </View>
                  </View>

                  {/* Thông báo trạng thái tương tác */}
                  {exportStatus === 'shared' && (
                    <View style={[styles.statusBanner, { backgroundColor: '#EFF6FF' }]}>
                      <Ionicons name="information-circle" size={18} color="#0284C7" />
                      <Text style={[styles.statusBannerText, { color: '#0369A1' }]}>
                        Đã mở bảng chia sẻ iPhone. Bạn hãy chọn Zalo hoặc Lưu vào Tệp.
                      </Text>
                    </View>
                  )}

                  {exportStatus === 'cancelled' && (
                    <View style={[styles.statusBanner, { backgroundColor: '#FFFBEB' }]}>
                      <Ionicons name="alert-circle" size={18} color="#D97706" />
                      <Text style={[styles.statusBannerText, { color: '#B45309' }]}>
                        Bạn đã đóng bảng chia sẻ. File vẫn sẵn sàng nếu bạn muốn chia sẻ lại.
                      </Text>
                    </View>
                  )}

                  {exportNotice && exportStatus !== 'shared' && exportStatus !== 'cancelled' && (
                    <View style={[styles.statusBanner, { backgroundColor: '#F0FDF4' }]}>
                      <Ionicons name="checkmark-circle" size={18} color="#059669" />
                      <Text style={[styles.statusBannerText, { color: '#15803D' }]}>{exportNotice}</Text>
                    </View>
                  )}

                  {/* 2 NÚT THAO TÁC RÕ RÀNG: CHIA SẺ IPHONE & TẢI VỀ */}
                  <View style={styles.actionButtonStack}>
                    {/* NÚT CHÍNH: CHIA SẺ FILE (ZALO / LƯU VÀO TỆP) */}
                    <TouchableOpacity
                      style={styles.btnSharePrimary}
                      onPress={handleShareFile}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="share-social" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={styles.btnSharePrimaryText}>CHIA SẺ FILE (ZALO / TỆP)</Text>
                    </TouchableOpacity>

                    {/* NÚT PHỤ: TẢI FILE VỀ MÁY */}
                    <TouchableOpacity
                      style={styles.btnDownloadSecondary}
                      onPress={handleDownloadFile}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="download-outline" size={18} color="#0284C7" style={{ marginRight: 6 }} />
                      <Text style={styles.btnDownloadSecondaryText}>Tải file về máy (.xlsx)</Text>
                    </TouchableOpacity>
                  </View>

                  {/* HƯỚNG DẪN CHI TIẾT GỬI QUA ZALO TRÊN IPHONE (MỤC 3 & 4) */}
                  <View style={styles.zaloGuideBox}>
                    <Text style={styles.zaloGuideTitle}>📱 HƯỚNG DẪN GỬI QUA ZALO TRÊN IPHONE:</Text>
                    <Text style={styles.zaloGuideText}>
                      <Text style={styles.boldText}>Cách 1:</Text> Bấm nút <Text style={{ color: '#059669', fontWeight: '800' }}>[CHIA SẺ FILE]</Text> ở trên. Khi bảng chia sẻ iPhone hiện lên, chạm vào biểu tượng <Text style={styles.boldText}>Zalo</Text> → Chọn người nhận hoặc nhóm → Bấm Gửi.
                    </Text>
                    <Text style={styles.zaloGuideText}>
                      <Text style={styles.boldText}>Cách 2 (Nếu không thấy Zalo):</Text> Chọn <Text style={styles.boldText}>Lưu vào Tệp</Text> (Save to Files) → Mở Zalo → Vào cuộc trò chuyện → Bấm dấu <Text style={styles.boldText}>(+)</Text> → Chọn <Text style={styles.boldText}>Tài liệu</Text> → Chọn file Excel vừa lưu.
                    </Text>
                    <Text style={styles.zaloGuideTip}>
                      💡 Lưu ý: Trình duyệt Safari trên iPhone hỗ trợ đầy đủ việc gửi file đính kèm trực tiếp sang Zalo.
                    </Text>
                  </View>

                  {/* Nút hành động cuối */}
                  <View style={[styles.exportActionRow, { marginTop: 14 }]}>
                    <TouchableOpacity
                      style={styles.cancelExportBtn}
                      onPress={() => {
                        if (preparedFile) ExcelExportService.revokePreparedFile(preparedFile);
                        setPreparedFile(null);
                        setExportStatus('idle');
                        setExportNotice(null);
                      }}
                    >
                      <Text style={styles.cancelExportBtnText}>Tạo lại với bộ lọc khác</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.cancelExportBtn, { backgroundColor: '#E2E8F0' }]}
                      onPress={handleCloseExportModal}
                    >
                      <Text style={[styles.cancelExportBtnText, { color: '#1E293B' }]}>Hoàn tất</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

            {/* TRẠNG THÁI 4: ERROR */}
            {exportStatus === 'error' && (
              <View style={styles.errorStateBox}>
                <Ionicons name="alert-circle" size={36} color="#DC2626" style={{ marginBottom: 10 }} />
                <Text style={styles.errorStateTitle}>Không thể tạo hoặc chia sẻ file</Text>
                <Text style={styles.errorStateMessage}>{exportError || 'Có lỗi xảy ra.'}</Text>

                <View style={[styles.exportActionRow, { marginTop: 16 }]}>
                  <TouchableOpacity
                    style={styles.cancelExportBtn}
                    onPress={handleCloseExportModal}
                  >
                    <Text style={styles.cancelExportBtnText}>Đóng</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.doExportBtn}
                    onPress={() => setExportStatus('idle')}
                  >
                    <Text style={styles.doExportBtnText}>Thử lại</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 48 : 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  headerLine1: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginLeft: 4,
  },
  headerLine2: {
    marginTop: 2,
    gap: 2,
  },
  headerTitleLarge: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.3,
  },
  headerSubtitleText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
  },
  headerLine3: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  exportExcelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  exportExcelBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  selectionModeToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
  },
  selectionModeToggleBtnActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  selectionModeToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
  selectionModeToggleTextActive: {
    color: '#FFFFFF',
  },
  selectionCounterBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    marginLeft: 6,
  },
  selectionCounterBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  selectionCounterBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0284C7',
  },
  selectionCounterBadgeTextActive: {
    color: '#FFFFFF',
  },
  selectionControlBar: {
    backgroundColor: '#F0F9FF',
    borderBottomWidth: 1,
    borderBottomColor: '#BAE6FD',
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectionControlInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectionControlInfoText: {
    fontSize: 12,
    color: '#0369A1',
    fontWeight: '600',
  },
  selectionControlActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectionControlBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#7DD3FC',
  },
  selectionControlBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  selectionControlBtnClear: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  selectionControlBtnClearText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  refreshBtn: {
    padding: 7,
    borderRadius: 8,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  filterSection: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    height: 38,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingHorizontal: 8,
    color: '#0F172A',
  },
  sortToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  sortToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
  statusSegmentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentBtn: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  segmentBtnActive: {
    backgroundColor: '#0284C7',
  },
  segmentBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  segmentBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  validationNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  validationNoticeText: {
    fontSize: 11,
    color: '#B45309',
    fontWeight: '500',
    flex: 1,
  },
  tableCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderBottomWidth: 2,
    borderBottomColor: '#CBD5E1',
  },
  tableHeaderCell: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'center',
  },
  timepointVasHeaderCell: {
    backgroundColor: '#E0F2FE',
  },
  timepointVasHeaderText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0369A1',
    textAlign: 'center',
  },
  timepointSubText: {
    fontSize: 10,
    color: '#0284C7',
    fontWeight: '600',
  },
  tableBodyScrollView: {
    flex: 1,
  },
  tableDataRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  rowEven: {
    backgroundColor: '#FFFFFF',
  },
  rowOdd: {
    backgroundColor: '#F8FAFC',
  },
  rowSelected: {
    backgroundColor: '#E0F2FE',
  },
  tableCell: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#F1F5F9',
  },
  cellMutedText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  cellMsbaText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0284C7',
  },
  cellNameText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  cellText: {
    fontSize: 12,
    color: '#334155',
  },
  cellTimeText: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
  },
  cellVasScoreBox: {
    backgroundColor: '#F0F9FF',
  },
  scoreWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cellScoreNumber: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0B3D91',
  },
  multiCountBadge: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 1,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  multiCountBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D97706',
  },
  cellEmptyText: {
    fontSize: 14,
    color: '#CBD5E1',
    fontWeight: '700',
  },
  tableFooterBar: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    alignItems: 'center',
  },
  tableFooterText: {
    fontSize: 11,
    color: '#64748B',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748B',
  },
  emptyBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  exportDialog: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  exportDialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  exportIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportDialogTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  exportDialogSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  exportSheetInfoBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  sheetInfoTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  sheetInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sheetInfoText: {
    fontSize: 11,
    color: '#334155',
    flex: 1,
  },
  boldText: {
    fontWeight: '700',
    color: '#0F172A',
  },
  exportOptionGroup: {
    marginBottom: 12,
  },
  exportOptionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  scopeButtonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  scopeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  scopeBtnActive: {
    backgroundColor: '#E0F2FE',
    borderColor: '#0284C7',
  },
  scopeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  scopeBtnTextActive: {
    color: '#0284C7',
    fontWeight: '800',
  },
  exportPreSummaryBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  exportPreSummaryTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  exportPreSummaryLine: {
    fontSize: 12,
    color: '#475569',
  },
  exportPreSummaryHighlight: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
    marginTop: 4,
    backgroundColor: '#ECFDF5',
    padding: 8,
    borderRadius: 6,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  checkboxLabel: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  exportSuccessBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  exportSuccessBannerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
    flex: 1,
  },
  exportActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelExportBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  cancelExportBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  doExportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#059669',
  },
  doExportBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  generatingStateBox: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generatingTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  generatingSubtext: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  fileReadyContainer: {
    width: '100%',
  },
  readyFileCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  readyFileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  readyFileName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  readyFileMeta: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
    fontWeight: '600',
  },
  readySheetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  readySheetBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  statusBannerText: {
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
    marginLeft: 6,
  },
  actionButtonStack: {
    gap: 8,
    marginVertical: 4,
  },
  btnSharePrimary: {
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  btnSharePrimaryText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  btnDownloadSecondary: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDownloadSecondaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284C7',
  },
  zaloGuideBox: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  zaloGuideTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  zaloGuideText: {
    fontSize: 10.5,
    color: '#334155',
    lineHeight: 15,
    marginBottom: 4,
  },
  zaloGuideTip: {
    fontSize: 10,
    fontStyle: 'italic',
    color: '#0284C7',
    marginTop: 2,
  },
  errorStateBox: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  errorStateTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#DC2626',
    marginBottom: 6,
  },
  errorStateMessage: {
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 12,
  },
});
