import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Patient, Assessment, AppUser, TimepointConfigItem } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { DEFAULT_CLINICAL_TIMEPOINTS } from '../config/timepointConfig';
import { StorageService } from '../services/storageService';
import { TimepointConfigModal } from '../components/TimepointConfigModal';

interface PatientDetailScreenProps {
  patient: Patient;
  onBack: () => void;
  onStartAssessmentForTimepoint: (timepointKey: string) => void;
  currentUser?: AppUser | null;
  onPatientUpdated?: (updated: Patient) => void;
}

export const PatientDetailScreen: React.FC<PatientDetailScreenProps> = ({
  patient,
  onBack,
  onStartAssessmentForTimepoint,
  currentUser,
  onPatientUpdated,
}) => {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentPatient, setCurrentPatient] = useState<Patient>(patient);

  // Edit patient modal
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editName, setEditName] = useState<string>('');
  const [editBirthYear, setEditBirthYear] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  // Manual T0 modal & selector state
  const [isT0ModalOpen, setIsT0ModalOpen] = useState<boolean>(false);
  const [t0Year, setT0Year] = useState<number>(new Date().getFullYear());
  const [t0Month, setT0Month] = useState<number>(new Date().getMonth() + 1);
  const [t0Day, setT0Day] = useState<number>(new Date().getDate());
  const [t0Hour, setT0Hour] = useState<number>(new Date().getHours());
  const [t0Minute, setT0Minute] = useState<number>(new Date().getMinutes());
  const [isSavingT0, setIsSavingT0] = useState<boolean>(false);
  const [referenceNow, setReferenceNow] = useState<number>(0);

  // Doctor custom timepoints state
  const [currentTimepoints, setCurrentTimepoints] = useState<TimepointConfigItem[]>(
    patient.custom_timepoints && patient.custom_timepoints.length > 0
      ? patient.custom_timepoints
      : DEFAULT_CLINICAL_TIMEPOINTS
  );
  const [isTimepointModalOpen, setIsTimepointModalOpen] = useState<boolean>(false);

  const msba = currentPatient.medical_record_number || currentPatient.study_id;

  const loadData = async () => {
    setLoading(true);
    try {
      const [list, refreshedPatient] = await Promise.all([
        FirebaseService.getAssessmentsByPatient(msba),
        FirebaseService.getPatient(msba),
      ]);
      setAssessments(list);
      if (refreshedPatient) {
        setCurrentPatient(refreshedPatient);
        if (refreshedPatient.custom_timepoints && refreshedPatient.custom_timepoints.length > 0) {
          setCurrentTimepoints(refreshedPatient.custom_timepoints);
        } else {
          const doctorTps = await StorageService.getDoctorCustomTimepoints();
          setCurrentTimepoints(doctorTps);
        }
      } else {
        const doctorTps = await StorageService.getDoctorCustomTimepoints();
        setCurrentTimepoints(doctorTps);
      }
    } catch (e) {
      console.error('Error loading patient detail:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [patient]);

  // Gom nhóm các lần đánh giá theo các mốc T động do bác sĩ cấu hình
  const assessmentsByTimepoint = React.useMemo(() => {
    const map: Record<string, Assessment[]> = {};
    currentTimepoints.forEach((tp) => {
      map[tp.key.toUpperCase()] = [];
    });

    assessments.forEach((a) => {
      // Nhận diện mốc từ selected_timepoint hoặc assessment_timepoint
      const tp = (a.selected_timepoint || a.planned_timepoint || a.assessment_timepoint || a.timepoint_label || '').trim();
      const normalizedTp = tp.replace('h', '').toUpperCase();
      if (!map[normalizedTp]) {
        map[normalizedTp] = [];
      }
      map[normalizedTp].push(a);
    });

    // Sắp xếp theo thời gian thực tế mới nhất trước
    Object.keys(map).forEach((key) => {
      map[key].sort(
        (a, b) =>
          new Date(b.actual_timestamp || b.submit_timestamp).getTime() -
          new Date(a.actual_timestamp || a.submit_timestamp).getTime()
      );
    });

    return map;
  }, [assessments, currentTimepoints]);

  // Xử lý chỉnh sửa thông tin cơ bản
  const handleOpenEdit = () => {
    setEditName(currentPatient.patient_name || '');
    setEditBirthYear(currentPatient.birth_year ? String(currentPatient.birth_year) : '');
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      Alert.alert('Nhắc nhở', 'Họ và tên không được để trống.');
      return;
    }
    const yearNum = editBirthYear.trim() ? parseInt(editBirthYear.trim(), 10) : null;

    setIsSavingEdit(true);
    const updated: Patient = {
      ...currentPatient,
      patient_name: editName.trim(),
      birth_year: yearNum,
    };

    const res = await FirebaseService.savePatient(updated, currentUser);
    setIsSavingEdit(false);
    if (res.success) {
      setCurrentPatient(updated);
      setIsEditModalOpen(false);
      if (onPatientUpdated) onPatientUpdated(updated);
      Alert.alert('Thành công', 'Đã cập nhật thông tin bệnh nhân.');
    } else {
      Alert.alert('Lỗi', res.error || 'Không thể cập nhật thông tin.');
    }
  };

  // Mở modal cấu hình mốc T0 với giá trị ngày giờ khởi tạo
  const handleOpenT0Modal = () => {
    setReferenceNow(Date.now());
    let baseDate = new Date();
    if (currentPatient.t0_timestamp) {
      const parsed = new Date(currentPatient.t0_timestamp);
      if (!isNaN(parsed.getTime())) {
        baseDate = parsed;
      }
    }
    setT0Year(baseDate.getFullYear());
    setT0Month(baseDate.getMonth() + 1);
    setT0Day(baseDate.getDate());
    setT0Hour(baseDate.getHours());
    setT0Minute(baseDate.getMinutes());
    setIsT0ModalOpen(true);
  };

  // Chọn thời điểm T0 là Hiện tại
  const handleSetT0Now = () => {
    const now = new Date();
    setT0Year(now.getFullYear());
    setT0Month(now.getMonth() + 1);
    setT0Day(now.getDate());
    setT0Hour(now.getHours());
    setT0Minute(now.getMinutes());
  };

  // Chọn lùi thời gian so với hiện tại (-15m, -30m, -1h, -2h)
  const handleOffsetMinutesFromNow = (minutesBack: number) => {
    const target = new Date(Date.now() - minutesBack * 60 * 1000);
    setT0Year(target.getFullYear());
    setT0Month(target.getMonth() + 1);
    setT0Day(target.getDate());
    setT0Hour(target.getHours());
    setT0Minute(target.getMinutes());
  };

  // Chọn Hôm nay / Hôm qua
  const handleSetToday = () => {
    const now = new Date();
    setT0Year(now.getFullYear());
    setT0Month(now.getMonth() + 1);
    setT0Day(now.getDate());
  };

  const handleSetYesterday = () => {
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
    setT0Year(yesterday.getFullYear());
    setT0Month(yesterday.getMonth() + 1);
    setT0Day(yesterday.getDate());
  };

  const handleAdjustHour = (delta: number) => {
    setT0Hour((prev) => (prev + delta + 24) % 24);
  };

  const handleAdjustMinute = (delta: number) => {
    setT0Minute((prev) => {
      let next = prev + delta;
      if (next < 0) next = 59;
      else if (next > 59) next = 0;
      return next;
    });
  };

  const handleAdjustDay = (delta: number) => {
    const current = new Date(t0Year, t0Month - 1, t0Day + delta, t0Hour, t0Minute);
    setT0Year(current.getFullYear());
    setT0Month(current.getMonth() + 1);
    setT0Day(current.getDate());
  };

  // Tính toán thời gian T0 đang chọn và độ lệch
  const computedT0Date = React.useMemo(() => {
    return new Date(t0Year, t0Month - 1, t0Day, t0Hour, t0Minute, 0);
  }, [t0Year, t0Month, t0Day, t0Hour, t0Minute]);

  const t0DiffText = React.useMemo(() => {
    if (!referenceNow || isNaN(computedT0Date.getTime())) return '';
    const diffMs = referenceNow - computedT0Date.getTime();
    const diffMinutes = Math.round(diffMs / 60000);
    if (Math.abs(diffMinutes) <= 1) return 'Thời điểm hiện tại';
    if (diffMinutes > 0) {
      const hrs = Math.floor(diffMinutes / 60);
      const mins = diffMinutes % 60;
      if (hrs === 0) return `Cách đây ${mins} phút`;
      if (mins === 0) return `Cách đây ${hrs} giờ`;
      return `Cách đây ${hrs} giờ ${mins} phút`;
    } else {
      const futureMins = Math.abs(diffMinutes);
      return `Mốc tương lai (+${futureMins} phút)`;
    }
  }, [computedT0Date, referenceNow]);

  // Phân loại mức độ đau VAS chuẩn y tế: 0-<4: Nhẹ, >=4-<7: Vừa, >=7: Nặng
  const getPainCategory = (vasMm: number) => {
    if (vasMm < 40) return { label: 'Đau nhẹ', color: '#16A34A', bg: '#DCFCE7' };
    if (vasMm < 70) return { label: 'Đau vừa', color: '#D97706', bg: '#FEF3C7' };
    return { label: 'Đau nặng', color: '#DC2626', bg: '#FEE2E2' };
  };

  // Lưu T0 và tùy chọn mở đánh giá VAS ngay
  const handleSaveT0 = async (startVASImmediately: boolean) => {
    const d = new Date(t0Year, t0Month - 1, t0Day, t0Hour, t0Minute, 0);
    if (isNaN(d.getTime())) {
      Alert.alert('Lỗi', 'Thời gian đã chọn không hợp lệ. Vui lòng kiểm tra lại ngày giờ.');
      return;
    }

    setIsSavingT0(true);
    try {
      const isoString = d.toISOString();
      const updated: Patient = {
        ...currentPatient,
        t0_timestamp: isoString,
      };

      await FirebaseService.savePatient(updated, currentUser);
      const patientCode = (updated.medical_record_number || updated.study_id).trim().toUpperCase();
      await StorageService.updateActiveEpisodeT0(patientCode, isoString);

      setCurrentPatient(updated);
      if (onPatientUpdated) onPatientUpdated(updated);
      setIsT0ModalOpen(false);

      if (startVASImmediately) {
        onStartAssessmentForTimepoint('T0');
      } else {
        Alert.alert('Đã lưu mốc T0', `Mốc tham chiếu T0: ${formatDateTime(isoString)}`);
      }
    } catch (err: any) {
      console.error('Lỗi lưu T0:', err);
      Alert.alert('Lỗi', 'Không thể lưu mốc tham chiếu T0: ' + (err?.message || 'Vui lòng thử lại.'));
    } finally {
      setIsSavingT0(false);
    }
  };

  // Lưu cấu hình mốc T cho bệnh nhân
  const handleSaveTimepointsForPatient = async (newTimepoints: TimepointConfigItem[]) => {
    setCurrentTimepoints(newTimepoints);
    const updated: Patient = {
      ...currentPatient,
      custom_timepoints: newTimepoints,
    };
    setCurrentPatient(updated);
    await FirebaseService.savePatient(updated, currentUser);
    if (onPatientUpdated) onPatientUpdated(updated);
    Alert.alert('Thành công', 'Đã lưu cấu hình mốc T cho bệnh nhân này.');
  };

  // Lưu cấu hình mốc T làm mặc định
  const handleSaveGlobalTimepoints = (newTimepoints: TimepointConfigItem[]) => {
    setCurrentTimepoints(newTimepoints);
    const updated: Patient = {
      ...currentPatient,
      custom_timepoints: newTimepoints,
    };
    setCurrentPatient(updated);
    FirebaseService.savePatient(updated, currentUser);
    if (onPatientUpdated) onPatientUpdated(updated);
  };

  // Định dạng hiển thị ngày giờ
  const formatDateTime = (isoString?: string | null) => {
    if (!isoString) return '---';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '---';
    const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${time} ${date}`;
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="#334155" />
          <Text style={styles.backBtnText}>Danh sách BN</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Hồ sơ theo dõi đau</Text>

        <View style={styles.headerRightRow}>
          <TouchableOpacity
            style={styles.headerSettingsBtn}
            onPress={() => setIsTimepointModalOpen(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={18} color="#0284C7" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.refreshBtn} onPress={loadData} activeOpacity={0.7}>
            <Ionicons name="reload" size={18} color="#0284C7" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        {/* 4.1. CARD THÔNG TIN CƠ BẢN: MSBA, Họ tên, Năm sinh */}
        <View style={styles.patientInfoCard}>
          <View style={styles.patientCardHeader}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={24} color="#0284C7" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.patientNameHeader}>
                {currentPatient.patient_name || 'Chưa có họ tên'}
              </Text>
              <Text style={styles.patientMsbaHeader}>
                MSBA: <Text style={styles.boldText}>{msba}</Text>
              </Text>
            </View>
            <TouchableOpacity style={styles.editBtn} onPress={handleOpenEdit} activeOpacity={0.7}>
              <Ionicons name="create-outline" size={16} color="#0284C7" />
              <Text style={styles.editBtnText}>Sửa</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.patientMetaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Năm sinh:</Text>
              <Text style={styles.metaValue}>
                {currentPatient.birth_year ? String(currentPatient.birth_year) : 'Chưa nhập'}
              </Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Tổng lượt đo:</Text>
              <Text style={styles.metaValue}>{assessments.length} lần</Text>
            </View>
          </View>
        </View>

        {/* 5.3. MỤC THỜI ĐIỂM THAM CHIẾU T0 & ĐÁNH GIÁ VAS MỐC T0 */}
        {(() => {
          const t0Assessments = assessmentsByTimepoint['T0'] || [];
          const hasT0Assessed = t0Assessments.length > 0;
          const latestT0 = hasT0Assessed ? t0Assessments[0] : null;

          return (
            <View style={styles.t0Card}>
              {/* Hàng 1: Badge T0 + Tên mốc & Badge Trạng thái đánh giá */}
              <View style={styles.t0CardHeader}>
                <View style={styles.tpPillContainer}>
                  <View style={[styles.tpBadge, hasT0Assessed ? styles.tpBadgeDone : styles.t0BadgePending]}>
                    <Text style={[styles.tpBadgeText, hasT0Assessed ? styles.tpBadgeTextDone : styles.t0BadgeTextPending]}>
                      T0
                    </Text>
                  </View>
                  <Text style={styles.tpDescriptionText}>Mốc tham chiếu ban đầu</Text>
                </View>

                {hasT0Assessed ? (
                  <View style={styles.statusTagDone}>
                    <Ionicons name="checkmark-circle" size={13} color="#059669" />
                    <Text style={styles.statusTagDoneText}>Đã đánh giá ({t0Assessments.length})</Text>
                  </View>
                ) : (
                  <View style={styles.statusTagPending}>
                    <Ionicons name="ellipse-outline" size={12} color="#64748B" />
                    <Text style={styles.statusTagPendingText}>Chưa đánh giá</Text>
                  </View>
                )}
              </View>

              {/* Hàng 2: Hộp thông tin Mốc T0 & Nút Đổi thời gian T0 */}
              <View style={styles.t0TimeBox}>
                <View style={styles.t0TimeTextCol}>
                  <Text style={styles.t0TimeBoxLabel}>Mốc T0 gốc:</Text>
                  <Text style={styles.t0TimeBoxValue}>
                    {currentPatient.t0_timestamp ? formatDateTime(currentPatient.t0_timestamp) : 'Chưa thiết lập'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.t0ChangeBtn}
                  onPress={handleOpenT0Modal}
                  activeOpacity={0.7}
                >
                  <Ionicons name="calendar-outline" size={14} color="#0284C7" style={{ marginRight: 4 }} />
                  <Text style={styles.t0ChangeBtnText}>
                    {currentPatient.t0_timestamp ? 'Đổi T0' : 'Chọn T0'}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.t0CardSubtext}>
                T0 là thời điểm kết thúc phẫu thuật hoặc lần đo ban đầu, dùng làm gốc chuẩn để theo dõi các mốc T1, T6, T12, T24...
              </Text>

              {/* Chi tiết đánh giá VAS mốc T0 nếu đã có */}
              {hasT0Assessed && latestT0 && (
                <View style={styles.t0AssessedBox}>
                  <View style={styles.tpScoreRow}>
                    <Text style={styles.tpScoreLabel}>Điểm VAS mốc T0 gần nhất:</Text>
                    <Text style={styles.tpScoreValue}>
                      {(latestT0.vas_score ?? latestT0.eVAS_score)?.toFixed(1)} mm
                    </Text>
                  </View>

                  {/* Phân loại mức độ đau */}
                  {(() => {
                    const scoreVal = latestT0.vas_score ?? latestT0.eVAS_score ?? 0;
                    const cat = getPainCategory(scoreVal);
                    return (
                      <View style={[styles.painCategoryMiniPill, { backgroundColor: cat.bg }]}>
                        <Text style={[styles.painCategoryMiniText, { color: cat.color }]}>
                          Mức độ: {cat.label}
                        </Text>
                      </View>
                    );
                  })()}

                  <View style={styles.tpTimeRow}>
                    <Ionicons name="time-outline" size={13} color="#64748B" />
                    <Text style={styles.tpTimeText}>
                      Thời điểm đo thực tế: {formatDateTime(latestT0.actual_timestamp || latestT0.submit_timestamp)}
                    </Text>
                  </View>

                  {/* Lịch sử nếu đo nhiều lần T0 */}
                  {t0Assessments.length > 1 && (
                    <View style={styles.multipleRecordsBox}>
                      <Text style={styles.multipleRecordsTitle}>
                        Lịch sử các lần đánh giá mốc T0:
                      </Text>
                      {t0Assessments.map((item, idx) => (
                        <View key={item.assessment_id} style={styles.recordItemRow}>
                          <Text style={styles.recordIndexText}>Lần {t0Assessments.length - idx}:</Text>
                          <Text style={styles.recordScoreText}>
                            VAS {(item.vas_score ?? item.eVAS_score)?.toFixed(1)} mm
                          </Text>
                          <Text style={styles.recordTimeText}>
                            — {formatDateTime(item.actual_timestamp || item.submit_timestamp)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Nút hành động đánh giá VAS cho mốc T0 */}
              <View style={styles.t0MeasureActionRow}>
                <TouchableOpacity
                  style={[
                    styles.measureActionBtn,
                    hasT0Assessed ? styles.measureActionBtnAdd : styles.measureActionBtnNew,
                  ]}
                  onPress={() => {
                    if (!currentPatient.t0_timestamp) {
                      handleOpenT0Modal();
                    } else {
                      onStartAssessmentForTimepoint('T0');
                    }
                  }}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name={hasT0Assessed ? 'add-circle-outline' : 'play-circle-outline'}
                    size={18}
                    color={hasT0Assessed ? '#0369A1' : '#FFFFFF'}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.measureActionBtnText,
                      hasT0Assessed ? styles.measureActionBtnTextAdd : styles.measureActionBtnTextNew,
                    ]}
                  >
                    {hasT0Assessed ? 'Đánh giá thêm mốc T0' : 'Đánh giá VAS mốc T0 ngay'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })()}

        {/* 4.2. CÁC MỐC ĐÁNH GIÁ ĐAU (DO BÁC SĨ THIẾT LẬP HOẶC MẶC ĐỊNH) */}
        <View style={styles.timepointsSection}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="analytics" size={18} color="#0F172A" />
              <Text style={styles.sectionTitle}>CÁC MỐC ĐÁNH GIÁ ĐAU SAU MỔ</Text>
            </View>

            <TouchableOpacity
              style={styles.manageTBtn}
              onPress={() => setIsTimepointModalOpen(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="options-outline" size={15} color="#0284C7" style={{ marginRight: 4 }} />
              <Text style={styles.manageTBtnText}>Thiết lập mốc T</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionSubtitle}>
            Bác sĩ có thể tự do bấm &quot;Thiết lập mốc T&quot; để thêm hoặc sửa các mốc. Bấm vào mốc để mở thang VAS.
          </Text>

          {loading ? (
            <View style={styles.centerLoadingBox}>
              <ActivityIndicator size="small" color="#0284C7" />
              <Text style={styles.loadingText}>Đang tải các mốc đánh giá...</Text>
            </View>
          ) : (
            <View style={styles.timepointCardsList}>
              {currentTimepoints
                .filter((tp) => tp.key.replace('h', '').toUpperCase() !== 'T0')
                .map((tpConfig: TimepointConfigItem) => {
                const listForTp = assessmentsByTimepoint[tpConfig.key.toUpperCase()] || [];
                const hasAssessed = listForTp.length > 0;
                const latest = hasAssessed ? listForTp[0] : null;

                return (
                  <View key={tpConfig.key} style={styles.tpCard}>
                    {/* Hàng Tiêu đề Mốc */}
                    <View style={styles.tpCardHeader}>
                      <View style={styles.tpPillContainer}>
                        <View style={[styles.tpBadge, hasAssessed ? styles.tpBadgeDone : styles.tpBadgePending]}>
                          <Text style={[styles.tpBadgeText, hasAssessed ? styles.tpBadgeTextDone : styles.tpBadgeTextPending]}>
                            {tpConfig.label}
                          </Text>
                        </View>
                        <Text style={styles.tpDescriptionText}>{tpConfig.description}</Text>
                      </View>

                      {hasAssessed ? (
                        <View style={styles.statusTagDone}>
                          <Ionicons name="checkmark-circle" size={14} color="#059669" />
                          <Text style={styles.statusTagDoneText}>Đã đánh giá ({listForTp.length})</Text>
                        </View>
                      ) : (
                        <View style={styles.statusTagPending}>
                          <Ionicons name="ellipse-outline" size={12} color="#64748B" />
                          <Text style={styles.statusTagPendingText}>Chưa đánh giá</Text>
                        </View>
                      )}
                    </View>

                    {/* Chi tiết đánh giá nếu đã có */}
                    {hasAssessed && latest && (
                      <View style={styles.tpAssessedSummaryBox}>
                        <View style={styles.tpScoreRow}>
                          <Text style={styles.tpScoreLabel}>Điểm VAS gần nhất:</Text>
                          <Text style={styles.tpScoreValue}>
                            {(latest.vas_score ?? latest.eVAS_score)?.toFixed(1)} mm
                          </Text>
                        </View>
                        <View style={styles.tpTimeRow}>
                          <Ionicons name="time-outline" size={13} color="#64748B" />
                          <Text style={styles.tpTimeText}>
                            Giờ thực tế: {formatDateTime(latest.actual_timestamp || latest.submit_timestamp)}
                          </Text>
                        </View>

                        {/* Nếu có nhiều bản ghi cho cùng mốc này */}
                        {listForTp.length > 1 && (
                          <View style={styles.multipleRecordsBox}>
                            <Text style={styles.multipleRecordsTitle}>
                              Lịch sử các lần đánh giá mốc {tpConfig.label}:
                            </Text>
                            {listForTp.map((item, idx) => (
                              <View key={item.assessment_id} style={styles.recordItemRow}>
                                <Text style={styles.recordIndexText}>Lần {listForTp.length - idx}:</Text>
                                <Text style={styles.recordScoreText}>
                                  VAS {(item.vas_score ?? item.eVAS_score)?.toFixed(1)} mm
                                </Text>
                                <Text style={styles.recordTimeText}>
                                  — {formatDateTime(item.actual_timestamp || item.submit_timestamp)}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    )}

                    {/* Nút hành động đánh giá */}
                    <View style={styles.tpActionRow}>
                      <TouchableOpacity
                        style={[styles.measureActionBtn, hasAssessed ? styles.measureActionBtnAdd : styles.measureActionBtnNew]}
                        onPress={() => onStartAssessmentForTimepoint(tpConfig.key)}
                        activeOpacity={0.85}
                      >
                        <Ionicons
                          name={hasAssessed ? 'add-circle-outline' : 'play-circle-outline'}
                          size={18}
                          color={hasAssessed ? '#0369A1' : '#FFFFFF'}
                          style={{ marginRight: 6 }}
                        />
                        <Text style={[styles.measureActionBtnText, hasAssessed ? styles.measureActionBtnTextAdd : styles.measureActionBtnTextNew]}>
                          {hasAssessed ? `Đánh giá thêm mốc ${tpConfig.label}` : `Đánh giá VAS mốc ${tpConfig.label}`}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modal Chỉnh sửa thông tin cơ bản bệnh nhân */}
      <Modal visible={isEditModalOpen} transparent={true} animationType="fade" onRequestClose={() => setIsEditModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.editCard}>
            <View style={styles.editCardHeader}>
              <Text style={styles.editCardTitle}>Chỉnh sửa thông tin bệnh nhân</Text>
              <TouchableOpacity onPress={() => setIsEditModalOpen(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.editCardBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Mã số bệnh án (MSBA):</Text>
                <TextInput style={[styles.inputField, { backgroundColor: '#F1F5F9' }]} value={msba} editable={false} />
                <Text style={styles.hintText}>* MSBA là mã định danh cố định không thay đổi.</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Họ và tên bệnh nhân:</Text>
                <TextInput
                  style={styles.inputField}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Nhập họ và tên..."
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Năm sinh:</Text>
                <TextInput
                  style={styles.inputField}
                  value={editBirthYear}
                  onChangeText={(val) => setEditBirthYear(val.replace(/[^0-9]/g, ''))}
                  placeholder="VD: 1985"
                  keyboardType="number-pad"
                  maxLength={4}
                />
              </View>
            </View>

            <View style={styles.editCardActions}>
              <TouchableOpacity style={styles.cancelActionBtn} onPress={() => setIsEditModalOpen(false)}>
                <Text style={styles.cancelActionBtnText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveActionBtn, isSavingEdit && { opacity: 0.6 }]}
                onPress={handleSaveEdit}
                disabled={isSavingEdit}
              >
                {isSavingEdit ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveActionBtnText}>Lưu thay đổi</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Chọn thời điểm tham chiếu T0 & Đánh giá VAS */}
      <Modal
        visible={isT0ModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsT0ModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.t0ModalCard}>
            {/* Header */}
            <View style={styles.editCardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="time" size={22} color="#0284C7" />
                <Text style={styles.editCardTitle}>Lựa chọn thời điểm T0</Text>
              </View>
              <TouchableOpacity onPress={() => setIsT0ModalOpen(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView bounces={false} style={{ maxHeight: 520 }}>
              <View style={styles.editCardBody}>
                <Text style={styles.t0ExplainText}>
                  Chọn thời điểm kết thúc phẫu thuật hoặc lần đo ban đầu. Các mốc T1, T6, T12, T24 sẽ được tham chiếu từ mốc T0 này.
                </Text>

                {/* Chọn nhanh mốc thời gian (Quick presets) */}
                <Text style={styles.pickerSectionLabel}>Chọn nhanh mốc thời gian:</Text>
                <View style={styles.quickPresetRow}>
                  <TouchableOpacity
                    style={styles.quickPresetChip}
                    onPress={handleSetT0Now}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="flash-outline" size={13} color="#0284C7" style={{ marginRight: 3 }} />
                    <Text style={styles.quickPresetChipText}>Hiện tại</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.quickPresetChip}
                    onPress={() => handleOffsetMinutesFromNow(15)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.quickPresetChipText}>-15 phút</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.quickPresetChip}
                    onPress={() => handleOffsetMinutesFromNow(30)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.quickPresetChipText}>-30 phút</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.quickPresetChip}
                    onPress={() => handleOffsetMinutesFromNow(60)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.quickPresetChipText}>-1 giờ</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.quickPresetChip}
                    onPress={() => handleOffsetMinutesFromNow(120)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.quickPresetChipText}>-2 giờ</Text>
                  </TouchableOpacity>
                </View>

                {/* Bộ chỉnh GIỜ & PHÚT */}
                <Text style={styles.pickerSectionLabel}>Điều chỉnh Giờ & Phút:</Text>
                <View style={styles.timeAdjustBox}>
                  {/* GIỜ */}
                  <View style={styles.adjustUnitCol}>
                    <Text style={styles.adjustUnitLabel}>GIỜ (0 - 23)</Text>
                    <View style={styles.stepperRow}>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => handleAdjustHour(-1)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="remove" size={18} color="#0284C7" />
                      </TouchableOpacity>
                      <TextInput
                        style={styles.stepperInput}
                        value={String(t0Hour).padStart(2, '0')}
                        onChangeText={(val) => {
                          const n = parseInt(val.replace(/[^0-9]/g, ''), 10);
                          if (!isNaN(n)) setT0Hour(Math.min(23, Math.max(0, n)));
                          else if (val === '') setT0Hour(0);
                        }}
                        keyboardType="number-pad"
                        maxLength={2}
                      />
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => handleAdjustHour(1)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="add" size={18} color="#0284C7" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={styles.timeColonSeparator}>:</Text>

                  {/* PHÚT */}
                  <View style={styles.adjustUnitCol}>
                    <Text style={styles.adjustUnitLabel}>PHÚT (0 - 59)</Text>
                    <View style={styles.stepperRow}>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => handleAdjustMinute(-5)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="remove" size={18} color="#0284C7" />
                      </TouchableOpacity>
                      <TextInput
                        style={styles.stepperInput}
                        value={String(t0Minute).padStart(2, '0')}
                        onChangeText={(val) => {
                          const n = parseInt(val.replace(/[^0-9]/g, ''), 10);
                          if (!isNaN(n)) setT0Minute(Math.min(59, Math.max(0, n)));
                          else if (val === '') setT0Minute(0);
                        }}
                        keyboardType="number-pad"
                        maxLength={2}
                      />
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => handleAdjustMinute(5)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="add" size={18} color="#0284C7" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* Bộ chỉnh NGÀY, THÁNG, NĂM */}
                <Text style={styles.pickerSectionLabel}>Ngày / Tháng / Năm:</Text>
                <View style={styles.dateAdjustRow}>
                  <View style={styles.dateUnitCol}>
                    <Text style={styles.adjustUnitLabel}>Ngày</Text>
                    <View style={styles.stepperRowSmall}>
                      <TouchableOpacity
                        style={styles.stepperBtnSmall}
                        onPress={() => handleAdjustDay(-1)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="remove" size={14} color="#0284C7" />
                      </TouchableOpacity>
                      <TextInput
                        style={styles.stepperInputSmall}
                        value={String(t0Day).padStart(2, '0')}
                        onChangeText={(val) => {
                          const n = parseInt(val.replace(/[^0-9]/g, ''), 10);
                          if (!isNaN(n)) setT0Day(Math.min(31, Math.max(1, n)));
                          else if (val === '') setT0Day(1);
                        }}
                        keyboardType="number-pad"
                        maxLength={2}
                      />
                      <TouchableOpacity
                        style={styles.stepperBtnSmall}
                        onPress={() => handleAdjustDay(1)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="add" size={14} color="#0284C7" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.dateUnitCol}>
                    <Text style={styles.adjustUnitLabel}>Tháng</Text>
                    <TextInput
                      style={styles.stepperInputSmallSolo}
                      value={String(t0Month).padStart(2, '0')}
                      onChangeText={(val) => {
                        const n = parseInt(val.replace(/[^0-9]/g, ''), 10);
                        if (!isNaN(n)) setT0Month(Math.min(12, Math.max(1, n)));
                        else if (val === '') setT0Month(1);
                      }}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                  </View>

                  <View style={styles.dateUnitColWide}>
                    <Text style={styles.adjustUnitLabel}>Năm</Text>
                    <TextInput
                      style={styles.stepperInputSmallSolo}
                      value={String(t0Year)}
                      onChangeText={(val) => {
                        const n = parseInt(val.replace(/[^0-9]/g, ''), 10);
                        if (!isNaN(n)) setT0Year(n);
                        else if (val === '') setT0Year(new Date().getFullYear());
                      }}
                      keyboardType="number-pad"
                      maxLength={4}
                    />
                  </View>
                </View>

                {/* Nút chọn nhanh Hôm nay / Hôm qua */}
                <View style={styles.dateQuickRow}>
                  <TouchableOpacity
                    style={styles.dateQuickBtn}
                    onPress={handleSetToday}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.dateQuickBtnText}>Hôm nay</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dateQuickBtn}
                    onPress={handleSetYesterday}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.dateQuickBtnText}>Hôm qua</Text>
                  </TouchableOpacity>
                </View>

                {/* Hộp xem trước thời gian đã chọn */}
                <View style={styles.previewBox}>
                  <View style={styles.previewTopRow}>
                    <Ionicons name="calendar" size={18} color="#0284C7" />
                    <Text style={styles.previewTitle}>Thời điểm T0 đã chọn:</Text>
                  </View>
                  <Text style={styles.previewDateTimeText}>
                    {String(t0Hour).padStart(2, '0')}:{String(t0Minute).padStart(2, '0')}{'  '}
                    {String(t0Day).padStart(2, '0')}/{String(t0Month).padStart(2, '0')}/{t0Year}
                  </Text>
                  {t0DiffText ? (
                    <Text style={styles.previewDiffText}>({t0DiffText})</Text>
                  ) : null}
                </View>
              </View>
            </ScrollView>

            {/* Các nút hành động */}
            <View style={styles.t0ModalActions}>
              {/* Nút chính: XÁC NHẬN T0 & ĐÁNH GIÁ VAS NGAY */}
              <TouchableOpacity
                style={[styles.t0ConfirmAndMeasureBtn, isSavingT0 && { opacity: 0.6 }]}
                onPress={() => handleSaveT0(true)}
                disabled={isSavingT0}
                activeOpacity={0.85}
              >
                {isSavingT0 ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="play-circle" size={19} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.t0ConfirmAndMeasureBtnText}>
                      XÁC NHẬN T0 & ĐÁNH GIÁ VAS NGAY
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.t0SecondaryActionRow}>
                <TouchableOpacity
                  style={styles.t0SaveOnlyBtn}
                  onPress={() => handleSaveT0(false)}
                  disabled={isSavingT0}
                  activeOpacity={0.7}
                >
                  <Ionicons name="save-outline" size={16} color="#0369A1" style={{ marginRight: 4 }} />
                  <Text style={styles.t0SaveOnlyBtnText}>Chỉ lưu mốc T0</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelActionBtn}
                  onPress={() => setIsT0ModalOpen(false)}
                  disabled={isSavingT0}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelActionBtnText}>Đóng</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Thiết lập mốc T tùy chỉnh của Bác sĩ */}
      <TimepointConfigModal
        visible={isTimepointModalOpen}
        onClose={() => setIsTimepointModalOpen(false)}
        initialTimepoints={currentTimepoints}
        patientName={currentPatient.patient_name || currentPatient.study_id}
        onSaveForPatient={handleSaveTimepointsForPatient}
        onSaveAsGlobalDefault={handleSaveGlobalTimepoints}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: Platform.OS === 'ios' ? 44 : 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginLeft: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 4,
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerSettingsBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  refreshBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F0F9FF',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
    gap: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  manageTBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  manageTBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
  patientInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  patientCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  patientNameHeader: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  patientMsbaHeader: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  boldText: {
    fontWeight: '800',
    color: '#0284C7',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
  patientMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  metaItem: {
    flex: 1,
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  metaDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
  t0Card: {
    backgroundColor: '#F0F9FF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  t0BadgePending: {
    backgroundColor: '#E0F2FE',
  },
  t0BadgeTextPending: {
    color: '#0369A1',
  },
  t0CardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  t0TimeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    marginTop: 4,
    marginBottom: 4,
  },
  t0TimeTextCol: {
    flex: 1,
    marginRight: 8,
  },
  t0TimeBoxLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 2,
  },
  t0TimeBoxValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0369A1',
  },
  t0ChangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#7DD3FC',
  },
  t0ChangeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
  t0CardSubtext: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
    marginTop: 2,
    marginBottom: 4,
  },
  t0AssessedBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    gap: 4,
  },
  painCategoryMiniPill: {
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginVertical: 2,
  },
  painCategoryMiniText: {
    fontSize: 11,
    fontWeight: '700',
  },
  t0MeasureActionRow: {
    marginTop: 8,
  },
  timepointsSection: {
    marginTop: 4,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.3,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
  },
  centerLoadingBox: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 12,
    color: '#64748B',
  },
  timepointCardsList: {
    gap: 12,
  },
  tpCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  tpCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  tpPillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tpBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  tpBadgeDone: {
    backgroundColor: '#DCFCE7',
  },
  tpBadgePending: {
    backgroundColor: '#F1F5F9',
  },
  tpBadgeText: {
    fontSize: 14,
    fontWeight: '900',
  },
  tpBadgeTextDone: {
    color: '#15803D',
  },
  tpBadgeTextPending: {
    color: '#64748B',
  },
  tpDescriptionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  statusTagDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  statusTagDoneText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  statusTagPending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusTagPendingText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  tpAssessedSummaryBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 4,
  },
  tpScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tpScoreLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  tpScoreValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#D92D20',
  },
  tpTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tpTimeText: {
    fontSize: 11,
    color: '#64748B',
  },
  multipleRecordsBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 4,
  },
  multipleRecordsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 2,
  },
  recordItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recordIndexText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  recordScoreText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  recordTimeText: {
    fontSize: 10,
    color: '#64748B',
  },
  tpActionRow: {
    marginTop: 2,
  },
  measureActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  measureActionBtnNew: {
    backgroundColor: '#0284C7',
  },
  measureActionBtnAdd: {
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  measureActionBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  measureActionBtnTextNew: {
    color: '#FFFFFF',
  },
  measureActionBtnTextAdd: {
    color: '#0369A1',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  editCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    elevation: 6,
  },
  editCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  editCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  editCardBody: {
    gap: 12,
    marginBottom: 18,
  },
  inputGroup: {
    gap: 5,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  inputField: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#0F172A',
  },
  hintText: {
    fontSize: 10,
    color: '#94A3B8',
  },
  editCardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelActionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  cancelActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  saveActionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: '#0284C7',
    minWidth: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveActionBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  t0ExplainText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
    marginBottom: 14,
  },
  t0ModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    width: '100%',
    maxWidth: 440,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  pickerSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginTop: 4,
    marginBottom: 4,
  },
  quickPresetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  quickPresetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  quickPresetChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  timeAdjustBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
    marginBottom: 10,
  },
  adjustUnitCol: {
    alignItems: 'center',
  },
  adjustUnitLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperInput: {
    width: 48,
    height: 38,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  timeColonSeparator: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0284C7',
    marginTop: 12,
  },
  dateAdjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  dateUnitCol: {
    flex: 1,
    alignItems: 'center',
  },
  dateUnitColWide: {
    width: 80,
    alignItems: 'center',
  },
  stepperRowSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  stepperBtnSmall: {
    width: 26,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperInputSmall: {
    width: 36,
    height: 32,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  stepperInputSmallSolo: {
    width: '100%',
    height: 32,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  dateQuickRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  dateQuickBtn: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  dateQuickBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  previewBox: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    alignItems: 'center',
    gap: 3,
    marginBottom: 4,
  },
  previewTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  previewTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369A1',
  },
  previewDateTimeText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0C4A6E',
    letterSpacing: 0.5,
  },
  previewDiffText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0284C7',
  },
  t0ModalActions: {
    marginTop: 12,
    gap: 8,
  },
  t0ConfirmAndMeasureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284C7',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  t0ConfirmAndMeasureBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  t0SecondaryActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  t0SaveOnlyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  t0SaveOnlyBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0369A1',
  },
});
