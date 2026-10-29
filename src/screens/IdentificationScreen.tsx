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
import { AppUser } from '../types';
import { StorageService } from '../services/storageService';
import { FirebaseService } from '../services/firebaseService';

interface IdentificationScreenProps {
  onStart: (patientCode: string) => void;
  onOpenResearcher: () => void;
  onOpenHistory?: (patientCode: string) => void;
  currentUser?: AppUser | null;
}

export const IdentificationScreen: React.FC<IdentificationScreenProps> = ({
  onStart,
  onOpenResearcher,
  onOpenHistory,
  currentUser,
}) => {
  const [patientCode, setPatientCode] = useState<string>('');
  const [savedPatientCode, setSavedPatientCode] = useState<string>('');
  const [isLoadingCache, setIsLoadingCache] = useState<boolean>(true);
  const [isValidating, setIsValidating] = useState<boolean>(false);

  // Đọc mã đã lưu trong bộ nhớ máy nếu có
  useEffect(() => {
    StorageService.getCachedPatientStudyId().then((cached) => {
      if (cached) {
        setPatientCode(cached);
        setSavedPatientCode(cached);
      }
      setIsLoadingCache(false);
    });
  }, []);

  const handleContinue = async () => {
    const trimmed = patientCode.trim().toUpperCase();
    if (!trimmed) {
      Alert.alert('Chưa nhập mã', 'Vui lòng nhập Mã bệnh nhân trước khi tiếp tục.');
      return;
    }

    setIsValidating(true);
    try {
      // Lưu vào cache để sử dụng lại thuận tiện
      await StorageService.setCachedPatientStudyId(trimmed);

      // Đảm bảo hồ sơ bệnh nhân tồn tại hoặc khởi tạo mới trong CSDL
      const existingPatient = await FirebaseService.getPatient(trimmed);
      if (!existingPatient) {
        // Tự động tạo hồ sơ bệnh nhân tối thiểu theo mã nếu chưa có
        await FirebaseService.savePatient({
          study_id: trimmed,
          created_at: new Date().toISOString(),
          created_by: currentUser?.id || 'app-operator',
          created_by_name: currentUser?.name || 'Nhân viên y tế',
        });
      }

      setIsValidating(false);
      onStart(trimmed);
    } catch {
      setIsValidating(false);
      // Nếu ngoại tuyến vẫn cho phép tiếp tục đánh giá
      onStart(trimmed);
    }
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
            <Text style={styles.hospitalText}>Hệ thống eVAS • Ghi nhận đau sau mổ</Text>
          </View>

          <TouchableOpacity
            style={[styles.ncvButton, currentUser && styles.ncvButtonActive]}
            onPress={onOpenResearcher}
            activeOpacity={0.7}
          >
            <Ionicons
              name={currentUser ? 'shield-checkmark' : 'lock-closed-outline'}
              size={15}
              color={currentUser ? '#0284C7' : '#64748B'}
            />
            <Text style={[styles.ncvButtonText, currentUser && styles.ncvButtonTextActive]}>
              {currentUser ? currentUser.name.split('. ')[1] || 'NCV' : 'NCV'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Header & Step Indicator */}
        <View style={styles.headerSection}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepIndicatorText}>Bước 1/2 • Nhập mã bệnh nhân</Text>
          </View>
          <Text style={styles.screenTitle}>Bắt đầu lượt đánh giá</Text>
          <Text style={styles.description}>
            Ứng dụng ghi nhận mức độ đau sau phẫu thuật theo quy chuẩn thang đo VAS điện tử.
          </Text>
        </View>

        {/* Khung nhập mã bệnh nhân tinh gọn */}
        <View style={styles.card}>
          <Text style={styles.inputLabel}>Mã bệnh nhân</Text>

          {isLoadingCache ? (
            <ActivityIndicator size="small" color="#0284C7" style={{ marginVertical: 16 }} />
          ) : (
            <View style={styles.inputContainer}>
              <Ionicons name="barcode-outline" size={24} color="#0284C7" style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                value={patientCode}
                onChangeText={(text) => setPatientCode(text.toUpperCase())}
                placeholder="VD: CS001"
                placeholderTextColor="#94A3B8"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={16}
                autoFocus={!savedPatientCode}
              />
              {patientCode.length > 0 && (
                <TouchableOpacity onPress={() => setPatientCode('')} style={styles.clearBtn}>
                  <Ionicons name="close-circle" size={20} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Nút xem lịch sử nếu có mã */}
          {savedPatientCode && onOpenHistory && (
            <TouchableOpacity
              style={styles.historyLinkRow}
              onPress={() => onOpenHistory(patientCode || savedPatientCode)}
              activeOpacity={0.7}
            >
              <Ionicons name="time-outline" size={15} color="#0284C7" />
              <Text style={styles.historyLinkText}>Xem lịch sử đánh giá của bệnh nhân này</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Nút Tiếp tục sang Bước 2/2 */}
        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={[styles.primaryButton, (!patientCode.trim() || isValidating) && styles.buttonDisabled]}
            onPress={handleContinue}
            disabled={!patientCode.trim() || isValidating}
            activeOpacity={0.85}
          >
            {isValidating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.primaryButtonText}>Tiếp tục</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" style={styles.btnIcon} />
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.privacyNote}>
            * Thời điểm đánh giá đầu tiên sẽ được tự động ghi nhận là T0 sau khi lưu kết quả.
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
    padding: 18,
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  hospitalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  hospitalText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0369A1',
    marginLeft: 6,
  },
  ncvButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  ncvButtonActive: {
    borderColor: '#BAE6FD',
    backgroundColor: '#F0F9FF',
  },
  ncvButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  ncvButtonTextActive: {
    color: '#0284C7',
    fontWeight: '700',
  },
  headerSection: {
    marginBottom: 20,
  },
  stepBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E0F2FE',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginBottom: 8,
  },
  stepIndicatorText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  description: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#BAE6FD',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 56,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: 1.5,
  },
  clearBtn: {
    padding: 6,
  },
  historyLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 6,
  },
  historyLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0284C7',
  },
  bottomSection: {
    marginTop: 'auto',
    paddingBottom: 10,
  },
  primaryButton: {
    backgroundColor: '#0284C7',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    elevation: 3,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  buttonDisabled: {
    backgroundColor: '#94A3B8',
    elevation: 0,
    shadowOpacity: 0,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnIcon: {
    marginLeft: 6,
  },
  privacyNote: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 16,
  },
});
