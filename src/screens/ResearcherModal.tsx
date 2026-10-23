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
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Assessment, Patient, AppUser, ResearcherAccount, UserRole } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { AuthService } from '../services/authService';
import {
  getCalibratedVASHeight,
  getStoredCalibrationFactor,
  saveCalibrationFactor,
  resetCalibrationFactor,
  getDisplayDiagnostics,
  VAS_CLINICAL_LENGTH_MM,
  REFERENCE_CARD_LENGTH_MM,
  mmToPixels,
} from '../utils/physicalScale';

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
  const [activeTab, setActiveTab] = useState<'assessments' | 'patients' | 'accounts' | 'calibration'>('assessments');
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [researchers, setResearchers] = useState<ResearcherAccount[]>([]);
  const [calibrationFactor, setCalibrationFactor] = useState<number>(1.0);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [filterStudyId, setFilterStudyId] = useState<string>('');
  const [filterPatientId, setFilterPatientId] = useState<string>('');
  const [filterResearcherText, setFilterResearcherText] = useState<string>('');
  const [patientViewMode, setPatientViewMode] = useState<'list' | 'form'>('list');
  const [syncing, setSyncing] = useState<boolean>(false);
  const [creatorFilter, setCreatorFilter] = useState<string>('all'); // 'all' | 'my' | researcherId
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);

  // Authentication State
  const [loginMethod, setLoginMethod] = useState<'pin' | 'email'>('pin');
  const [pinInput, setPinInput] = useState<string>('');
  const [emailInput, setEmailInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);

  // Form thêm/sửa sản phụ
  const [newStudyId, setNewStudyId] = useState<string>('');
  const [newAge, setNewAge] = useState<string>('');
  const [newPara, setNewPara] = useState<string>('');
  const [newAnesthesia, setNewAnesthesia] = useState<string>('');
  const [newDrugs, setNewDrugs] = useState<string>('');
  const [newPaperVas, setNewPaperVas] = useState<string>('');

  // Quản lý Tài khoản & Mã PIN trên CSDL
  const [isAccountModalOpen, setIsAccountModalOpen] = useState<boolean>(false);
  const [editingAccount, setEditingAccount] = useState<ResearcherAccount | null>(null);
  const [accName, setAccName] = useState<string>('');
  const [accEmail, setAccEmail] = useState<string>('');
  const [accPin, setAccPin] = useState<string>('');
  const [accPassword, setAccPassword] = useState<string>('');
  const [accRole, setAccRole] = useState<UserRole>('ncv');
  const [accTitle, setAccTitle] = useState<string>('');
  const [accIsActive, setAccIsActive] = useState<boolean>(true);

  // Modal đổi mã PIN nhanh
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);
  const [pinChangeTarget, setPinChangeTarget] = useState<ResearcherAccount | null>(null);
  const [newPinValue, setNewPinValue] = useState<string>('');
  const [visiblePins, setVisiblePins] = useState<{ [id: string]: boolean }>({});

  const isAuthorized = AuthService.isNCVorHigher(currentUser);
  const isAdmin = AuthService.isAdmin(currentUser);

  const loadData = async () => {
    if (!isAuthorized) return;
    setLoading(true);
    try {
      if (isAdmin) {
        // Admin: Xem được tất cả hồ sơ bệnh nhân, tất cả đánh giá và tất cả tài khoản NCV
        const [allAssessments, allPatients, allResearchers] = await Promise.all([
          FirebaseService.getAllAssessments(),
          FirebaseService.getAllPatients(currentUser),
          AuthService.getAllResearchers(),
        ]);
        setAssessments(allAssessments);
        setPatients(allPatients);
        setResearchers(allResearchers);
      } else {
        // NCV: Chỉ xem được hồ sơ bệnh nhân do chính mình tạo; người khác không thể xem
        const [allAssessments, myPatients] = await Promise.all([
          FirebaseService.getAllAssessments(),
          FirebaseService.getAllPatients(currentUser),
        ]);
        const scopedPatients = myPatients.filter((p) => p.created_by === currentUser?.id);
        const scopedPatientIds = new Set(scopedPatients.map((p) => p.study_id.toUpperCase()));
        // Điểm đánh giá eVAS cũng chỉ giới hạn ở các bệnh nhân do NCV này quản lý
        const scopedAssessments = allAssessments.filter((a) =>
          scopedPatientIds.has(a.study_id.toUpperCase())
        );

        setPatients(scopedPatients);
        setAssessments(scopedAssessments);
        setResearchers([]);
      }
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
    if (!isAdmin && activeTab === 'accounts') {
      setActiveTab('assessments');
    }
    if (visible) {
      getStoredCalibrationFactor().then((f) => {
        setCalibrationFactor(f);
        setDiagnostics(getDisplayDiagnostics(f));
      });
    }
    setAuthError('');
  }, [visible, isAuthorized, isAdmin]);


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
    setEditingPatient(null);
    setNewStudyId('');
    setNewAge('');
    setNewPara('');
    setNewAnesthesia('');
    setNewDrugs('');
    setNewPaperVas('');
    setPatientViewMode('form');
  };

  const handleEditPatient = (p: Patient) => {
    // Phân quyền: Chỉ người tạo hoặc Admin mới có quyền sửa
    if (!isAdmin && p.created_by && p.created_by !== currentUser?.id) {
      Alert.alert(
        'Không có quyền truy cập',
        'Hồ sơ này do một Nghiên cứu viên khác tạo. Chỉ người tạo hoặc Quản trị viên (Admin) mới có quyền chỉnh sửa.'
      );
      return;
    }
    setEditingPatient(p);
    setNewStudyId(p.study_id);
    setNewAge(p.age !== null && p.age !== undefined ? String(p.age) : '');
    setNewPara(p.para || '');
    setNewAnesthesia(p.anesthesia_method || '');
    setNewDrugs(p.analgesia_drugs || '');
    setNewPaperVas(p.paper_vas_score !== null && p.paper_vas_score !== undefined ? String(p.paper_vas_score) : '');
    setPatientViewMode('form');
  };

  const handleDeletePatient = (patient: Patient) => {
    // Phân quyền: Chỉ người tạo hoặc Admin mới có quyền xóa
    if (!isAdmin && patient.created_by && patient.created_by !== currentUser?.id) {
      Alert.alert(
        'Không có quyền xóa',
        'Hồ sơ này do một Nghiên cứu viên khác tạo. Chỉ người tạo hoặc Quản trị viên (Admin) mới có quyền xóa.'
      );
      return;
    }

    Alert.alert(
      'Xác nhận xóa hồ sơ',
      `Bạn có chắc chắn muốn xóa hồ sơ sản phụ "${patient.study_id}" không?\n\nNgười tạo: ${patient.created_by_name || 'Hệ thống'}`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa hồ sơ',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            const res = await FirebaseService.deletePatient(patient.study_id, currentUser);
            setLoading(false);
            if (res.success) {
              Alert.alert('Đã xóa', `Đã xóa hồ sơ ${patient.study_id} thành công.`);
              loadData();
            } else {
              Alert.alert('Lỗi xóa hồ sơ', res.error || 'Không thể xóa hồ sơ.');
            }
          },
        },
      ]
    );
  };

  const handleSavePatient = async () => {
    const trimmedStudyId = newStudyId.trim().toUpperCase();
    if (!trimmedStudyId) {
      Alert.alert('Lỗi', 'Vui lòng nhập Mã nghiên cứu (study_id).');
      return;
    }

    // Nếu tạo mới: kiểm tra trùng mã trên toàn hệ thống
    if (!editingPatient) {
      const existing = await FirebaseService.getPatient(trimmedStudyId);
      if (existing) {
        Alert.alert(
          'Mã hồ sơ đã tồn tại',
          `Mã "${trimmedStudyId}" đã tồn tại trong hệ thống (tạo bởi: ${existing.created_by_name || 'NCV khác'}). Vui lòng chọn mã khác.`
        );
        return;
      }
    }

    // Nếu đang sửa: kiểm tra quyền chỉnh sửa
    if (editingPatient && !isAdmin && editingPatient.created_by && editingPatient.created_by !== currentUser?.id) {
      Alert.alert('Từ chối', 'Bạn không có quyền chỉnh sửa hồ sơ do người khác tạo.');
      return;
    }

    const patientData: Patient = {
      study_id: trimmedStudyId,
      age: newAge ? parseInt(newAge) : null,
      para: newPara || null,
      anesthesia_method: newAnesthesia || null,
      analgesia_drugs: newDrugs || null,
      paper_vas_score: newPaperVas ? parseFloat(newPaperVas) : null,
      created_at: editingPatient ? editingPatient.created_at : new Date().toISOString(),
      created_by: editingPatient ? editingPatient.created_by : (currentUser?.id || 'admin-01'),
      created_by_name: editingPatient ? editingPatient.created_by_name : (currentUser?.name || 'PGS. TS. Chủ nhiệm Đề tài'),
    };

    setLoading(true);
    const res = await FirebaseService.savePatient(patientData, currentUser);
    setLoading(false);

    if (res.success) {
      Alert.alert(
        'Thành công',
        editingPatient
          ? `Đã cập nhật hồ sơ sản phụ ${patientData.study_id}`
          : `Đã lưu hồ sơ sản phụ ${patientData.study_id}\nNgười tạo & quản lý: ${patientData.created_by_name}`
      );
      setEditingPatient(null);
      setNewStudyId('');
      setPatientViewMode('list');
      loadData();
    } else {
      Alert.alert('Thông báo', res.error || 'Lỗi khi lưu hồ sơ');
      setEditingPatient(null);
      setPatientViewMode('list');
      loadData();
    }
  };

  // --- Quản lý Tài khoản & Mã PIN (Chỉ dành cho Admin) ---
  const handleOpenAddAccount = () => {
    if (!isAdmin) {
      Alert.alert('Không có quyền', 'Chỉ Quản trị viên (Admin) mới có quyền thêm tài khoản.');
      return;
    }
    setEditingAccount(null);
    setAccName('');
    setAccEmail('');
    setAccPin('');
    setAccPassword('');
    setAccRole('ncv');
    setAccTitle('Nghiên cứu viên (NCV)');
    setAccIsActive(true);
    setIsAccountModalOpen(true);
  };

  const handleOpenEditAccount = (acc: ResearcherAccount) => {
    if (!isAdmin) {
      Alert.alert('Không có quyền', 'Chỉ Quản trị viên (Admin) mới có quyền chỉnh sửa tài khoản.');
      return;
    }
    setEditingAccount(acc);
    setAccName(acc.name);
    setAccEmail(acc.email);
    setAccPin(acc.pin);
    setAccPassword(acc.password || '');
    setAccRole(acc.role);
    setAccTitle(acc.title || '');
    setAccIsActive(acc.is_active !== false);
    setIsAccountModalOpen(true);
  };

  const handleSaveAccount = async () => {
    if (!isAdmin) {
      Alert.alert('Không có quyền', 'Chỉ Quản trị viên (Admin) mới có quyền lưu tài khoản.');
      return;
    }
    if (!accName.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập Họ và tên NCV / Bác sĩ.');
      return;
    }
    const trimmedEmail = accEmail.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      Alert.alert('Email không hợp lệ', 'Vui lòng nhập đúng định dạng email (vd: ncv@benhvien.vn).');
      return;
    }
    const trimmedPin = accPin.trim();
    if (!trimmedPin || trimmedPin.length < 4 || trimmedPin.length > 6 || !/^\d+$/.test(trimmedPin)) {
      Alert.alert('Mã PIN không hợp lệ', 'Mã PIN đăng nhập nhanh phải gồm từ 4 đến 6 chữ số (0-9).');
      return;
    }

    const accountData: ResearcherAccount = {
      id: editingAccount ? editingAccount.id : `ncv-${Date.now()}`,
      name: accName.trim(),
      email: trimmedEmail,
      pin: trimmedPin,
      password: accPassword.trim() || (editingAccount?.password ?? '123456'),
      role: accRole,
      title: accTitle.trim() || (accRole === 'admin' ? 'Quản trị viên Đề tài' : 'Nghiên cứu viên'),
      is_active: accIsActive,
      created_at: editingAccount ? editingAccount.created_at : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setLoading(true);
    const res = await AuthService.saveResearcher(accountData);
    setLoading(false);

    if (res.success) {
      Alert.alert(
        'Thành công',
        editingAccount
          ? `Đã cập nhật thông tin tài khoản ${accountData.name} trên CSDL.`
          : `Đã thêm tài khoản ${accountData.name} vào CSDL thành công.`
      );
      setIsAccountModalOpen(false);
      loadData();
    } else {
      Alert.alert('Không thể lưu', res.error || 'Lỗi khi lưu tài khoản vào CSDL');
    }
  };

  const handleDeleteAccount = (acc: ResearcherAccount) => {
    if (!isAdmin) {
      Alert.alert('Không có quyền', 'Chỉ Quản trị viên (Admin) mới có quyền xóa tài khoản.');
      return;
    }
    if (currentUser && currentUser.id === acc.id) {
      Alert.alert('Không thể xóa', 'Bạn không thể tự xóa tài khoản của chính mình khi đang đăng nhập.');
      return;
    }
    if (acc.role === 'admin') {
      const activeAdmins = researchers.filter((r) => r.role === 'admin' && r.is_active !== false);
      if (activeAdmins.length <= 1) {
        Alert.alert('Không thể xóa', 'Hệ thống cần duy trì ít nhất một tài khoản Quản trị viên (Admin) đang hoạt động.');
        return;
      }
    }

    Alert.alert(
      'Xác nhận xóa tài khoản',
      `Bạn có chắc chắn muốn xóa tài khoản "${acc.name}" (${acc.email}) khỏi CSDL? Thao tác này không thể hoàn tác.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa vĩnh viễn',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            const res = await AuthService.deleteResearcher(acc.id);
            setLoading(false);
            if (res.success) {
              Alert.alert('Đã xóa', 'Tài khoản đã được xóa khỏi CSDL.');
              loadData();
            } else {
              Alert.alert('Lỗi', res.error || 'Không thể xóa tài khoản');
            }
          },
        },
      ]
    );
  };

  const handleToggleAccountStatus = async (acc: ResearcherAccount) => {
    if (!isAdmin) {
      Alert.alert('Không có quyền', 'Chỉ Quản trị viên (Admin) mới có quyền khóa/mở tài khoản.');
      return;
    }
    if (currentUser && currentUser.id === acc.id && acc.is_active !== false) {
      Alert.alert('Không thể khóa', 'Bạn không thể tự tạm khóa tài khoản của chính mình.');
      return;
    }
    const nextStatus = acc.is_active === false ? true : false;
    setLoading(true);
    const res = await AuthService.saveResearcher({
      ...acc,
      is_active: nextStatus,
      updated_at: new Date().toISOString(),
    });
    setLoading(false);

    if (res.success) {
      Alert.alert('Thành công', `Đã ${nextStatus ? 'kích hoạt lại' : 'tạm khóa'} tài khoản ${acc.name}.`);
      loadData();
    } else {
      Alert.alert('Lỗi', res.error || 'Không thể thay đổi trạng thái');
    }
  };

  const handleOpenChangePin = (acc: ResearcherAccount) => {
    if (!isAdmin) {
      Alert.alert('Không có quyền', 'Chỉ Quản trị viên (Admin) mới có quyền đổi mã PIN.');
      return;
    }
    setPinChangeTarget(acc);
    setNewPinValue('');
    setIsPinModalOpen(true);
  };

  const handleSaveNewPin = async () => {
    if (!isAdmin) {
      Alert.alert('Không có quyền', 'Chỉ Quản trị viên (Admin) mới có quyền cập nhật mã PIN.');
      return;
    }
    if (!pinChangeTarget) return;
    const trimmed = newPinValue.trim();
    if (!trimmed || trimmed.length < 4 || trimmed.length > 6 || !/^\d+$/.test(trimmed)) {
      Alert.alert('Mã PIN không hợp lệ', 'Mã PIN mới phải gồm 4 đến 6 chữ số (0-9).');
      return;
    }

    setLoading(true);
    const res = await AuthService.updatePin(pinChangeTarget.id, trimmed);
    setLoading(false);

    if (res.success) {
      Alert.alert('Đổi mã PIN thành công', `Mã PIN mới cho ${pinChangeTarget.name} là: ${trimmed}`);
      setIsPinModalOpen(false);
      setPinChangeTarget(null);
      setNewPinValue('');
      loadData();
    } else {
      Alert.alert('Lỗi đổi mã PIN', res.error || 'Không thể cập nhật mã PIN');
    }
  };

  const togglePinVisibility = (id: string) => {
    setVisiblePins((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredResearchers = researchers.filter((r) => {
    const q = filterResearcherText.trim().toLowerCase();
    if (!q) return true;
    return (
      r.name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      (r.title && r.title.toLowerCase().includes(q)) ||
      r.pin.includes(q)
    );
  });

  const filteredAssessments = filterStudyId.trim()
    ? assessments.filter((a) => a.study_id.toUpperCase().includes(filterStudyId.trim().toUpperCase()))
    : assessments;

  const filteredPatients = patients.filter((p) => {
    // 1. Tìm kiếm theo mã study_id hoặc tên người tạo
    const q = filterPatientId.trim().toUpperCase();
    if (q) {
      const matchId = p.study_id.toUpperCase().includes(q);
      const matchCreator = p.created_by_name ? p.created_by_name.toUpperCase().includes(q) : false;
      if (!matchId && !matchCreator) return false;
    }

    // 2. Lọc theo người tạo (dành cho Admin)
    if (isAdmin && creatorFilter !== 'all') {
      if (creatorFilter === 'my') {
        if (p.created_by !== currentUser?.id) return false;
      } else {
        if (p.created_by !== creatorFilter) return false;
      }
    }

    return true;
  });

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
                <Text style={styles.inputLabel}>Nhập mã PIN NCV của bạn:</Text>
                <TextInput
                  style={styles.pinInput}
                  value={pinInput}
                  onChangeText={setPinInput}
                  placeholder="• • • •"
                  keyboardType="numeric"
                  secureTextEntry
                  maxLength={6}
                  textAlign="center"
                  placeholderTextColor="#94A3B8"
                />

                <View style={styles.authInfoNoteBox}>
                  <Ionicons name="shield-checkmark" size={16} color="#0284C7" />
                  <Text style={styles.authInfoNoteText}>
                    Mã PIN cá nhân (4 - 6 số) được định danh & quản lý trực tiếp trong Cơ sở dữ liệu của đề tài.
                  </Text>
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
                  placeholder="ncv@benhvien.vn"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholderTextColor="#94A3B8"
                />

                <Text style={[styles.inputLabel, { marginTop: 12 }]}>Mật khẩu:</Text>
                <TextInput
                  style={styles.emailInput}
                  value={passwordInput}
                  onChangeText={setPasswordInput}
                  placeholder="Nhập mật khẩu"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry
                />

                <View style={styles.authInfoNoteBox}>
                  <Ionicons name="information-circle-outline" size={16} color="#0284C7" />
                  <Text style={styles.authInfoNoteText}>
                    Đăng nhập bằng tài khoản Nghiên cứu viên đã được phân quyền trong CSDL.
                  </Text>
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
                  Hồ sơ ({patients.length})
                </Text>
              </TouchableOpacity>

              {isAdmin && (
                <TouchableOpacity
                  style={[styles.tabItem, activeTab === 'accounts' && styles.tabItemActive]}
                  onPress={() => setActiveTab('accounts')}
                >
                  <Ionicons
                    name="key-outline"
                    size={18}
                    color={activeTab === 'accounts' ? '#0284C7' : '#64748B'}
                  />
                  <Text style={[styles.tabText, activeTab === 'accounts' && styles.tabTextActive]}>
                    Tài khoản & PIN ({researchers.length})
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.tabItem, activeTab === 'calibration' && styles.tabItemActive]}
                onPress={() => setActiveTab('calibration')}
              >
                <Ionicons
                  name="resize-outline"
                  size={18}
                  color={activeTab === 'calibration' ? '#0284C7' : '#64748B'}
                />
                <Text style={[styles.tabText, activeTab === 'calibration' && styles.tabTextActive]}>
                  Hiệu chuẩn 10cm
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
                    {/* Phân quyền Banner */}
                    <View
                      style={[
                        styles.permissionBanner,
                        isAdmin ? styles.permissionBannerAdmin : styles.permissionBannerNCV,
                      ]}
                    >
                      <Ionicons
                        name={isAdmin ? 'shield-checkmark' : 'lock-closed'}
                        size={20}
                        color={isAdmin ? '#B45309' : '#0284C7'}
                      />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text
                          style={[
                            styles.permissionBannerTitle,
                            isAdmin ? styles.permissionTextAdmin : styles.permissionTextNCV,
                          ]}
                        >
                          {isAdmin
                            ? '👑 Quyền Quản trị viên (Admin) — Toàn quyền đề tài'
                            : '🔒 Phân quyền cá nhân: Quản lý bệnh nhân theo người tạo'}
                        </Text>
                        <Text
                          style={[
                            styles.permissionBannerSub,
                            isAdmin ? styles.permissionSubAdmin : styles.permissionSubNCV,
                          ]}
                        >
                          {isAdmin
                            ? `Bạn có thể xem và quản lý tất cả ${patients.length} bệnh nhân trong hệ thống.`
                            : `Bạn đang quản lý ${patients.length} bệnh nhân do bạn tạo. Người khác không thể xem hồ sơ này.`}
                        </Text>
                      </View>
                    </View>

                    {/* Bộ lọc người tạo dành riêng cho Quản trị viên (Admin) */}
                    {isAdmin && (
                      <View style={styles.creatorFilterContainer}>
                        <Text style={styles.creatorFilterLabel}>Lọc theo người tạo:</Text>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={styles.creatorFilterScroll}
                        >
                          <TouchableOpacity
                            style={[
                              styles.creatorPill,
                              creatorFilter === 'all' && styles.creatorPillActive,
                            ]}
                            onPress={() => setCreatorFilter('all')}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={[
                                styles.creatorPillText,
                                creatorFilter === 'all' && styles.creatorPillTextActive,
                              ]}
                            >
                              Tất cả ({patients.length})
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.creatorPill,
                              creatorFilter === 'my' && styles.creatorPillActive,
                            ]}
                            onPress={() => setCreatorFilter('my')}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={[
                                styles.creatorPillText,
                                creatorFilter === 'my' && styles.creatorPillTextActive,
                              ]}
                            >
                              Của tôi ({patients.filter((p) => p.created_by === currentUser?.id).length})
                            </Text>
                          </TouchableOpacity>

                          {researchers
                            .filter((r) => r.id !== currentUser?.id)
                            .map((r) => {
                              const count = patients.filter((p) => p.created_by === r.id).length;
                              return (
                                <TouchableOpacity
                                  key={r.id}
                                  style={[
                                    styles.creatorPill,
                                    creatorFilter === r.id && styles.creatorPillActive,
                                  ]}
                                  onPress={() => setCreatorFilter(r.id)}
                                  activeOpacity={0.7}
                                >
                                  <Text
                                    style={[
                                      styles.creatorPillText,
                                      creatorFilter === r.id && styles.creatorPillTextActive,
                                    ]}
                                  >
                                    {r.name} ({count})
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                        </ScrollView>
                      </View>
                    )}

                    <View style={styles.actionRow}>
                      <View style={styles.searchBox}>
                        <Ionicons name="search" size={18} color="#94A3B8" />
                        <TextInput
                          style={styles.searchInput}
                          placeholder="Lọc mã hồ sơ hoặc tên NCV..."
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
                        <Text style={styles.emptyTitle}>
                          {filterPatientId || creatorFilter !== 'all'
                            ? 'Không tìm thấy hồ sơ nào'
                            : 'Chưa có hồ sơ bệnh án nào'}
                        </Text>
                        <Text style={styles.emptySubtitle}>
                          {filterPatientId || creatorFilter !== 'all'
                            ? 'Thử thay đổi từ khóa tìm kiếm hoặc bỏ lọc người tạo.'
                            : 'Nhấn "+ Thêm hồ sơ" để đăng ký hồ sơ sản phụ mới thuộc quyền quản lý của bạn.'}
                        </Text>
                        <TouchableOpacity
                          style={[styles.actionBtnPrimary, { marginTop: 14 }]}
                          onPress={handleAddNewPatient}
                        >
                          <Ionicons name="add" size={18} color="#FFFFFF" />
                          <Text style={styles.actionBtnPrimaryText}>Thêm hồ sơ mới</Text>
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

                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  {/* Creator Badge */}
                                  {isAdmin ? (
                                    patient.created_by === currentUser?.id ? (
                                      <View style={styles.myCreatorBadge}>
                                        <Ionicons name="person" size={11} color="#059669" />
                                        <Text style={styles.myCreatorBadgeText}>Tôi tạo</Text>
                                      </View>
                                    ) : (
                                      <View style={styles.otherCreatorBadge}>
                                        <Ionicons name="person-outline" size={11} color="#4338CA" />
                                        <Text style={styles.otherCreatorBadgeText}>
                                          {patient.created_by_name || 'NCV'}
                                        </Text>
                                      </View>
                                    )
                                  ) : (
                                    <View style={styles.myCreatorBadge}>
                                      <Ionicons name="lock-closed" size={11} color="#059669" />
                                      <Text style={styles.myCreatorBadgeText}>Của tôi</Text>
                                    </View>
                                  )}

                                  <View style={styles.assessmentCountTag}>
                                    <Ionicons name="pulse" size={13} color="#059669" />
                                    <Text style={styles.assessmentCountText}>
                                      {patientAssessmentsCount} lần đo eVAS
                                    </Text>
                                  </View>
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

                                <View style={styles.patientDetailItemFull}>
                                  <Text style={styles.detailLabel}>Người tạo & Quản lý:</Text>
                                  <Text style={[styles.detailValue, { color: '#0F172A', fontWeight: '700' }]}>
                                    {patient.created_by_name || 'PGS. TS. Chủ nhiệm Đề tài'}
                                    {patient.created_by === currentUser?.id ? ' (Chính bạn)' : ''}
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

                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                  <TouchableOpacity
                                    style={styles.patientActionEditBtn}
                                    onPress={() => handleEditPatient(patient)}
                                    activeOpacity={0.7}
                                  >
                                    <Ionicons name="create-outline" size={15} color="#475569" />
                                    <Text style={styles.patientActionEditText}>Sửa</Text>
                                  </TouchableOpacity>

                                  <TouchableOpacity
                                    style={styles.patientActionDeleteBtn}
                                    onPress={() => handleDeletePatient(patient)}
                                    activeOpacity={0.7}
                                  >
                                    <Ionicons name="trash-outline" size={15} color="#DC2626" />
                                    <Text style={styles.patientActionDeleteText}>Xóa</Text>
                                  </TouchableOpacity>
                                </View>
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
                      {editingPatient
                        ? `Cập nhật hồ sơ: ${editingPatient.study_id}`
                        : 'Thêm hồ sơ sản phụ mới (Hồ sơ bệnh án)'}
                    </Text>
                    <Text style={styles.sectionNote}>
                      Theo PRD Mục B: Dữ liệu chuyên sâu do NCV thu thập riêng để đối chiếu với điểm eVAS.
                    </Text>

                    {/* Creator Permission Info Box */}
                    <View style={styles.creatorFormInfoBox}>
                      <Ionicons
                        name={editingPatient ? 'shield-checkmark' : 'person-add'}
                        size={20}
                        color="#0284C7"
                      />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.creatorFormInfoTitle}>
                          {editingPatient ? 'Thông tin phân quyền hồ sơ:' : 'Phân quyền người tạo:'}
                        </Text>
                        <Text style={styles.creatorFormInfoText}>
                          {editingPatient
                            ? `Hồ sơ này do "${editingPatient.created_by_name || 'Hệ thống'}" tạo. Chỉ người tạo và Quản trị viên (Admin) mới có quyền xem & chỉnh sửa.`
                            : `Hồ sơ sẽ được liên kết trực tiếp với tài khoản của bạn: "${currentUser?.name}" (${currentUser?.role === 'admin' ? 'Quản trị viên' : 'Nghiên cứu viên'}). Các NCV khác sẽ không thể xem hồ sơ này.`}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={styles.label}>
                        Mã nghiên cứu (study_id) *{' '}
                        {editingPatient && (
                          <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: 'normal' }}>
                            (Không thể thay đổi mã khi sửa)
                          </Text>
                        )}
                      </Text>
                      <TextInput
                        style={[styles.formInput, editingPatient && styles.formInputDisabled]}
                        value={newStudyId}
                        onChangeText={(t) => setNewStudyId(t.toUpperCase())}
                        placeholder="VD: CS001"
                        editable={!editingPatient}
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
                        onPress={() => {
                          setEditingPatient(null);
                          setPatientViewMode('list');
                        }}
                      >
                        <Text style={styles.formCancelBtnText}>Hủy</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.submitPatientBtn, { flex: 1, marginTop: 0 }]}
                        onPress={handleSavePatient}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="save-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={styles.submitPatientBtnText}>
                          {editingPatient ? 'Cập nhật hồ sơ' : 'Lưu hồ sơ'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                )}
              </View>
            )}

            {/* Tab 3: Quản lý Tài khoản & Mã PIN Nghiên cứu viên trên CSDL (Chỉ dành cho Admin) */}
            {activeTab === 'accounts' && isAdmin && (
              <View style={styles.tabContent}>
                <View style={styles.actionRow}>
                  <View style={styles.searchBox}>
                    <Ionicons name="search" size={18} color="#94A3B8" />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Tìm theo Tên, Email, Mã PIN..."
                      value={filterResearcherText}
                      onChangeText={setFilterResearcherText}
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.actionBtnSecondary}
                    onPress={loadData}
                    disabled={loading}
                  >
                    <Ionicons name="sync" size={16} color="#0284C7" />
                    <Text style={styles.actionBtnText}>Làm mới</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionBtnPrimary}
                    onPress={handleOpenAddAccount}
                  >
                    <Ionicons name="person-add" size={16} color="#FFFFFF" />
                    <Text style={styles.actionBtnPrimaryText}>Thêm NCV</Text>
                  </TouchableOpacity>
                </View>

                {/* Banner Thông tin CSDL */}
                <View style={styles.dbInfoBanner}>
                  <View style={styles.dbInfoIconCircle}>
                    <Ionicons name="server" size={20} color="#0284C7" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dbInfoTitle}>Cơ sở dữ liệu Tài khoản & Mã PIN NCV</Text>
                    <Text style={styles.dbInfoDesc}>
                      Dữ liệu tài khoản và mã PIN được đồng bộ trực tiếp với CSDL (Firestore & Bộ nhớ thiết bị). Nghiên cứu viên dùng mã PIN riêng để đăng nhập tại giường bệnh.
                    </Text>
                  </View>
                </View>

                {loading ? (
                  <View style={styles.loadingBox}>
                    <ActivityIndicator size="large" color="#0284C7" />
                    <Text style={styles.loadingText}>Đang tải danh sách tài khoản từ CSDL...</Text>
                  </View>
                ) : filteredResearchers.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Ionicons name="people-outline" size={48} color="#CBD5E1" />
                    <Text style={styles.emptyTitle}>Không tìm thấy tài khoản nào</Text>
                    <Text style={styles.emptySubtitle}>
                      Bấm {'"Thêm NCV"'} để tạo tài khoản nghiên cứu viên mới vào CSDL.
                    </Text>
                  </View>
                ) : (
                  <ScrollView style={styles.listScroll} showsVerticalScrollIndicator={false}>
                    {filteredResearchers.map((item) => {
                      const isPinVisible = !!visiblePins[item.id];
                      const isAdminRole = item.role === 'admin';
                      const isActive = item.is_active !== false;

                      return (
                        <View key={item.id} style={styles.accountCard}>
                          {/* Card Header */}
                          <View style={styles.accountHeader}>
                            <View
                              style={[
                                styles.accountAvatar,
                                isAdminRole ? styles.accountAvatarAdmin : styles.accountAvatarNCV,
                              ]}
                            >
                              <Ionicons
                                name={isAdminRole ? 'shield' : 'person'}
                                size={20}
                                color={isAdminRole ? '#D97706' : '#0284C7'}
                              />
                            </View>

                            <View style={{ flex: 1, marginLeft: 10 }}>
                              <View style={styles.accountNameRow}>
                                <Text style={styles.accountNameText}>{item.name}</Text>
                              </View>
                              <Text style={styles.accountTitleText}>
                                {item.title || (isAdminRole ? 'Quản trị viên Đề tài' : 'Nghiên cứu viên')}
                              </Text>
                            </View>

                            <View style={styles.accountBadgesCol}>
                              <View
                                style={[
                                  styles.roleTag,
                                  isAdminRole ? styles.roleTagAdmin : styles.roleTagNCV,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.roleTagText,
                                    isAdminRole ? styles.roleTagTextAdmin : styles.roleTagTextNCV,
                                  ]}
                                >
                                  {isAdminRole ? 'ADMIN' : 'NCV'}
                                </Text>
                              </View>

                              <View
                                style={[
                                  styles.statusTag,
                                  isActive ? styles.statusTagActive : styles.statusTagInactive,
                                ]}
                              >
                                <View
                                  style={[
                                    styles.statusDotSmall,
                                    { backgroundColor: isActive ? '#10B981' : '#94A3B8' },
                                  ]}
                                />
                                <Text
                                  style={[
                                    styles.statusTagText,
                                    { color: isActive ? '#059669' : '#64748B' },
                                  ]}
                                >
                                  {isActive ? 'Hoạt động' : 'Tạm khóa'}
                                </Text>
                              </View>
                            </View>
                          </View>

                          {/* Email Row */}
                          <View style={styles.accountEmailRow}>
                            <Ionicons name="mail-outline" size={15} color="#64748B" />
                            <Text style={styles.accountEmailText}>{item.email}</Text>
                          </View>

                          {/* PIN Box */}
                          <View style={styles.accountPinBox}>
                            <View style={styles.accountPinLeft}>
                              <Ionicons name="keypad" size={16} color="#0284C7" />
                              <Text style={styles.accountPinLabel}>Mã PIN nhanh:</Text>
                              <Text style={styles.accountPinValue}>
                                {isPinVisible ? item.pin : '••••'}
                              </Text>
                              <TouchableOpacity
                                onPress={() => togglePinVisibility(item.id)}
                                style={styles.pinEyeBtn}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Ionicons
                                  name={isPinVisible ? 'eye-off-outline' : 'eye-outline'}
                                  size={16}
                                  color="#0284C7"
                                />
                              </TouchableOpacity>
                            </View>

                            <TouchableOpacity
                              style={styles.changePinQuickBtn}
                              onPress={() => handleOpenChangePin(item)}
                            >
                              <Ionicons name="create-outline" size={14} color="#0284C7" />
                              <Text style={styles.changePinQuickBtnText}>Đổi PIN</Text>
                            </TouchableOpacity>
                          </View>

                          {/* Action Buttons */}
                          <View style={styles.accountActionsRow}>
                            <TouchableOpacity
                              style={styles.accountActionEditBtn}
                              onPress={() => handleOpenEditAccount(item)}
                            >
                              <Ionicons name="pencil" size={14} color="#334155" />
                              <Text style={styles.accountActionEditText}>Sửa thông tin</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[
                                styles.accountActionToggleBtn,
                                !isActive && styles.accountActionToggleBtnActive,
                              ]}
                              onPress={() => handleToggleAccountStatus(item)}
                            >
                              <Ionicons
                                name={isActive ? 'lock-closed-outline' : 'lock-open-outline'}
                                size={14}
                                color={isActive ? '#D97706' : '#059669'}
                              />
                              <Text
                                style={[
                                  styles.accountActionToggleText,
                                  { color: isActive ? '#D97706' : '#059669' },
                                ]}
                              >
                                {isActive ? 'Tạm khóa' : 'Kích hoạt'}
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.accountActionDeleteBtn}
                              onPress={() => handleDeleteAccount(item)}
                            >
                              <Ionicons name="trash-outline" size={14} color="#DC2626" />
                              <Text style={styles.accountActionDeleteText}>Xóa</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            )}

            {/* Tab 4: Hiệu chuẩn Thước đo 10cm */}
            {activeTab === 'calibration' && (
              <ScrollView style={styles.tabContent} bounces={false}>
                <View style={styles.calibCard}>
                  <View style={styles.calibHeaderRow}>
                    <Ionicons name="shield-checkmark" size={20} color="#0284C7" />
                    <Text style={styles.calibHeaderTitle}>Chuẩn hóa Kích thước Đo Lường Lâm Sàng</Text>
                  </View>
                  <Text style={styles.calibDescription}>
                    Thang đo VAS hướng dọc trên ứng dụng bắt buộc phải đạt chính xác <Text style={{ fontWeight: '800' }}>10,0 cm (100 mm)</Text> thực tế trên mọi thiết bị điện thoại, đảm bảo độ giá trị tương đồng 1:1 với thang đo giấy trong đề tài nghiên cứu.
                  </Text>

                  <View style={styles.calibStepBox}>
                    <Text style={styles.calibStepText}>
                      👉 <Text style={{ fontWeight: '700' }}>Hướng dẫn:</Text> Đặt một chiếc thước kẻ milimet cơ học áp sát màn hình từ vạch 0 đến vạch 100 của thước màu đỏ bên dưới. Nếu có sai lệch do kính cường lực, dùng các nút +/- 0.5mm để tinh chỉnh.
                    </Text>
                  </View>

                  {/* Nút điều chỉnh */}
                  <View style={styles.calibAdjustRow}>
                    <TouchableOpacity
                      style={styles.calibAdjustBtn}
                      onPress={() => {
                        const newF = Math.max(0.7, Math.min(1.3, Math.round((calibrationFactor - 0.005) * 1000) / 1000));
                        setCalibrationFactor(newF);
                        setDiagnostics(getDisplayDiagnostics(newF));
                      }}
                    >
                      <Ionicons name="remove-circle-outline" size={18} color="#DC2626" />
                      <Text style={styles.calibAdjustBtnText}>- 0.5 mm</Text>
                    </TouchableOpacity>

                    <View style={{ alignItems: 'center' }}>
                      <Text style={styles.calibValueText}>
                        {(VAS_CLINICAL_LENGTH_MM * calibrationFactor).toFixed(1)} mm
                      </Text>
                      <Text style={styles.calibSubText}>
                        ({getCalibratedVASHeight(calibrationFactor)} pt • {(calibrationFactor * 100).toFixed(1)}%)
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.calibAdjustBtn}
                      onPress={() => {
                        const newF = Math.max(0.7, Math.min(1.3, Math.round((calibrationFactor + 0.005) * 1000) / 1000));
                        setCalibrationFactor(newF);
                        setDiagnostics(getDisplayDiagnostics(newF));
                      }}
                    >
                      <Ionicons name="add-circle-outline" size={18} color="#10B981" />
                      <Text style={styles.calibAdjustBtnText}>+ 0.5 mm</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.calibSecondaryRow}>
                    <TouchableOpacity
                      style={styles.calibSecondaryBtn}
                      onPress={async () => {
                        await resetCalibrationFactor();
                        setCalibrationFactor(1.0);
                        setDiagnostics(getDisplayDiagnostics(1.0));
                        Alert.alert('Khôi phục thành công', 'Đã đặt lại kích thước theo chuẩn tự động của hệ thống.');
                      }}
                    >
                      <Ionicons name="refresh" size={14} color="#64748B" />
                      <Text style={styles.calibSecondaryBtnText}>Đặt lại Mặc định (100mm)</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.calibSaveBtn}
                      onPress={async () => {
                        await saveCalibrationFactor(calibrationFactor);
                        Alert.alert('✅ Đã lưu', 'Kích thước thước đo 10cm đã được cập nhật thành công cho mọi phiên đo.');
                      }}
                    >
                      <Ionicons name="save-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.calibSaveBtnText}>Lưu Hiệu Chuẩn</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Vùng Thước kẻ trực quan 10cm */}
                <View style={styles.calibRulerCard}>
                  <Text style={styles.calibRulerTitle}>Đối chiếu Thước 10,0 cm (1:1 Thực tế)</Text>

                  <View style={styles.calibRulerArea}>
                    {/* Thước milimet */}
                    <View style={[styles.calibVirtualRuler, { height: getCalibratedVASHeight(calibrationFactor) }]}>
                      {Array.from({ length: 11 }).map((_, cm) => {
                        const top = ((10 - cm) / 10) * getCalibratedVASHeight(calibrationFactor);
                        const isMajor = cm === 0 || cm === 5 || cm === 10;
                        return (
                          <View key={`cm-calib-${cm}`} style={[styles.calibTickRow, { top: top - 1 }]}>
                            <View
                              style={[
                                styles.calibTickLine,
                                {
                                  width: isMajor ? 20 : 12,
                                  backgroundColor: isMajor ? '#0F172A' : '#64748B',
                                  height: isMajor ? 2.5 : 1.5,
                                },
                              ]}
                            />
                            <Text style={[styles.calibTickText, isMajor && styles.calibTickTextMajor]}>
                              {cm} cm
                            </Text>
                          </View>
                        );
                      })}
                    </View>

                    {/* Thanh VAS đỏ */}
                    <View style={styles.calibVasCol}>
                      <View style={styles.calibStopperTop} />
                      <View style={[styles.calibVasBar, { height: getCalibratedVASHeight(calibrationFactor) }]} />
                      <View style={styles.calibStopperBottom} />
                    </View>

                    {/* Thẻ CCCD đối chiếu 85.6mm */}
                    <View style={styles.calibCardRefCol}>
                      <View style={[styles.calibCardRefBox, { height: mmToPixels(REFERENCE_CARD_LENGTH_MM, calibrationFactor) }]}>
                        <Ionicons name="card-outline" size={16} color="#0284C7" />
                        <Text style={styles.calibCardRefTitle}>Thẻ CCCD / ATM</Text>
                        <Text style={styles.calibCardRefMm}>85.6 mm</Text>
                        <Text style={styles.calibCardRefSub}>(ISO 7810)</Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Thông số chẩn đoán thiết bị */}
                {diagnostics && (
                  <View style={styles.calibDiagCard}>
                    <Text style={styles.calibDiagTitle}>Thông số Màn hình Thiết bị</Text>
                    <View style={styles.calibDiagRow}>
                      <Text style={styles.calibDiagLabel}>Hệ điều hành:</Text>
                      <Text style={styles.calibDiagVal}>{diagnostics.os?.toUpperCase()}</Text>
                    </View>
                    <View style={styles.calibDiagRow}>
                      <Text style={styles.calibDiagLabel}>Độ phân giải màn hình:</Text>
                      <Text style={styles.calibDiagVal}>{diagnostics.screenWidth} × {diagnostics.screenHeight} pt/dp</Text>
                    </View>
                    <View style={styles.calibDiagRow}>
                      <Text style={styles.calibDiagLabel}>Mật độ điểm ảnh (PixelRatio):</Text>
                      <Text style={styles.calibDiagVal}>{diagnostics.pixelRatio}x</Text>
                    </View>
                    <View style={styles.calibDiagRow}>
                      <Text style={styles.calibDiagLabel}>Tỉ lệ quy đổi mm:</Text>
                      <Text style={styles.calibDiagVal}>{diagnostics.basePointsPerMm} pt/mm</Text>
                    </View>
                    <View style={styles.calibDiagRow}>
                      <Text style={styles.calibDiagLabel}>Chiều cao VAS 100mm xuất xưởng:</Text>
                      <Text style={styles.calibDiagVal}>{diagnostics.calculatedHeight100mm} pt/dp</Text>
                    </View>
                    <View style={styles.calibDiagRow}>
                      <Text style={styles.calibDiagLabel}>Chiều cao VAS sau hiệu chuẩn:</Text>
                      <Text style={[styles.calibDiagVal, { color: '#0284C7', fontWeight: '800' }]}>
                        {diagnostics.finalCalibratedHeight} pt/dp
                      </Text>
                    </View>
                  </View>
                )}
                <View style={{ height: 40 }} />
              </ScrollView>
            )}
          </>
        )}

        {/* Modals Quản lý Tài khoản & Mã PIN (Chỉ hiển thị cho Quản trị viên Admin) */}
        {isAdmin && (
          <>
            <Modal
          visible={isAccountModalOpen}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsAccountModalOpen(false)}
        >
          <KeyboardAvoidingView
            style={styles.nestedModalBackdrop}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.nestedModalCard}>
              <View style={styles.nestedModalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nestedModalTitle}>
                    {editingAccount ? 'Chỉnh sửa tài khoản NCV' : 'Thêm tài khoản NCV mới'}
                  </Text>
                  <Text style={styles.nestedModalSubtitle}>
                    Lưu & đồng bộ trực tiếp vào Cơ sở dữ liệu (CSDL)
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setIsAccountModalOpen(false)}
                  style={styles.nestedModalCloseBtn}
                >
                  <Ionicons name="close" size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.nestedModalBody} bounces={false}>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Họ và tên Nghiên cứu viên / Bác sĩ: *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={accName}
                    onChangeText={setAccName}
                    placeholder="VD: BS. Nguyễn Văn A"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Học vị / Chức danh:</Text>
                  <TextInput
                    style={styles.formInput}
                    value={accTitle}
                    onChangeText={setAccTitle}
                    placeholder="VD: ThS. BS Lâm sàng"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Email tài khoản: *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={accEmail}
                    onChangeText={setAccEmail}
                    placeholder="VD: bs.a@smartvas.vn"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>

                <View style={styles.formRow}>
                  <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                    <Text style={styles.label}>Mã PIN nhanh (4 - 6 số): *</Text>
                    <TextInput
                      style={[styles.formInput, { fontWeight: '700', letterSpacing: 4 }]}
                      value={accPin}
                      onChangeText={setAccPin}
                      placeholder="VD: 1234"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      maxLength={6}
                    />
                  </View>

                  <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                    <Text style={styles.label}>Mật khẩu Email:</Text>
                    <TextInput
                      style={styles.formInput}
                      value={accPassword}
                      onChangeText={setAccPassword}
                      placeholder="Mật khẩu"
                      placeholderTextColor="#94A3B8"
                      secureTextEntry
                    />
                  </View>
                </View>

                {/* Vai trò */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Vai trò / Quyền hạn trong đề tài:</Text>
                  <View style={styles.choiceRow}>
                    <TouchableOpacity
                      style={[
                        styles.choiceBtn,
                        accRole === 'ncv' && styles.choiceBtnActiveNCV,
                      ]}
                      onPress={() => setAccRole('ncv')}
                    >
                      <Ionicons
                        name="person"
                        size={16}
                        color={accRole === 'ncv' ? '#0284C7' : '#64748B'}
                      />
                      <Text
                        style={[
                          styles.choiceBtnText,
                          accRole === 'ncv' && styles.choiceBtnTextActiveNCV,
                        ]}
                      >
                        Nghiên cứu viên (NCV)
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.choiceBtn,
                        accRole === 'admin' && styles.choiceBtnActiveAdmin,
                      ]}
                      onPress={() => setAccRole('admin')}
                    >
                      <Ionicons
                        name="shield"
                        size={16}
                        color={accRole === 'admin' ? '#D97706' : '#64748B'}
                      />
                      <Text
                        style={[
                          styles.choiceBtnText,
                          accRole === 'admin' && styles.choiceBtnTextActiveAdmin,
                        ]}
                      >
                        Quản trị viên (Admin)
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Trạng thái hoạt động */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Trạng thái tài khoản:</Text>
                  <View style={styles.choiceRow}>
                    <TouchableOpacity
                      style={[
                        styles.choiceBtn,
                        accIsActive && styles.choiceBtnActiveGreen,
                      ]}
                      onPress={() => setAccIsActive(true)}
                    >
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color={accIsActive ? '#059669' : '#64748B'}
                      />
                      <Text
                        style={[
                          styles.choiceBtnText,
                          accIsActive && { color: '#059669', fontWeight: '700' },
                        ]}
                      >
                        Đang hoạt động
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.choiceBtn,
                        !accIsActive && styles.choiceBtnActiveGray,
                      ]}
                      onPress={() => setAccIsActive(false)}
                    >
                      <Ionicons
                        name="pause-circle"
                        size={16}
                        color={!accIsActive ? '#DC2626' : '#64748B'}
                      />
                      <Text
                        style={[
                          styles.choiceBtnText,
                          !accIsActive && { color: '#DC2626', fontWeight: '700' },
                        ]}
                      >
                        Tạm khóa
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>

              <View style={styles.nestedModalFooter}>
                <TouchableOpacity
                  style={styles.nestedCancelBtn}
                  onPress={() => setIsAccountModalOpen(false)}
                >
                  <Text style={styles.nestedCancelBtnText}>Hủy</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.nestedSubmitBtn}
                  onPress={handleSaveAccount}
                  activeOpacity={0.85}
                >
                  <Ionicons name="save-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.nestedSubmitBtnText}>Lưu vào CSDL</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Modal Đổi mã PIN nhanh */}
        <Modal
          visible={isPinModalOpen}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setIsPinModalOpen(false)}
        >
          <KeyboardAvoidingView
            style={styles.nestedModalBackdrop}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={[styles.nestedModalCard, { maxHeight: 380 }]}>
              <View style={styles.nestedModalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nestedModalTitle}>Đổi mã PIN nhanh</Text>
                  <Text style={styles.nestedModalSubtitle}>
                    Cập nhật mã PIN cá nhân cho NCV trên CSDL
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setIsPinModalOpen(false);
                    setPinChangeTarget(null);
                    setNewPinValue('');
                  }}
                  style={styles.nestedModalCloseBtn}
                >
                  <Ionicons name="close" size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              <View style={styles.nestedModalBody}>
                <View style={styles.quickPinTargetInfo}>
                  <Ionicons name="person-circle" size={32} color="#0284C7" />
                  <View style={{ marginLeft: 10 }}>
                    <Text style={styles.quickPinTargetName}>{pinChangeTarget?.name}</Text>
                    <Text style={styles.quickPinTargetEmail}>{pinChangeTarget?.email}</Text>
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Nhập mã PIN mới (4 - 6 số):</Text>
                  <TextInput
                    style={[styles.pinInput, { marginBottom: 4 }]}
                    value={newPinValue}
                    onChangeText={setNewPinValue}
                    placeholder="• • • •"
                    keyboardType="numeric"
                    maxLength={6}
                    textAlign="center"
                    placeholderTextColor="#94A3B8"
                    autoFocus={true}
                  />
                  <Text style={styles.pinHintUnderText}>
                    * Mã PIN này sẽ được lưu ngay vào CSDL để đăng nhập nhanh tại giường bệnh.
                  </Text>
                </View>
              </View>

              <View style={styles.nestedModalFooter}>
                <TouchableOpacity
                  style={styles.nestedCancelBtn}
                  onPress={() => {
                    setIsPinModalOpen(false);
                    setPinChangeTarget(null);
                    setNewPinValue('');
                  }}
                >
                  <Text style={styles.nestedCancelBtnText}>Hủy</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.nestedSubmitBtn}
                  onPress={handleSaveNewPin}
                  activeOpacity={0.85}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.nestedSubmitBtnText}>Cập nhật mã PIN</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
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
  patientActionDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 4,
  },
  patientActionDeleteText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  // Permission Banners & Badges
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  permissionBannerAdmin: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  permissionBannerNCV: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  permissionBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  permissionTextAdmin: {
    color: '#92400E',
  },
  permissionTextNCV: {
    color: '#0369A1',
  },
  permissionBannerSub: {
    fontSize: 12,
    lineHeight: 16,
  },
  permissionSubAdmin: {
    color: '#B45309',
  },
  permissionSubNCV: {
    color: '#0284C7',
  },
  // Creator Filter (Admin)
  creatorFilterContainer: {
    marginBottom: 12,
  },
  creatorFilterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
  },
  creatorFilterScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  creatorPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  creatorPillActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  creatorPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  creatorPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  // Creator Badges on Cards
  myCreatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    gap: 4,
  },
  myCreatorBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  otherCreatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    gap: 4,
  },
  otherCreatorBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4338CA',
  },
  // Creator Form Info Box
  creatorFormInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  creatorFormInfoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0369A1',
    marginBottom: 2,
  },
  creatorFormInfoText: {
    fontSize: 12,
    color: '#0284C7',
    lineHeight: 16,
  },
  formInputDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    color: '#64748B',
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

  // Auth Info Note Box
  authInfoNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 10,
    padding: 10,
    gap: 8,
    marginTop: 4,
  },
  authInfoNoteText: {
    fontSize: 12,
    color: '#0369A1',
    flex: 1,
    lineHeight: 16,
  },

  // DB Info Banner
  dbInfoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    gap: 12,
  },
  dbInfoIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dbInfoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0369A1',
    marginBottom: 2,
  },
  dbInfoDesc: {
    fontSize: 12,
    color: '#0284C7',
    lineHeight: 16,
  },

  // Account Card
  accountCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  accountAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountAvatarNCV: {
    backgroundColor: '#E0F2FE',
  },
  accountAvatarAdmin: {
    backgroundColor: '#FEF3C7',
  },
  accountNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountNameText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  accountTitleText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  accountBadgesCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  roleTag: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  roleTagNCV: {
    backgroundColor: '#E0F2FE',
  },
  roleTagAdmin: {
    backgroundColor: '#FEF3C7',
  },
  roleTagText: {
    fontSize: 11,
    fontWeight: '800',
  },
  roleTagTextNCV: {
    color: '#0284C7',
  },
  roleTagTextAdmin: {
    color: '#D97706',
  },
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    gap: 4,
  },
  statusTagActive: {
    backgroundColor: '#ECFDF5',
  },
  statusTagInactive: {
    backgroundColor: '#F1F5F9',
  },
  statusDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusTagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  accountEmailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    paddingLeft: 2,
  },
  accountEmailText: {
    fontSize: 13,
    color: '#475569',
  },
  accountPinBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  accountPinLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  accountPinLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  accountPinValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0284C7',
    letterSpacing: 3,
    marginLeft: 4,
  },
  pinEyeBtn: {
    padding: 4,
    marginLeft: 4,
  },
  changePinQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    gap: 4,
  },
  changePinQuickBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
  accountActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  accountActionEditBtn: {
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
  accountActionEditText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  accountActionToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 4,
  },
  accountActionToggleBtnActive: {
    backgroundColor: '#ECFDF5',
  },
  accountActionToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  accountActionDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 4,
  },
  accountActionDeleteText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },

  // Nested Modal Styles (Add/Edit & PIN)
  nestedModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    padding: 20,
  },
  nestedModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
  nestedModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
  },
  nestedModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  nestedModalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  nestedModalCloseBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
  },
  nestedModalBody: {
    padding: 18,
  },
  nestedModalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
  },
  nestedCancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  nestedCancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  nestedSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284C7',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  nestedSubmitBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  choiceRow: {
    flexDirection: 'row',
    gap: 10,
  },
  choiceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    gap: 6,
  },
  choiceBtnActiveNCV: {
    backgroundColor: '#E0F2FE',
    borderColor: '#0284C7',
  },
  choiceBtnActiveAdmin: {
    backgroundColor: '#FEF3C7',
    borderColor: '#D97706',
  },
  choiceBtnActiveGreen: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669',
  },
  choiceBtnActiveGray: {
    backgroundColor: '#FEF2F2',
    borderColor: '#DC2626',
  },
  choiceBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  choiceBtnTextActiveNCV: {
    color: '#0284C7',
    fontWeight: '700',
  },
  choiceBtnTextActiveAdmin: {
    color: '#D97706',
    fontWeight: '700',
  },
  quickPinTargetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    marginBottom: 16,
  },
  quickPinTargetName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  quickPinTargetEmail: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  pinHintUnderText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 6,
    lineHeight: 16,
  },

  // Calibration Tab Styles
  calibCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  calibHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  calibHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  calibDescription: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
  },
  calibStepBox: {
    marginTop: 10,
    backgroundColor: '#F0F9FF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  calibStepText: {
    fontSize: 12,
    color: '#0369A1',
    lineHeight: 18,
  },
  calibAdjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 12,
  },
  calibAdjustBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  calibAdjustBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  calibValueText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0284C7',
  },
  calibSubText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  calibSecondaryRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  calibSecondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  calibSecondaryBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  calibSaveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0284C7',
    paddingVertical: 10,
    borderRadius: 10,
  },
  calibSaveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  calibRulerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  calibRulerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
    textAlign: 'center',
  },
  calibRulerArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  calibVirtualRuler: {
    position: 'relative',
    width: 110,
    borderRightWidth: 1.5,
    borderRightColor: '#CBD5E1',
  },
  calibTickRow: {
    position: 'absolute',
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  calibTickLine: {
    borderRadius: 1,
  },
  calibTickText: {
    fontSize: 9,
    color: '#64748B',
    marginLeft: 4,
  },
  calibTickTextMajor: {
    fontWeight: '800',
    color: '#0F172A',
    fontSize: 10,
  },
  calibVasCol: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  calibStopperTop: {
    width: 32,
    height: 3.5,
    backgroundColor: '#DC2626',
    borderRadius: 2,
  },
  calibStopperBottom: {
    width: 32,
    height: 3.5,
    backgroundColor: '#10B981',
    borderRadius: 2,
  },
  calibVasBar: {
    width: 14,
    backgroundColor: '#DC2626',
    borderRadius: 7,
  },
  calibCardRefCol: {
    width: 90,
    alignItems: 'center',
  },
  calibCardRefBox: {
    width: 82,
    backgroundColor: '#F0F9FF',
    borderWidth: 1.5,
    borderColor: '#0284C7',
    borderStyle: 'dashed',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  calibCardRefTitle: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0369A1',
    marginTop: 2,
    textAlign: 'center',
  },
  calibCardRefMm: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0284C7',
    marginTop: 2,
  },
  calibCardRefSub: {
    fontSize: 8,
    color: '#64748B',
    marginTop: 1,
  },
  calibDiagCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  calibDiagTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  calibDiagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  calibDiagLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  calibDiagVal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
});
