import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TimepointConfigItem } from '../types';
import {
  DEFAULT_CLINICAL_TIMEPOINTS,
  PRESET_TIMEPOINT_PROTOCOLS,
} from '../config/timepointConfig';
import { StorageService } from '../services/storageService';

interface TimepointConfigModalProps {
  visible: boolean;
  onClose: () => void;
  initialTimepoints?: TimepointConfigItem[];
  patientName?: string;
  onSaveForPatient?: (timepoints: TimepointConfigItem[]) => void;
  onSaveAsGlobalDefault?: (timepoints: TimepointConfigItem[]) => void;
}

export const TimepointConfigModal: React.FC<TimepointConfigModalProps> = ({
  visible,
  onClose,
  initialTimepoints,
  patientName,
  onSaveForPatient,
  onSaveAsGlobalDefault,
}) => {
  const [timepoints, setTimepoints] = useState<TimepointConfigItem[]>(
    initialTimepoints && initialTimepoints.length > 0
      ? initialTimepoints
      : DEFAULT_CLINICAL_TIMEPOINTS
  );

  const [newKey, setNewKey] = useState<string>('');
  const [newDescription, setNewDescription] = useState<string>('');

  useEffect(() => {
    if (visible) {
      if (initialTimepoints && initialTimepoints.length > 0) {
        setTimepoints(initialTimepoints);
      } else {
        StorageService.getDoctorCustomTimepoints().then((list) => {
          setTimepoints(list);
        });
      }
      setNewKey('');
      setNewDescription('');
    }
  }, [visible, initialTimepoints]);

  // Thêm mốc T mới
  const handleAddTimepoint = () => {
    const trimmedKey = newKey.trim().toUpperCase();
    const trimmedDesc = newDescription.trim();

    if (!trimmedKey) {
      Alert.alert('Nhắc nhở', 'Vui lòng nhập tên mốc thời gian (ví dụ: T2, T4, T48, T-Cấp...).');
      return;
    }

    // Kiểm tra trùng mã mốc
    if (timepoints.some((tp) => tp.key.toUpperCase() === trimmedKey)) {
      Alert.alert('Trùng lặp', `Mốc "${trimmedKey}" đã tồn tại trong danh sách.`);
      return;
    }

    const desc = trimmedDesc || `Mốc ${trimmedKey}`;
    // Trích xuất số giờ nếu có
    const numMatch = trimmedKey.match(/\d+/);
    const nominalHours = numMatch ? parseInt(numMatch[0], 10) : undefined;

    const newItem: TimepointConfigItem = {
      key: trimmedKey,
      label: trimmedKey,
      description: desc,
      nominalHours,
    };

    setTimepoints((prev) => [...prev, newItem]);
    setNewKey('');
    setNewDescription('');
  };

  // Xóa mốc T
  const handleDeleteTimepoint = (keyToDelete: string) => {
    if (timepoints.length <= 1) {
      Alert.alert('Cảnh báo', 'Cần giữ ít nhất một mốc thời gian để theo dõi đau.');
      return;
    }
    setTimepoints((prev) => prev.filter((tp) => tp.key.toUpperCase() !== keyToDelete.toUpperCase()));
  };

  // Áp dụng phác đồ mẫu
  const handleApplyPreset = (presetItems: TimepointConfigItem[]) => {
    setTimepoints([...presetItems]);
  };

  // Khôi phục mặc định ban đầu
  const handleResetToDefault = () => {
    setTimepoints([...DEFAULT_CLINICAL_TIMEPOINTS]);
  };

  // Lưu cho bệnh nhân
  const handleConfirmSavePatient = () => {
    if (timepoints.length === 0) {
      Alert.alert('Cảnh báo', 'Danh sách mốc thời gian không được để trống.');
      return;
    }
    if (onSaveForPatient) {
      onSaveForPatient(timepoints);
    }
    onClose();
  };

  // Lưu làm mặc định cho tất cả bệnh nhân
  const handleConfirmSaveGlobal = async () => {
    if (timepoints.length === 0) {
      Alert.alert('Cảnh báo', 'Danh sách mốc thời gian không được để trống.');
      return;
    }
    await StorageService.saveDoctorCustomTimepoints(timepoints);
    if (onSaveAsGlobalDefault) {
      onSaveAsGlobalDefault(timepoints);
    }
    if (onSaveForPatient) {
      onSaveForPatient(timepoints);
    }
    Alert.alert('Thành công', 'Đã lưu cấu hình mốc T làm mặc định cho tất cả bệnh nhân.');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleRow}>
              <View style={styles.iconBadge}>
                <Ionicons name="time" size={20} color="#0284C7" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>THIẾT LẬP CÁC MỐC ĐÁNH GIÁ (T)</Text>
                <Text style={styles.modalSubtitle}>
                  {patientName
                    ? `Cấu hình mốc thời gian cho: ${patientName}`
                    : 'Cấu hình mốc thời gian theo dõi đau sau mổ'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Hướng dẫn bác sĩ */}
            <View style={styles.guideCard}>
              <Ionicons name="bulb-outline" size={18} color="#D97706" style={{ marginRight: 8 }} />
              <Text style={styles.guideText}>
                Bác sĩ có thể tự do thêm các mốc như T2, T4, T48, T72 hoặc xóa bớt mốc. Không bắt buộc phải theo cố định T1, T6, T12, T24.
              </Text>
            </View>

            {/* Mục 1: Thêm mốc T mới */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionHeader}>1. THÊM MỐC THỜI GIAN MỚI</Text>
              <View style={styles.addInputsRow}>
                <View style={styles.keyInputCol}>
                  <Text style={styles.inputLabel}>Tên mốc (*)</Text>
                  <TextInput
                    style={styles.keyInput}
                    value={newKey}
                    onChangeText={setNewKey}
                    placeholder="VD: T2, T48..."
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.descInputCol}>
                  <Text style={styles.inputLabel}>Mô tả mốc</Text>
                  <TextInput
                    style={styles.descInput}
                    value={newDescription}
                    onChangeText={setNewDescription}
                    placeholder="VD: Sau 2 giờ, Sau 48 giờ..."
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={handleAddTimepoint}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add" size={20} color="#FFFFFF" />
                  <Text style={styles.addBtnText}>Thêm</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Mục 2: Danh sách các mốc hiện tại */}
            <View style={styles.sectionBox}>
              <View style={styles.listHeaderRow}>
                <Text style={styles.sectionHeader}>
                  2. CÁC MỐC ĐANG ÁP DỤNG ({timepoints.length} mốc)
                </Text>
                <TouchableOpacity onPress={handleResetToDefault} activeOpacity={0.7}>
                  <Text style={styles.resetText}>Đặt lại chuẩn (4 mốc)</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.timepointsGrid}>
                {timepoints.map((tp, idx) => (
                  <View key={tp.key} style={styles.tpItemCard}>
                    <View style={styles.tpItemLeft}>
                      <View style={styles.tpItemBadge}>
                        <Text style={styles.tpItemBadgeText}>{tp.key}</Text>
                      </View>
                      <View style={styles.tpItemInfo}>
                        <Text style={styles.tpItemDesc}>{tp.description}</Text>
                        <Text style={styles.tpItemSub}>Thứ tự: #{idx + 1}</Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.deleteTpBtn}
                      onPress={() => handleDeleteTimepoint(tp.key)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={17} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>

            {/* Mục 3: Phác đồ gợi ý nhanh */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionHeader}>3. CHỌN NHANH PHÁC ĐỒ MẪU</Text>
              <View style={styles.presetButtonsList}>
                {PRESET_TIMEPOINT_PROTOCOLS.map((proto) => (
                  <TouchableOpacity
                    key={proto.name}
                    style={styles.presetBtn}
                    onPress={() => handleApplyPreset(proto.items)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="layers-outline" size={16} color="#0284C7" style={{ marginRight: 8 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.presetBtnTitle}>{proto.name}</Text>
                      <Text style={styles.presetBtnSub}>
                        {proto.items.map((i) => i.key).join(' • ')}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Footer Save Actions */}
          <View style={styles.modalFooter}>
            <View style={styles.footerButtonsCol}>
              {onSaveForPatient && (
                <TouchableOpacity
                  style={styles.savePatientBtn}
                  onPress={handleConfirmSavePatient}
                  activeOpacity={0.85}
                >
                  <Ionicons name="person-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.savePatientBtnText}>
                    Áp dụng cho bệnh nhân này
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.saveGlobalBtn}
                onPress={handleConfirmSaveGlobal}
                activeOpacity={0.85}
              >
                <Ionicons name="earth" size={18} color="#0369A1" style={{ marginRight: 6 }} />
                <Text style={styles.saveGlobalBtnText}>
                  Đặt làm mặc định cho tất cả bệnh nhân
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 540,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.3,
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  modalBody: {
    padding: 16,
  },
  guideCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 16,
  },
  guideText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 17,
  },
  sectionBox: {
    marginBottom: 18,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  addInputsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  keyInputCol: {
    width: 90,
  },
  descInputCol: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  keyInput: {
    height: 42,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  descInput: {
    height: 42,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#0F172A',
  },
  addBtn: {
    height: 42,
    backgroundColor: '#0284C7',
    borderRadius: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  resetText: {
    fontSize: 11,
    color: '#0284C7',
    fontWeight: '700',
  },
  timepointsGrid: {
    gap: 8,
  },
  tpItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tpItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  tpItemBadge: {
    width: 44,
    height: 32,
    backgroundColor: '#0284C7',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  tpItemBadgeText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  tpItemInfo: {
    flex: 1,
  },
  tpItemDesc: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  tpItemSub: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1,
  },
  deleteTpBtn: {
    padding: 8,
  },
  presetButtonsList: {
    gap: 6,
  },
  presetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetBtnTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  presetBtnSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  modalFooter: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
  },
  footerButtonsCol: {
    gap: 8,
  },
  savePatientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284C7',
    borderRadius: 12,
    paddingVertical: 13,
  },
  savePatientBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  saveGlobalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 12,
    paddingVertical: 12,
  },
  saveGlobalBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0369A1',
  },
});
