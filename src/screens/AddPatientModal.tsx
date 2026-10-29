import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Patient, AppUser } from '../types';
import { FirebaseService } from '../services/firebaseService';

interface AddPatientModalProps {
  visible: boolean;
  initialMsba: string;
  onClose: () => void;
  onPatientSaved: (patient: Patient) => void;
  currentUser?: AppUser | null;
}

export const AddPatientModal: React.FC<AddPatientModalProps> = ({
  visible,
  initialMsba,
  onClose,
  onPatientSaved,
  currentUser,
}) => {
  const [msba, setMsba] = useState<string>('');
  const [patientName, setPatientName] = useState<string>('');
  const [birthYear, setBirthYear] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (visible) {
      setMsba(initialMsba ? initialMsba.trim().toUpperCase() : '');
      setPatientName('');
      setBirthYear('');
      setErrorMessage('');
      setIsSaving(false);
    }
  }, [visible, initialMsba]);

  const handleSave = async () => {
    const trimmedMsba = msba.trim().toUpperCase();
    const trimmedName = patientName.trim();
    const trimmedYear = birthYear.trim();

    if (!trimmedMsba) {
      setErrorMessage('Vui lòng nhập Mã số bệnh án (MSBA).');
      return;
    }
    if (!trimmedName) {
      setErrorMessage('Vui lòng nhập Họ và tên bệnh nhân.');
      return;
    }
    if (!trimmedYear) {
      setErrorMessage('Vui lòng nhập Năm sinh của bệnh nhân.');
      return;
    }

    const yearNum = parseInt(trimmedYear, 10);
    const currentYear = new Date().getFullYear();
    if (isNaN(yearNum) || yearNum < 1900 || yearNum > currentYear) {
      setErrorMessage(`Năm sinh không hợp lệ (từ 1900 đến ${currentYear}).`);
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    try {
      // Kiểm tra trùng MSBA nếu có
      const existing = await FirebaseService.getPatient(trimmedMsba);
      if (existing) {
        setIsSaving(false);
        setErrorMessage(`Mã bệnh án "${trimmedMsba}" đã tồn tại trên hệ thống.`);
        return;
      }

      const newPatient: Patient = {
        study_id: trimmedMsba,
        medical_record_number: trimmedMsba,
        patient_name: trimmedName,
        birth_year: yearNum,
        t0_timestamp: null,
        created_at: new Date().toISOString(),
        created_by: currentUser?.id || 'ncv-01',
        created_by_name: currentUser?.name || 'Nhân viên y tế',
      };

      const result = await FirebaseService.savePatient(newPatient, currentUser);
      setIsSaving(false);

      if (result.success) {
        onPatientSaved(newPatient);
      } else {
        Alert.alert('Thông báo', result.error || 'Đã lưu cục bộ hồ sơ bệnh nhân.');
        onPatientSaved(newPatient);
      }
    } catch (err: any) {
      setIsSaving(false);
      setErrorMessage(err?.message || 'Có lỗi xảy ra khi lưu bệnh nhân.');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalWrapper}
          >
            <View style={styles.modalCard}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View style={styles.headerIconCircle}>
                  <Ionicons name="person-add" size={20} color="#0284C7" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Thêm bệnh nhân mới</Text>
                  <Text style={styles.modalSubtitle}>
                    Chỉ cần nhập 3 thông tin cơ bản một lần duy nhất
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
                  <Ionicons name="close" size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* Error Banner */}
              {errorMessage ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color="#DC2626" />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}

              {/* Form: 3 trường bắt buộc duy nhất */}
              <View style={styles.formBody}>
                {/* 1. Mã số bệnh án (MSBA) */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    1. Mã số bệnh án (MSBA) <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={msba}
                    onChangeText={(val) => {
                      setMsba(val);
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder="VD: 001, BA-2026-101"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                  <Text style={styles.fieldHint}>
                    Mã định danh duy nhất của hồ sơ bệnh nhân.
                  </Text>
                </View>

                {/* 2. Họ và tên bệnh nhân */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    2. Họ và tên bệnh nhân <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={patientName}
                    onChangeText={(val) => {
                      setPatientName(val);
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder="VD: Nguyễn Văn A"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="words"
                  />
                </View>

                {/* 3. Năm sinh */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    3. Năm sinh <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={birthYear}
                    onChangeText={(val) => {
                      setBirthYear(val.replace(/[^0-9]/g, ''));
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder="VD: 1985"
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                </View>
              </View>

              {/* Actions */}
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={onClose}
                  disabled={isSaving}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelBtnText}>Hủy</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
                  onPress={handleSave}
                  disabled={isSaving}
                  activeOpacity={0.85}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.saveBtnText}>Lưu bệnh nhân</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalWrapper: {
    width: '100%',
    maxWidth: 440,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
    flex: 1,
  },
  formBody: {
    gap: 14,
    marginBottom: 20,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  requiredStar: {
    color: '#DC2626',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '600',
  },
  fieldHint: {
    fontSize: 11,
    color: '#94A3B8',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  saveBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
