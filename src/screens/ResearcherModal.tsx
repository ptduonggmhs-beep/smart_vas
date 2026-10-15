import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Share,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Assessment, Patient, AppUser } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { AuthService } from '../services/authService';

interface ResearcherModalProps {
  visible: boolean;
  onClose: () => void;
  currentUser: AppUser | null;
  onUserChanged: (user: AppUser | null) => void;
}

export const ResearcherModal: React.FC<ResearcherModalProps> = ({
  visible,
  onClose,
  currentUser,
  onUserChanged,
}) => {
  const [activeTab, setActiveTab] = useState<'assessments' | 'patients'>('assessments');
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [filterStudyId, setFilterStudyId] = useState<string>('');
  const [filterPatientId, setFilterPatientId] = useState<string>('');
  const [patientViewMode, setPatientViewMode] = useState<'list' | 'form'>('list');
  const [syncing, setSyncing] = useState<boolean>(false);

  // Authentication State
  const [loginMethod, setLoginMethod] = useState<'pin' | 'email'>('pin');
  const [pinInput, setPinInput] = useState<string>('');
  const [emailInput, setEmailInput] = useState<string>('ncv@smartvas.vn');
  const [passwordInput, setPasswordInput] = useState<string>('ncv123456');
  const [authError, setAuthError] = useState<string>('');
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);

  // Form thêm/sửa sản phụ
  const [newStudyId, setNewStudyId] = useState<string>('');
  const [newAge, setNewAge] = useState<string>('');
  const [newPara, setNewPara] = useState<string>('');
  const [newAnesthesia, setNewAnesthesia] = useState<string>('');
  const [newDrugs, setNewDrugs] = useState<string>('');
  const [newPaperVas, setNewPaperVas] = useState<string>('');

  const isAuthorized = AuthService.isNCVorHigher(currentUser);

  const loadData = async () => {
    if (!isAuthorized) return;
    setLoading(true);
    try {
      const [allAssessments, allPatients] = await Promise.all([
        FirebaseService.getAllAssessments(),
        FirebaseService.getAllPatients(),
      ]);
      setAssessments(allAssessments);
      setPatients(allPatients);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && isAuthorized) {
      loadData();
    }
    setAuthError('');
  }, [visible, isAuthorized]);

  const handleLogin = async () => {
    setAuthError('');
    setIsAuthenticating(true);

    let res;
    if (loginMethod === 'pin') {
      if (!pinInput.trim()) {
        setAuthError('Vui lòng nhập mã PIN NCV.');
        setIsAuthenticating(false);
        return;
      }
      res = await AuthService.loginNCV(pinInput.trim());
    } else {
      if (!emailInput.trim() || !passwordInput.trim()) {
        setAuthError('Vui lòng nhập đầy đủ Email và Mật khẩu.');
        setIsAuthenticating(false);
        return;
      }
      res = await AuthService.loginNCV(emailInput.trim(), passwordInput.trim());
    }

    setIsAuthenticating(false);

    if (res.success && res.user) {
      onUserChanged(res.user);
      setPinInput('');
      Alert.alert('Xác thực thành công', `Chào mừng ${res.user.name} (${res.user.title})`);
    } else {
      setAuthError(res.error || 'Xác thực thất bại');
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Xác nhận đăng xuất',
      'Bạn có chắc chắn muốn đăng xuất khỏi phiên làm việc của Nghiên cứu viên?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đăng xuất',
          style: 'destructive',
          onPress: async () => {
            await AuthService.logout();
            onUserChanged(null);
            onClose();
          },
        },
      ]
    );
  };

  const handleSyncOffline = async () => {
    setSyncing(true);
    const result = await FirebaseService.syncOfflineData();
    setSyncing(false);
    Alert.alert(
      'Đồng bộ dữ liệu',
      `Tổng số bản ghi cần gửi: ${result.total}\nThành công: ${result.synced}\nThất bại: ${result.failed}`
    );
    loadData();
  };

  const handleExportCSV = async () => {
    if (assessments.length === 0) {
      Alert.alert('Chưa có dữ liệu', 'Không có bản ghi đánh giá nào để xuất CSV.');
      return;
    }
    const csvData = FirebaseService.exportToCSV(assessments);
    try {
      if (Platform.OS === 'web') {
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `smart_vas_data_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        await Share.share({
          title: 'Xuất dữ liệu nghiên cứu Smart-VAS',
          message: csvData,
        });
      }
    } catch (e: any) {
      Alert.alert('Lỗi xuất dữ liệu', e?.message);
    }
  };

  const handleAddNewPatient = () => {
    setNewStudyId('');
    setNewAge('');
    setNewPara('');
    setNewAnesthesia('');
    setNewDrugs('');
    setNewPaperVas('');
    setPatientViewMode('form');
  };

  const handleEditPatient = (p: Patient) => {
    setNewStudyId(p.study_id);
    setNewAge(p.age !== null && p.age !== undefined ? String(p.age) : '');
    setNewPara(p.para || '');
    setNewAnesthesia(p.anesthesia_method || '');
    setNewDrugs(p.analgesia_drugs || '');
    setNewPaperVas(p.paper_vas_score !== null && p.paper_vas_score !== undefined ? String(p.paper_vas_score) : '');
    setPatientViewMode('form');
  };

  const handleSavePatient = async () => {
    if (!newStudyId.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập Mã nghiên cứu (study_id).');
      return;
    }
    const patientData: Patient = {
      study_id: newStudyId.trim().toUpperCase(),
      age: newAge ? parseInt(newAge) : null,
      para: newPara || null,
      anesthesia_method: newAnesthesia || null,
      analgesia_drugs: newDrugs || null,
      paper_vas_score: newPaperVas ? parseFloat(newPaperVas) : null,
      created_at: new Date().toISOString(),
    };

    setLoading(true);
    const res = await FirebaseService.savePatient(patientData);
    setLoading(false);

    if (res.success) {
      Alert.alert('Thành công', `Đã lưu hồ sơ sản phụ ${patientData.study_id}`);
      setNewStudyId('');
      setPatientViewMode('list');
      loadData();
    } else {
      Alert.alert('Đã lưu cục bộ', `Đã lưu vào bộ nhớ máy (${res.error})`);
      setPatientViewMode('list');
      loadData();
    }
  };

  const filteredAssessments = filterStudyId.trim()
    ? assessments.filter((a) => a.study_id.toUpperCase().includes(filterStudyId.trim().toUpperCase()))
    : assessments;

  const filteredPatients = filterPatientId.trim()
    ? patients.filter((p) => p.study_id.toUpperCase().includes(filterPatientId.trim().toUpperCase()))
    : patients;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        {/* Modal Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>Góc Nghiên Cứu Viên (NCV)</Text>
              {currentUser && (
                <View
                  style={[
                    styles.roleBadge,
                    currentUser.role === 'admin' ? styles.roleBadgeAdmin : styles.roleBadgeNCV,
                  ]}
                >
                  <Text
                    style={[
                      styles.roleBadgeText,
                      currentUser.role === 'admin' ? styles.roleTextAdmin : styles.roleTextNCV,
                    ]}
                  >
                    {currentUser.role.toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.headerSubtitle}>
              {currentUser ? currentUser.name : 'Quản lý dữ liệu lâm sàng & Firebase'}
            </Text>
          </View>

          <View style={styles.headerActions}>
            {currentUser && (
              <TouchableOpacity
                style={styles.logoutBtn}
                onPress={handleLogout}
                activeOpacity={0.7}
              >
                <Ionicons name="log-out-outline" size={18} color="#DC2626" />
                <Text style={styles.logoutBtnText}>Đăng xuất</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#334155" />
            </TouchableOpacity>
          </View>
        </View>

        {/* --- CASE 1: UN-AUTHENTICATED (Yêu cầu đăng nhập quyền NCV) --- */}
        {!isAuthorized ? (
          <ScrollView contentContainerStyle={styles.authContainer} bounces={false}>
            <View style={styles.authLockCircle}>
              <Ionicons name="shield-checkmark" size={44} color="#0284C7" />
            </View>

            <Text style={styles.authTitle}>Xác thực Quyền Nghiên Cứu Viên</Text>
            <Text style={styles.authDescription}>
              Chỉ tài khoản có quyền NCV trở lên mới được phép xem dữ liệu lâm sàng và thay đổi cấu hình đề tài.
            </Text>

            {/* Switch Auth Method (PIN vs Email) */}
            <View style={styles.authTabSwitch}>
              <TouchableOpacity
                style={[styles.authTabBtn, loginMethod === 'pin' && styles.authTabBtnActive]}
                onPress={() => {
                  setLoginMethod('pin');
                  setAuthError('');
                }}
              >
                <Ionicons
                  name="keypad-outline"
                  size={16}
                  color={loginMethod === 'pin' ? '#0284C7' : '#64748B'}
                />
                <Text
                  style={[
                    styles.authTabText,
                    loginMethod === 'pin' && styles.authTabTextActive,
                  ]}
                >
                  Mã PIN nhanh (4 số)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.authTabBtn, loginMethod === 'email' && styles.authTabBtnActive]}
                onPress={() => {
                  setLoginMethod('email');
                  setAuthError('');
                }}
              >
                <Ionicons
                  name="mail-outline"
                  size={16}
                  color={loginMethod === 'email' ? '#0284C7' : '#64748B'}
                />
                <Text
                  style={[
                    styles.authTabText,
                    loginMethod === 'email' && styles.authTabTextActive,
                  ]}
                >
                  Email & Mật khẩu
                </Text>
              </TouchableOpacity>
            </View>

            {/* Error Message if any */}
            {authError ? (
              <View style={styles.authErrorBox}>
                <Ionicons name="alert-circle" size={18} color="#DC2626" />
                <Text style={styles.authErrorText}>{authError}</Text>
              </View>
            ) : null}

            {/* Method 1: Quick PIN Login */}
            {loginMethod === 'pin' ? (
              <View style={styles.formCard}>
                <Text style={styles.inputLabel}>Nhập mã PIN của bạn:</Text>
                <TextInput
                  style={styles.pinInput}
                  value={pinInput}
                  onChangeText={setPinInput}
                  placeholder="• • • •"
                  keyboardType="numeric"
                  secureTextEntry
                  maxLength={6}
                  textAlign="center"
                />

                <Text style={styles.quickPresetTitle}>Chọn nhanh mã PIN demo nghiên cứu:</Text>
                <View style={styles.quickPresetRow}>
                  <TouchableOpacity
                    style={styles.quickPresetChip}
                    onPress={() => setPinInput('8888')}
                  >
                    <Ionicons name="person" size={14} color="#0284C7" />
                    <Text style={styles.quickPresetText}>NCV Lâm sàng (PIN: 8888)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.quickPresetChip, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}
                    onPress={() => setPinInput('9999')}
                  >
                    <Ionicons name="shield" size={14} color="#D97706" />
                    <Text style={[styles.quickPresetText, { color: '#B45309' }]}>
                      Chủ nhiệm / Admin (PIN: 9999)
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* Method 2: Email & Password Login */
              <View style={styles.formCard}>
                <Text style={styles.inputLabel}>Email Nghiên cứu viên:</Text>
                <TextInput
                  style={styles.emailInput}
                  value={emailInput}
                  onChangeText={setEmailInput}
                  placeholder="ncv@smartvas.vn"
                  autoCapitalize="none"
                  keyboardType="email-address"
                />

                <Text style={[styles.inputLabel, { marginTop: 12 }]}>Mật khẩu:</Text>
                <TextInput
                  style={styles.emailInput}
                  value={passwordInput}
                  onChangeText={setPasswordInput}
                  placeholder="Mật khẩu"
                  secureTextEntry
                />

                <Text style={styles.quickPresetTitle}>Tài khoản mẫu:</Text>
                <View style={styles.quickPresetRow}>
                  <TouchableOpacity
                    style={styles.quickPresetChip}
                    onPress={() => {
                      setEmailInput('ncv@smartvas.vn');
                      setPasswordInput('ncv123456');
                    }}
                  >
                    <Text style={styles.quickPresetText}>ncv@smartvas.vn</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickPresetChip}
                    onPress={() => {
                      setEmailInput('admin@smartvas.vn');
                      setPasswordInput('admin123456');
                    }}
                  >
                    <Text style={styles.quickPresetText}>admin@smartvas.vn</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Login Action Button */}
            <TouchableOpacity
              style={styles.loginActionBtn}
              onPress={handleLogin}
              disabled={isAuthenticating}
              activeOpacity={0.85}
            >
              {isAuthenticating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="log-in-outline" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.loginActionBtnText}>Đăng nhập quyền NCV</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.returnPatientBtn} onPress={onClose}>
              <Text style={styles.returnPatientBtnText}>Quay lại màn hình Bệnh nhân</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : (
          /* --- CASE 2: AUTHORIZED (Đã đăng nhập quyền NCV trở lên) --- */
          <>
            {/* Tab navigation */}
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[styles.tabItem, activeTab === 'assessments' && styles.tabItemActive]}
                onPress={() => setActiveTab('assessments')}
              >
                <Ionicons
                  name="analytics-outline"
                  size={18}
                  color={activeTab === 'assessments' ? '#0284C7' : '#64748B'}
                />
                <Text
                  style={[styles.tabText, activeTab === 'assessments' && styles.tabTextActive]}
                >
                  Đánh giá ({assessments.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabItem, activeTab === 'patients' && styles.tabItemActive]}
                onPress={() => setActiveTab('patients')}
              >
                <Ionicons
                  name="people-outline"
                  size={18}
                  color={activeTab === 'patients' ? '#0284C7' : '#64748B'}
                />
                <Text style={[styles.tabText, activeTab === 'patients' && styles.tabTextActive]}>
                  Hồ sơ Bệnh án ({patients.length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tab 1: Assessments */}
            {activeTab === 'assessments' && (
              <View style={styles.tabContent}>
                <View style={styles.actionRow}>
                  <View style={styles.searchBox}>
                    <Ionicons name="search" size={18} color="#94A3B8" />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Lọc theo Study ID..."
                      value={filterStudyId}
                      onChangeText={setFilterStudyId}
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.actionBtnSecondary}
                    onPress={handleSyncOffline}
                    disabled={syncing}
                  >
                    {syncing ? (
                      <ActivityIndicator size="small" color="#0284C7" />
                    ) : (
                      <>
                        <Ionicons name="sync" size={16} color="#0284C7" />
                        <Text style={styles.actionBtnText}>Đồng bộ</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.actionBtnPrimary} onPress={handleExportCSV}>
                    <Ionicons name="download-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.actionBtnPrimaryText}>Xuất CSV</Text>
                  </TouchableOpacity>
                </View>

                {loading ? (
                  <View style={styles.loadingBox}>
                    <ActivityIndicator size="large" color="#0284C7" />
                    <Text style={styles.loadingText}>Đang tải danh sách đánh giá...</Text>
                  </View>
                ) : filteredAssessments.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Ionicons name="document-text-outline" size={48} color="#CBD5E1" />
                    <Text style={styles.emptyTitle}>Chưa có bản ghi nào</Text>
                    <Text style={styles.emptySubtitle}>
                      Thực hiện đánh giá từ màn hình chính để ghi nhận điểm đau đầu tiên.
                    </Text>
                  </View>
                ) : (
                  <ScrollView style={styles.listScroll}>
                    {filteredAssessments.map((item) => (
                      <View key={item.assessment_id} style={styles.assessmentItem}>
                        <View style={styles.itemHeader}>
                          <View style={styles.idGroup}>
                            <Text style={styles.itemStudyId}>{item.study_id}</Text>
                            <View style={styles.itemTimepointBadge}>
                              <Text style={styles.itemTimepointText}>{item.assessment_timepoint}</Text>
                            </View>
                            <View
                              style={[
                                styles.contextChip,
                                item.pain_context === 'nghi' ? styles.chipRest : styles.chipMove,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.contextChipText,
                                  item.pain_context === 'nghi' ? styles.textRest : styles.textMove,
                                ]}
                              >
                                {item.pain_context === 'nghi' ? 'Lúc nghỉ' : 'Vận động'}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.scoreBadge}>
                            <Text style={styles.scoreText}>{item.eVAS_score.toFixed(1)}</Text>
                            <Text style={styles.scoreUnit}>/100</Text>
                          </View>
                        </View>

                        <View style={styles.itemMeta}>
                          <Text style={styles.itemDate}>
                            {new Date(item.submit_timestamp).toLocaleTimeString('vi-VN')} •{' '}
                            {new Date(item.submit_timestamp).toLocaleDateString('vi-VN')}
                          </Text>
                          <Text style={styles.itemDuration}>{item.duration_seconds}s thao tác</Text>
                          <View
                            style={[
                              styles.statusDot,
                              {
                                backgroundColor:
                                  item.save_status === 'success' ? '#10B981' : '#F59E0B',
                              },
                            ]}
                          />
                          <Text style={styles.statusLabel}>
                            {item.save_status === 'success' ? 'Firebase' : 'Local'}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}

            {/* Tab 2: Patients Medical Records */}
            {activeTab === 'patients' && (
              <View style={styles.tabContent}>
                {patientViewMode === 'list' ? (
                  <>
                    <View style={styles.actionRow}>
                      <View style={styles.searchBox}>
                        <Ionicons name="search" size={18} color="#94A3B8" />
                        <TextInput
                          style={styles.searchInput}
                          placeholder="Lọc mã hồ sơ (study_id)..."
                          value={filterPatientId}
                          onChangeText={setFilterPatientId}
                          placeholderTextColor="#94A3B8"
                        />
                      </View>

                      <TouchableOpacity
                        style={styles.actionBtnSecondary}
                        onPress={loadData}
                        disabled={loading}
                      >
                        <Ionicons name="refresh" size={16} color="#0284C7" />
                        <Text style={styles.actionBtnText}>Làm mới</Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.actionBtnPrimary} onPress={handleAddNewPatient}>
                        <Ionicons name="add" size={18} color="#FFFFFF" />
                        <Text style={styles.actionBtnPrimaryText}>Thêm hồ sơ</Text>
                      </TouchableOpacity>
                    </View>

                    {loading ? (
                      <View style={styles.loadingBox}>
                        <ActivityIndicator size="large" color="#0284C7" />
                        <Text style={styles.loadingText}>Đang tải danh sách hồ sơ bệnh án...</Text>
                      </View>
                    ) : filteredPatients.length === 0 ? (
                      <View style={styles.emptyBox}>
                        <Ionicons name="people-outline" size={48} color="#CBD5E1" />
                        <Text style={styles.emptyTitle}>Chưa có hồ sơ bệnh án nào</Text>
                        <Text style={styles.emptySubtitle}>
                          {filterPatientId
                            ? `Không tìm thấy hồ sơ nào khớp với "${filterPatientId}"`
                            : 'Nhấn "+ Thêm hồ sơ" để đăng ký hồ sơ sản phụ mới vào nghiên cứu.'}
                        </Text>
                        <TouchableOpacity
                          style={[styles.actionBtnPrimary, { marginTop: 14 }]}
                          onPress={handleAddNewPatient}
                        >
                          <Ionicons name="add" size={18} color="#FFFFFF" />
                          <Text style={styles.actionBtnPrimaryText}>Thêm hồ sơ đầu tiên</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <ScrollView style={styles.listScroll}>
                        {filteredPatients.map((patient) => {
                          const patientAssessmentsCount = assessments.filter(
                            (a) => a.study_id.toUpperCase() === patient.study_id.toUpperCase()
                          ).length;

                          return (
                            <View key={patient.study_id} style={styles.patientCard}>
                              {/* Header Card */}
                              <View style={styles.patientCardHeader}>
                                <View style={styles.patientIdBadge}>
                                  <Ionicons name="person-circle-outline" size={24} color="#0284C7" />
                                  <Text style={styles.patientIdText}>{patient.study_id}</Text>
                                </View>

                                <View style={styles.assessmentCountTag}>
                                  <Ionicons name="pulse" size={13} color="#059669" />
                                  <Text style={styles.assessmentCountText}>
                                    {patientAssessmentsCount} lần đo eVAS
                                  </Text>
                                </View>
                              </View>

                              {/* Details Grid */}
                              <View style={styles.patientDetailGrid}>
                                <View style={styles.patientDetailItem}>
                                  <Text style={styles.detailLabel}>Tuổi:</Text>
                                  <Text style={styles.detailValue}>
                                    {patient.age ? `${patient.age} tuổi` : 'Chưa có'}
                                  </Text>
                                </View>

                                <View style={styles.patientDetailItem}>
                                  <Text style={styles.detailLabel}>Para:</Text>
                                  <Text style={styles.detailValue}>{patient.para || 'Chưa có'}</Text>
                                </View>

                                <View style={styles.patientDetailItemFull}>
                                  <Text style={styles.detailLabel}>Vô cảm:</Text>
                                  <Text style={styles.detailValue}>
                                    {patient.anesthesia_method || 'Chưa ghi nhận'}
                                  </Text>
                                </View>

                                <View style={styles.patientDetailItemFull}>
                                  <Text style={styles.detailLabel}>Thuốc giảm đau:</Text>
                                  <Text style={styles.detailValue}>
                                    {patient.analgesia_drugs || 'Chưa ghi nhận'}
                                  </Text>
                                </View>

                                <View style={styles.patientDetailItem}>
                                  <Text style={styles.detailLabel}>VAS giấy đối chiếu:</Text>
                                  <Text style={[styles.detailValue, { color: '#0284C7', fontWeight: '700' }]}>
                                    {patient.paper_vas_score !== null && patient.paper_vas_score !== undefined
                                      ? `${patient.paper_vas_score} mm`
                                      : 'Chưa đo'}
                                  </Text>
                                </View>

                                <View style={styles.patientDetailItem}>
                                  <Text style={styles.detailLabel}>Ngày đăng ký:</Text>
                                  <Text style={styles.detailValue}>
                                    {patient.created_at
                                      ? new Date(patient.created_at).toLocaleDateString('vi-VN')
                                      : '---'}
                                  </Text>
                                </View>
                              </View>

                              {/* Action Footer */}
                              <View style={styles.patientCardActions}>
                                {patientAssessmentsCount > 0 ? (
                                  <TouchableOpacity
                                    style={styles.patientActionViewBtn}
                                    onPress={() => {
                                      setFilterStudyId(patient.study_id);
                                      setActiveTab('assessments');
                                    }}
                                  >
                                    <Ionicons name="stats-chart" size={14} color="#0284C7" />
                                    <Text style={styles.patientActionViewText}>
                                      Xem {patientAssessmentsCount} đánh giá
                                    </Text>
                                  </TouchableOpacity>
                                ) : (
                                  <View style={styles.noAssessmentBadge}>
                                    <Text style={styles.noAssessmentText}>Chưa có lần đo nào</Text>
                                  </View>
                                )}

                                <TouchableOpacity
                                  style={styles.patientActionEditBtn}
                                  onPress={() => handleEditPatient(patient)}
                                >
                                  <Ionicons name="create-outline" size={15} color="#475569" />
                                  <Text style={styles.patientActionEditText}>Sửa hồ sơ</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          );
                        })}
                      </ScrollView>
                    )}
                  </>
                ) : (
                  /* Form thêm / sửa hồ sơ */
                  <ScrollView contentContainerStyle={styles.patientFormContainer}>
                    <View style={styles.formBackRow}>
                      <TouchableOpacity
                        style={styles.formBackBtn}
                        onPress={() => setPatientViewMode('list')}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="arrow-back" size={18} color="#0284C7" />
                        <Text style={styles.formBackText}>Quay lại danh sách hồ sơ</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.sectionHeader}>
                      {newStudyId && patients.some((p) => p.study_id === newStudyId)
                        ? `Cập nhật hồ sơ: ${newStudyId}`
                        : 'Thêm hồ sơ sản phụ mới (Hồ sơ bệnh án)'}
                    </Text>
                    <Text style={styles.sectionNote}>
                      Theo PRD Mục B: Dữ liệu chuyên sâu do NCV thu thập riêng để đối chiếu với điểm eVAS.
                    </Text>

                    <View style={styles.formGroup}>
                      <Text style={styles.label}>Mã nghiên cứu (study_id) *</Text>
                      <TextInput
                        style={styles.formInput}
                        value={newStudyId}
                        onChangeText={(t) => setNewStudyId(t.toUpperCase())}
                        placeholder="VD: CS001"
                      />
                    </View>

                    <View style={styles.formRow}>
                      <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                        <Text style={styles.label}>Tuổi sản phụ</Text>
                        <TextInput
                          style={styles.formInput}
                          value={newAge}
                          onChangeText={setNewAge}
                          keyboardType="numeric"
                          placeholder="VD: 28"
                        />
                      </View>

                      <View style={[styles.formGroup, { flex: 1 }]}>
                        <Text style={styles.label}>Para (Sinh/Sống/Sẩy/Hút)</Text>
                        <TextInput
                          style={styles.formInput}
                          value={newPara}
                          onChangeText={setNewPara}
                          placeholder="VD: 1001"
                        />
                      </View>
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={styles.label}>Phương pháp vô cảm</Text>
                      <TextInput
                        style={styles.formInput}
                        value={newAnesthesia}
                        onChangeText={setNewAnesthesia}
                        placeholder="VD: Tê tủy sống, Mê nội khí quản..."
                      />
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={styles.label}>Thuốc giảm đau sử dụng</Text>
                      <TextInput
                        style={styles.formInput}
                        value={newDrugs}
                        onChangeText={setNewDrugs}
                        placeholder="VD: Morphin tủy sống 100mcg, Paracetamol 1g..."
                      />
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={styles.label}>Điểm VAS giấy đối chiếu (0 - 100 mm)</Text>
                      <TextInput
                        style={styles.formInput}
                        value={newPaperVas}
                        onChangeText={setNewPaperVas}
                        keyboardType="numeric"
                        placeholder="VD: 45"
                      />
                    </View>

                    <View style={styles.formActionsRow}>
                      <TouchableOpacity
                        style={styles.formCancelBtn}
                        onPress={() => setPatientViewMode('list')}
                      >
                        <Text style={styles.formCancelBtnText}>Hủy</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.submitPatientBtn, { flex: 1, marginTop: 0 }]}
                        onPress={handleSavePatient}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="save-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={styles.submitPatientBtnText}>Lưu hồ sơ</Text>
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                )}
              </View>
            )}
          </>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    paddingTop: Platform.OS === 'ios' ? 50 : 18,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  roleBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  roleBadgeNCV: {
    backgroundColor: '#E0F2FE',
  },
  roleBadgeAdmin: {
    backgroundColor: '#FEF3C7',
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  roleTextNCV: {
    color: '#0284C7',
  },
  roleTextAdmin: {
    color: '#D97706',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 4,
  },
  logoutBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  // Auth Form Styles
  authContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  authLockCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#BAE6FD',
  },
  authTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  authDescription: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  authTabSwitch: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 4,
    width: '100%',
    marginBottom: 20,
  },
  authTabBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  authTabBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  authTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  authTabTextActive: {
    color: '#0284C7',
    fontWeight: '700',
  },
  authErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 12,
    width: '100%',
    marginBottom: 16,
    gap: 8,
  },
  authErrorText: {
    fontSize: 13,
    color: '#DC2626',
    flex: 1,
    lineHeight: 18,
  },
  formCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  pinInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#BAE6FD',
    borderRadius: 12,
    height: 56,
    fontSize: 26,
    letterSpacing: 10,
    color: '#0F172A',
    fontWeight: '800',
    marginBottom: 16,
  },
  emailInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    height: 48,
    fontSize: 14,
    color: '#0F172A',
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  quickPresetTitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 8,
  },
  quickPresetRow: {
    gap: 8,
  },
  quickPresetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    gap: 6,
  },
  quickPresetText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0284C7',
  },
  loginActionBtn: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0284C7',
    paddingVertical: 16,
    borderRadius: 14,
    elevation: 3,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  loginActionBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  returnPatientBtn: {
    paddingVertical: 14,
    marginTop: 8,
  },
  returnPatientBtnText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },

  // Authorized Dashboard Styles
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: '#0284C7',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#0284C7',
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    marginLeft: 6,
  },
  actionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 4,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0284C7',
  },
  actionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284C7',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 4,
  },
  actionBtnPrimaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loadingBox: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  emptyBox: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 6,
  },
  listScroll: {
    flex: 1,
  },
  assessmentItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  idGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemStudyId: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  itemTimepointBadge: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  itemTimepointText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  contextChip: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  chipRest: {
    backgroundColor: '#E0F2FE',
  },
  chipMove: {
    backgroundColor: '#FEF3C7',
  },
  contextChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  textRest: {
    color: '#0284C7',
  },
  textMove: {
    color: '#D97706',
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: '#F8FAFC',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  scoreText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0284C7',
  },
  scoreUnit: {
    fontSize: 11,
    color: '#64748B',
    marginLeft: 2,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemDate: {
    fontSize: 12,
    color: '#64748B',
  },
  itemDuration: {
    fontSize: 12,
    color: '#94A3B8',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 'auto',
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  patientFormContainer: {
    padding: 20,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  sectionNote: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
    lineHeight: 18,
  },
  formGroup: {
    marginBottom: 14,
  },
  formRow: {
    flexDirection: 'row',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 14,
    color: '#0F172A',
  },
  submitPatientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284C7',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  submitPatientBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Patient Card & List Styles
  patientCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  patientCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  patientIdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  patientIdText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  assessmentCountTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    gap: 4,
  },
  assessmentCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  patientDetailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  patientDetailItem: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  patientDetailItemFull: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  detailLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '600',
  },
  patientCardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 8,
  },
  patientActionViewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  patientActionViewText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
  noAssessmentBadge: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  noAssessmentText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  patientActionEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  patientActionEditText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  formBackRow: {
    marginBottom: 14,
  },
  formBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  formBackText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0284C7',
  },
  formActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  formCancelBtn: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formCancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
  },
});
