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

  // Manual T0 modal
  const [isT0ModalOpen, setIsT0ModalOpen] = useState<boolean>(false);
  const [t0InputTime, setT0InputTime] = useState<string>('');

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

  // Thiết lập T0 tham chiếu
  const handleSetT0Now = async () => {
    const nowIso = new Date().toISOString();
    const updated: Patient = {
      ...currentPatient,
      t0_timestamp: nowIso,
    };
    await FirebaseService.savePatient(updated, currentUser);
    setCurrentPatient(updated);
    setIsT0ModalOpen(false);
    if (onPatientUpdated) onPatientUpdated(updated);
    Alert.alert('Đã thiết lập', 'Đã ghi nhận mốc tham chiếu T0 là thời điểm hiện tại.');
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

        {/* 5.3. MỤC THỜI ĐIỂM THAM CHIẾU T0 */}
        <View style={styles.t0Card}>
          <View style={styles.t0HeaderRow}>
            <View style={styles.t0TitleRow}>
              <Ionicons name="time" size={18} color="#0369A1" />
              <Text style={styles.t0SectionTitle}>Thời điểm tham chiếu T0</Text>
            </View>
            <TouchableOpacity
              style={styles.t0ActionBtn}
              onPress={() => setIsT0ModalOpen(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.t0ActionBtnText}>
                {currentPatient.t0_timestamp ? 'Đổi T0' : 'Thiết lập T0'}
              </Text>
            </TouchableOpacity>
          </View>

          {currentPatient.t0_timestamp ? (
            <View style={styles.t0EstablishedBox}>
              <Text style={styles.t0EstablishedText}>
                Mốc T0 gốc: <Text style={styles.boldDarkText}>{formatDateTime(currentPatient.t0_timestamp)}</Text>
              </Text>
              <Text style={styles.t0EstablishedSubtext}>
                T0 được giữ cố định làm mốc tham chiếu cho toàn bộ đợt theo dõi.
              </Text>
            </View>
          ) : (
            <View style={styles.t0PendingBox}>
              <Text style={styles.t0PendingText}>Chưa thiết lập T0</Text>
              <Text style={styles.t0PendingSubtext}>
                Mốc T0 sẽ tự động xác lập từ lần đánh giá VAS đầu tiên lưu thành công, hoặc bạn có thể thiết lập thủ công.
              </Text>
            </View>
          )}
        </View>

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
              {currentTimepoints.map((tpConfig: TimepointConfigItem) => {
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

      {/* Modal Thiết lập T0 */}
      <Modal visible={isT0ModalOpen} transparent={true} animationType="fade" onRequestClose={() => setIsT0ModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.editCard}>
            <View style={styles.editCardHeader}>
              <Text style={styles.editCardTitle}>Thiết lập mốc tham chiếu T0</Text>
              <TouchableOpacity onPress={() => setIsT0ModalOpen(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.editCardBody}>
              <Text style={styles.t0ExplainText}>
                Mốc T0 là thời điểm phẫu thuật xong hoặc lần đánh giá đầu tiên. Mọi mốc thời gian T1, T6, T12, T24 sẽ được tham chiếu từ T0 này.
              </Text>

              <TouchableOpacity style={styles.setNowBtn} onPress={handleSetT0Now} activeOpacity={0.85}>
                <Ionicons name="time" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.setNowBtnText}>Lấy thời điểm hiện tại làm T0</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.editCardActions}>
              <TouchableOpacity style={styles.cancelActionBtn} onPress={() => setIsT0ModalOpen(false)}>
                <Text style={styles.cancelActionBtnText}>Đóng</Text>
              </TouchableOpacity>
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
  t0HeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  t0TitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  t0SectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0369A1',
  },
  t0ActionBtn: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#7DD3FC',
  },
  t0ActionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369A1',
  },
  t0EstablishedBox: {
    gap: 3,
  },
  t0EstablishedText: {
    fontSize: 13,
    color: '#0F172A',
  },
  boldDarkText: {
    fontWeight: '800',
    color: '#0369A1',
  },
  t0EstablishedSubtext: {
    fontSize: 11,
    color: '#64748B',
  },
  t0PendingBox: {
    gap: 3,
  },
  t0PendingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#D97706',
  },
  t0PendingSubtext: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
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
    marginBottom: 16,
  },
  setNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284C7',
    paddingVertical: 12,
    borderRadius: 10,
  },
  setNowBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
