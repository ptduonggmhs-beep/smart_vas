import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TimePoint, AssistanceStatus, AppUser } from '../types';
import { StorageService } from '../services/storageService';
import { FirebaseService } from '../services/firebaseService';

interface IdentificationScreenProps {
  onStart: (studyId: string, timepoint: TimePoint, assistance: AssistanceStatus) => void;
  onOpenResearcher: () => void;
  onOpenHistory?: (studyId: string) => void;
  currentUser?: AppUser | null;
}

export const IdentificationScreen: React.FC<IdentificationScreenProps> = ({
  onStart,
  onOpenResearcher,
  onOpenHistory,
  currentUser,
}) => {
  const [studyId, setStudyId] = useState<string>('');
  const [savedStudyId, setSavedStudyId] = useState<string>('');
  const [isUsingSavedId, setIsUsingSavedId] = useState<boolean>(false);
  const [isLoadingCache, setIsLoadingCache] = useState<boolean>(true);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isCheckingCode, setIsCheckingCode] = useState<boolean>(false);

  const selectedTimepoint: TimePoint = 'T1';
  const [assistance, setAssistance] = useState<AssistanceStatus>('self');

  // Đọc mã người tham gia đã lưu cache trước đó
  useEffect(() => {
    StorageService.getCachedPatientStudyId().then((cached) => {
      if (cached) {
        setStudyId(cached);
        setSavedStudyId(cached);
        setIsUsingSavedId(true);
      }
      setIsLoadingCache(false);
    });
  }, []);

  // Nút kiểm tra và lưu mã người tham gia
  const handleCheckAndSaveCode = async () => {
    const trimmed = studyId.trim().toUpperCase();
    if (!trimmed) {
      Alert.alert(
        'Chưa nhập mã',
        'Vui lòng nhập Mã người tham gia do nhân viên y tế cấp trước khi kiểm tra.'
      );
      return;
    }

    setIsCheckingCode(true);

    try {
      const existingPatient = await FirebaseService.getPatient(trimmed);

      if (!existingPatient) {
        setIsCheckingCode(false);
        Alert.alert(
          '⚠️ Mã không tồn tại',
          `Mã người tham gia "${trimmed}" chưa tồn tại trong danh sách nghiên cứu của khoa.\n\nChị vui lòng kiểm tra lại mã trên thẻ/vòng tay hoặc liên hệ Nghiên cứu viên (NCV) để được cấp mã.`,
          [{ text: 'Đã hiểu', style: 'default' }]
        );
        return;
      }

      // Lưu mã hợp lệ vào bộ nhớ cache của máy và chuyển ngay sang giao diện đã lưu
      await StorageService.setCachedPatientStudyId(trimmed);
      setSavedStudyId(trimmed);
      setStudyId(trimmed);
      setIsUsingSavedId(true);
      setIsCheckingCode(false);
    } catch (e: any) {
      setIsCheckingCode(false);
      Alert.alert('Lỗi kiểm tra', 'Không thể xác thực mã người tham gia. Vui lòng thử lại.');
    }
  };

  const handleStart = async () => {
    const targetId = isUsingSavedId && savedStudyId ? savedStudyId : studyId;
    const trimmed = targetId.trim().toUpperCase();
    if (!trimmed) {
      Alert.alert(
        'Chưa có mã',
        'Vui lòng nhập Mã người tham gia do nhân viên y tế cấp (trên vòng tay hoặc hồ sơ).'
      );
      return;
    }

    setIsValidating(true);

    try {
      // 1. KIỂM TRA MÃ CÓ TỒN TẠI TRONG CƠ SỞ DỮ LIỆU ĐỀ TÀI HAY KHÔNG
      const existingPatient = await FirebaseService.getPatient(trimmed);

      if (!existingPatient) {
        setIsValidating(false);
        Alert.alert(
          '⚠️ Mã không tồn tại',
          `Mã người tham gia "${trimmed}" chưa tồn tại trong danh sách nghiên cứu của khoa.\n\nChị vui lòng kiểm tra lại mã trên thẻ/vòng tay hoặc liên hệ Nghiên cứu viên (NCV) để được cấp mã trước khi bắt đầu.`,
          [{ text: 'Đã hiểu', style: 'default' }]
        );
        return; // DỪNG VIỆC ĐÁNH GIÁ NGAY LẬP TỨC
      }

      // 2. MÃ HỢP LỆ VÀ ĐÃ TỒN TẠI -> LƯU VÀO BỘ NHỚ VÀ TIẾP TỤC ĐÁNH GIÁ
      await StorageService.setCachedPatientStudyId(trimmed);
      setSavedStudyId(trimmed);
      setStudyId(trimmed);
      setIsUsingSavedId(true);
      setIsValidating(false);

      onStart(trimmed, selectedTimepoint, assistance);
    } catch (e: any) {
      setIsValidating(false);
      Alert.alert('Lỗi kiểm tra', 'Không thể xác thực mã người tham gia. Vui lòng thử lại.');
    }
  };

  const handleSwitchToManualInput = () => {
    setIsUsingSavedId(false);
  };

  const handleUseSavedId = () => {
    setStudyId(savedStudyId);
    setIsUsingSavedId(true);
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        {/* Top Clinical Bar */}
        <View style={styles.topBar}>
          <View style={styles.hospitalBadge}>
            <Ionicons name="medical" size={16} color="#0284C7" />
            <Text style={styles.hospitalText}>Khoa Phụ Sản • Hệ thống eVAS</Text>
          </View>

          <TouchableOpacity
            style={[styles.ncvButton, currentUser && styles.ncvButtonActive]}
            onPress={onOpenResearcher}
            activeOpacity={0.7}
          >
            <Ionicons
              name={currentUser ? 'shield-checkmark' : 'lock-closed-outline'}
              size={16}
              color={currentUser ? '#0284C7' : '#64748B'}
            />
            <Text style={[styles.ncvButtonText, currentUser && styles.ncvButtonTextActive]}>
              {currentUser ? currentUser.name.split('. ')[1] || 'NCV' : 'NCV'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Title & Introduction */}
        <View style={styles.headerSection}>
          <Text style={styles.screenTitle}>Bắt đầu đánh giá</Text>
          <Text style={styles.subTitle}>Đánh giá đau sau mổ</Text>
          <Text style={styles.description}>
            Chị hãy cho biết mức độ đau của mình tại thời điểm hiện tại.
          </Text>
        </View>

        {/* --- KHU VỰC MÃ NGƯỜI THAM GIA (CÓ CACHE GỢI Ý & XEM LỊCH SỬ) --- */}
        {isLoadingCache ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color="#0284C7" />
          </View>
        ) : isUsingSavedId && savedStudyId ? (
          /* TRƯỜNG HỢP 1: ĐÃ CÓ MÃ LƯU TRONG BỘ NHỚ -> HIỂN THỊ GỢI Ý & NÚT XEM LỊCH SỬ */
          <View style={styles.savedIdCard}>
            <View style={styles.savedIdHeaderRow}>
              <View style={styles.savedIconCircle}>
                <Ionicons name="person" size={24} color="#0284C7" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.savedIdPrompt}>Mã người tham gia của chị:</Text>
                <Text style={styles.savedIdText}>{savedStudyId}</Text>
              </View>
              <View style={styles.savedBadgeTag}>
                <Ionicons name="checkmark-circle" size={14} color="#059669" />
                <Text style={styles.savedBadgeText}>Đã ghi nhớ</Text>
              </View>
            </View>

            <View style={styles.savedIdDivider} />

            <View style={styles.savedActionsRow}>
              {onOpenHistory && (
                <TouchableOpacity
                  style={styles.historyLinkButton}
                  onPress={() => onOpenHistory(savedStudyId)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="time-outline" size={16} color="#0284C7" />
                  <Text style={styles.historyLinkText}>Xem lịch sử đánh giá</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.changeIdButton}
                onPress={handleSwitchToManualInput}
                activeOpacity={0.7}
              >
                <Ionicons name="create-outline" size={16} color="#64748B" />
                <Text style={styles.changeIdText}>Đổi mã</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* TRƯỜNG HỢP 2: CHƯA CÓ MÃ HOẶC MUỐN NHẬP / ĐỔI MÃ MỚI */
          <View style={styles.card}>
            <Text style={styles.inputLabel}>
              {savedStudyId ? 'Đổi mã người tham gia:' : 'Nhập mã người tham gia (do NCV cấp):'}
            </Text>
            <View style={styles.inputContainer}>
              <Ionicons name="barcode-outline" size={26} color="#0284C7" style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                value={studyId}
                onChangeText={(text) => setStudyId(text.toUpperCase())}
                placeholder="VD: CS001"
                placeholderTextColor="#94A3B8"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={12}
                autoFocus={true}
              />
              {studyId.length > 0 && (
                <TouchableOpacity onPress={() => setStudyId('')} style={styles.clearBtn}>
                  <Ionicons name="close-circle" size={20} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Nút check để kiểm tra và lưu mã */}
            <TouchableOpacity
              style={[
                styles.checkCodeButton,
                (!studyId.trim() || isCheckingCode) && styles.checkCodeButtonDisabled,
              ]}
              onPress={handleCheckAndSaveCode}
              disabled={!studyId.trim() || isCheckingCode}
              activeOpacity={0.8}
            >
              {isCheckingCode ? (
                <View style={styles.checkButtonInner}>
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.checkCodeButtonText}>Đang xác thực mã...</Text>
                </View>
              ) : (
                <View style={styles.checkButtonInner}>
                  <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.checkCodeButtonText}>Kiểm tra & Lưu mã</Text>
                </View>
              )}
            </TouchableOpacity>

            {savedStudyId ? (
              <TouchableOpacity
                style={styles.revertSavedBtn}
                onPress={handleUseSavedId}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-undo-outline" size={14} color="#0284C7" />
                <Text style={styles.revertSavedText}>
                  Hủy đổi mã, dùng lại ({savedStudyId})
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.inputHelpText}>
                * Chị chỉ cần nhập mã một lần và bấm {'"Kiểm tra & Lưu mã"'}. Ứng dụng sẽ ghi nhớ mã này cho các lần đánh giá tiếp theo.
              </Text>
            )}
          </View>
        )}

        {/* Assistance status toggle */}
        <View style={styles.cardSecondary}>
          <Text style={styles.assistanceTitle}>Hình thức thao tác:</Text>
          <View style={styles.assistanceButtons}>
            <TouchableOpacity
              style={[
                styles.assistBtn,
                assistance === 'self' && styles.assistBtnActive,
              ]}
              onPress={() => setAssistance('self')}
            >
              <Ionicons
                name="person-outline"
                size={16}
                color={assistance === 'self' ? '#0284C7' : '#64748B'}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.assistBtnText,
                  assistance === 'self' && styles.assistBtnTextActive,
                ]}
              >
                Sản phụ tự làm
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.assistBtn,
                assistance === 'assisted' && styles.assistBtnActive,
              ]}
              onPress={() => setAssistance('assisted')}
            >
              <Ionicons
                name="medkit-outline"
                size={16}
                color={assistance === 'assisted' ? '#0284C7' : '#64748B'}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.assistBtnText,
                  assistance === 'assisted' && styles.assistBtnTextActive,
                ]}
              >
                Có NCV trợ giúp
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom CTA Button */}
        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={[styles.primaryButton, isValidating && styles.buttonDisabled]}
            onPress={handleStart}
            disabled={isValidating}
            activeOpacity={0.85}
          >
            {isValidating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.primaryButtonText}>
                  {isUsingSavedId && savedStudyId
                    ? `Bắt đầu đánh giá (Mã ${savedStudyId})`
                    : 'Bắt đầu đánh giá'}
                </Text>
                <Ionicons name="arrow-forward" size={22} color="#FFFFFF" style={styles.btnIcon} />
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.privacyNote}>
            * Ứng dụng chỉ ghi nhận Mã người tham gia. Tuyệt đối không lưu họ tên hay số điện thoại để bảo mật danh tính.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 24,
    paddingTop: 16,
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  hospitalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  hospitalText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0369A1',
    marginLeft: 6,
  },
  topActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    gap: 4,
  },
  historyTopBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284C7',
  },
  ncvButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  ncvButtonActive: {
    backgroundColor: '#E0F2FE',
    borderColor: '#BAE6FD',
  },
  ncvButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginLeft: 4,
  },
  ncvButtonTextActive: {
    color: '#0284C7',
    fontWeight: '700',
  },
  headerSection: {
    marginBottom: 20,
    alignItems: 'center',
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  subTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0284C7',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  loadingBox: {
    padding: 30,
    alignItems: 'center',
  },

  // Saved ID Card (Gợi ý mã đã lưu)
  savedIdCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 18,
    borderWidth: 2,
    borderColor: '#BAE6FD',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  savedIdHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  savedIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  savedIdPrompt: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  savedIdText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0284C7',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  savedBadgeTag: {
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
  savedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  savedIdDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  savedActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 6,
  },
  historyLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284C7',
  },
  changeIdButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 4,
  },
  changeIdText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },

  // Manual Input Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 10,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#BAE6FD',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 60,
    marginBottom: 10,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: 2,
    textAlign: 'center',
  },
  clearBtn: {
    padding: 6,
  },
  revertSavedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    gap: 6,
    marginTop: 4,
  },
  revertSavedText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0284C7',
  },
  inputHelpText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 17,
    marginTop: 4,
  },

  // Nút kiểm tra & lưu mã
  checkCodeButton: {
    backgroundColor: '#0284C7',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    marginBottom: 8,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  checkCodeButtonDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
    elevation: 0,
  },
  checkButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCodeButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Secondary Timepoint Card
  cardSecondary: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  assistanceTitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 8,
  },
  assistanceButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  assistBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  assistBtnActive: {
    backgroundColor: '#E0F2FE',
    borderColor: '#0284C7',
  },
  assistBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },
  assistBtnTextActive: {
    color: '#0369A1',
    fontWeight: '700',
  },
  bottomSection: {
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: '#0284C7',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  buttonDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnIcon: {
    marginLeft: 8,
  },
  privacyNote: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 16,
  },
});
