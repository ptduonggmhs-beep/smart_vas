import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Patient, AppUser } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { AddPatientModal } from './AddPatientModal';
import { TimepointConfigModal } from '../components/TimepointConfigModal';

interface PatientListScreenProps {
  onSelectPatient: (patient: Patient) => void;
  onBackToHome: () => void;
  onOpenSummaryTable?: () => void;
  currentUser?: AppUser | null;
}

export const PatientListScreen: React.FC<PatientListScreenProps> = ({
  onSelectPatient,
  onBackToHome,
  onOpenSummaryTable,
  currentUser,
}) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [msbaInput, setMsbaInput] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [addModalInitialMsba, setAddModalInitialMsba] = useState<string>('');
  const [isTimepointConfigModalOpen, setIsTimepointConfigModalOpen] = useState<boolean>(false);
  const [isSelectMode, setIsSelectMode] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const loadPatients = async () => {
    setLoading(true);
    try {
      const list = await FirebaseService.getAllPatients(currentUser);
      setPatients(list);
    } catch (e) {
      console.error('Error loading patients:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatients();
  }, []);

  // Xóa 1 bệnh nhân cụ thể
  const handleDeleteSinglePatient = (patient: Patient) => {
    const displayMsba = patient.medical_record_number || patient.study_id;
    const displayName = patient.patient_name || 'Bệnh nhân ' + displayMsba;

    Alert.alert(
      'Xác nhận xóa bệnh nhân',
      `Bạn có chắc chắn muốn xóa bệnh nhân "${displayMsba} - ${displayName}" khỏi danh sách theo dõi không?\n\n• Toàn bộ hồ sơ bệnh án và lịch sử đo VAS của bệnh nhân này sẽ bị xóa khỏi ứng dụng.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa bệnh nhân',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await FirebaseService.deletePatient(patient.study_id, currentUser, true);
              await loadPatients();
              Alert.alert('Thành công', `Đã xóa bệnh nhân "${displayMsba}" khỏi danh sách theo dõi.`);
            } catch (err: any) {
              console.error('Error deleting patient:', err);
              Alert.alert('Lỗi', 'Không thể xóa bệnh nhân. Vui lòng thử lại.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // Chọn hoặc bỏ chọn một bệnh nhân
  const handleToggleSelectPatient = (studyId: string) => {
    setSelectedIds((prev) =>
      prev.includes(studyId) ? prev.filter((id) => id !== studyId) : [...prev, studyId]
    );
  };

  // Chọn tất cả hoặc bỏ chọn tất cả
  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredPatients.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredPatients.map((p) => p.study_id));
    }
  };

  // Xóa các bệnh nhân đã chọn
  const handleDeleteSelectedPatients = () => {
    if (selectedIds.length === 0) return;

    Alert.alert(
      `Xác nhận xóa ${selectedIds.length} bệnh nhân`,
      `Bạn có chắc chắn muốn xóa ${selectedIds.length} bệnh nhân đã chọn không?\n\n• Toàn bộ hồ sơ và dữ liệu đo VAS liên quan sẽ bị xóa vĩnh viễn khỏi thiết bị.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: `Xóa ${selectedIds.length} bệnh nhân`,
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              for (const id of selectedIds) {
                await FirebaseService.deletePatient(id, currentUser, true);
              }
              const count = selectedIds.length;
              setSelectedIds([]);
              setIsSelectMode(false);
              await loadPatients();
              Alert.alert('Thành công', `Đã xóa thành công ${count} bệnh nhân khỏi danh sách theo dõi.`);
            } catch (err: any) {
              console.error('Error deleting selected patients:', err);
              Alert.alert('Lỗi', 'Có lỗi khi xóa bệnh nhân. Vui lòng thử lại.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // Xử lý khi nhấn nút dấu cộng [+] để thêm MSBA
  const handleAddMsbaPress = () => {
    const trimmed = msbaInput.trim().toUpperCase();
    if (!trimmed) {
      Alert.alert('Nhắc nhở', 'Vui lòng nhập Mã số bệnh án (MSBA) trước khi bấm dấu cộng.');
      return;
    }

    // Kiểm tra xem MSBA đã có trong danh sách hay chưa
    const existing = patients.find(
      (p) => (p.medical_record_number || p.study_id).trim().toUpperCase() === trimmed
    );

    if (existing) {
      Alert.alert(
        'Mã bệnh án đã tồn tại',
        `Bệnh nhân với MSBA "${trimmed}" đã có trong hệ thống (${existing.patient_name || 'Chưa cập nhật tên'}).\nBạn có muốn mở hồ sơ bệnh nhân này không?`,
        [
          { text: 'Đóng', style: 'cancel' },
          {
            text: 'Mở hồ sơ',
            onPress: () => {
              setMsbaInput('');
              onSelectPatient(existing);
            },
          },
        ]
      );
      return;
    }

    // Nếu chưa có, mở màn hình thêm bệnh nhân với MSBA điền sẵn
    setAddModalInitialMsba(trimmed);
    setIsAddModalOpen(true);
  };

  // Sau khi thêm bệnh nhân thành công
  const handlePatientSaved = (newPatient: Patient) => {
    setIsAddModalOpen(false);
    setMsbaInput('');
    loadPatients();
    // Chuyển thẳng sang trang chi tiết bệnh nhân vừa tạo
    onSelectPatient(newPatient);
  };

  // Danh sách bệnh nhân được lọc theo tìm kiếm
  const filteredPatients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((p) => {
      const msbaCode = (p.medical_record_number || p.study_id).toLowerCase();
      const name = (p.patient_name || '').toLowerCase();
      return msbaCode.includes(q) || name.includes(q);
    });
  }, [patients, searchQuery]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBackToHome}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color="#334155" />
          <Text style={styles.backBtnText}>Chế độ</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Theo dõi đau bệnh nhân</Text>

        <View style={styles.headerRightGroup}>
          <TouchableOpacity
            style={styles.headerTConfigBtn}
            onPress={() => setIsTimepointConfigModalOpen(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="time-outline" size={15} color="#0284C7" style={{ marginRight: 3 }} />
            <Text style={styles.headerTConfigBtnText}>Mốc T</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={loadPatients}
            activeOpacity={0.7}
          >
            <Ionicons name="reload" size={18} color="#0284C7" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 3.1. KHU VỰC NHẬP MSBA VÀ NÚT DẤU CỘNG [+] Ở PHÍA TRÊN CÙNG */}
      <View style={styles.topAddArea}>
        <View style={styles.inputPlusRow}>
          <View style={styles.inputContainer}>
            <Ionicons name="barcode-outline" size={20} color="#0284C7" style={{ marginLeft: 12 }} />
            <TextInput
              style={styles.msbaTextInput}
              value={msbaInput}
              onChangeText={setMsbaInput}
              placeholder="Nhập mã số bệnh án (MSBA)..."
              placeholderTextColor="#94A3B8"
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleAddMsbaPress}
            />
            {msbaInput.length > 0 && (
              <TouchableOpacity onPress={() => setMsbaInput('')} style={{ padding: 8 }}>
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={styles.plusButton}
            onPress={handleAddMsbaPress}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <Text style={styles.topAddHint}>
          * Nhập MSBA và bấm dấu [+] để tạo hồ sơ mới hoặc mở nhanh hồ sơ đã có.
        </Text>
      </View>

      {/* 3.2. NÚT MỞ BẢNG TỔNG HỢP DỮ LIỆU (MỤC VII.1) */}
      {onOpenSummaryTable && (
        <View style={styles.summaryBtnContainer}>
          <TouchableOpacity
            style={styles.summaryTableBtn}
            onPress={onOpenSummaryTable}
            activeOpacity={0.85}
          >
            <View style={styles.summaryIconBox}>
              <Ionicons name="grid-outline" size={18} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryBtnTitle}>BẢNG TỔNG HỢP DỮ LIỆU</Text>
              <Text style={styles.summaryBtnSubtitle}>
                Tổng hợp mốc T1, T6, T12, T24 & Xuất Excel (.xlsx)
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#0284C7" />
          </TouchableOpacity>
        </View>
      )}

      {/* Ô tìm kiếm danh sách */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchInner}>
          <Ionicons name="search" size={16} color="#64748B" style={{ marginLeft: 10 }} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Tìm theo MSBA hoặc tên bệnh nhân..."
            placeholderTextColor="#94A3B8"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 8 }}>
              <Ionicons name="close-circle" size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 3.3. DANH SÁCH BỆNH NHÂN TỐI GIẢN (CHỈ HIỂN THỊ MSBA VÀ HỌ TÊN) */}
      <View style={styles.listSection}>
        <View style={styles.listSectionHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.listSectionTitle}>
              Danh sách bệnh nhân ({filteredPatients.length})
            </Text>
            <Text style={styles.listSectionSubtitle}>
              {isSelectMode
                ? `Đã chọn ${selectedIds.length} bệnh nhân để xóa`
                : 'Chạm để mở hồ sơ hoặc xóa bệnh nhân'}
            </Text>
          </View>

          {filteredPatients.length > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {isSelectMode ? (
                <>
                  <TouchableOpacity
                    style={styles.selectHeaderBtn}
                    onPress={handleToggleSelectAll}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.selectHeaderBtnText}>
                      {selectedIds.length === filteredPatients.length ? 'Bỏ chọn' : 'Chọn tất cả'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.selectHeaderBtn, styles.selectDoneBtn]}
                    onPress={() => {
                      setIsSelectMode(false);
                      setSelectedIds([]);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.selectDoneBtnText}>Xong</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.selectHeaderBtn}
                  onPress={() => {
                    setIsSelectMode(true);
                    setSelectedIds([]);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="checkbox-outline" size={14} color="#0284C7" style={{ marginRight: 3 }} />
                  <Text style={styles.selectHeaderBtnText}>Chọn xóa</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#0284C7" />
            <Text style={styles.loadingText}>Đang tải danh sách bệnh nhân...</Text>
          </View>
        ) : filteredPatients.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="person-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'Không tìm thấy bệnh nhân phù hợp' : 'Chưa có bệnh nhân nào'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? 'Hãy thử tìm kiếm với từ khóa khác hoặc bấm [+] để thêm mới.'
                : 'Nhập MSBA ở thanh phía trên và bấm dấu [+] để thêm bệnh nhân đầu tiên.'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredPatients}
            keyExtractor={(item) => item.study_id}
            contentContainerStyle={[
              styles.flatListContent,
              isSelectMode && selectedIds.length > 0 && { paddingBottom: 80 },
            ]}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const displayMsba = item.medical_record_number || item.study_id;
              const displayName = item.patient_name || 'Bệnh nhân ' + displayMsba;
              const isSelected = selectedIds.includes(item.study_id);

              return (
                <TouchableOpacity
                  style={[
                    styles.patientRowCard,
                    isSelectMode && isSelected && styles.patientRowCardSelected,
                  ]}
                  onPress={() => {
                    if (isSelectMode) {
                      handleToggleSelectPatient(item.study_id);
                    } else {
                      onSelectPatient(item);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  {/* Icon Checkbox trong chế độ chọn nhiều */}
                  {isSelectMode && (
                    <TouchableOpacity
                      onPress={() => handleToggleSelectPatient(item.study_id)}
                      style={styles.checkboxTouch}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                        size={22}
                        color={isSelected ? '#EF4444' : '#94A3B8'}
                      />
                    </TouchableOpacity>
                  )}

                  <View style={styles.patientRowContent}>
                    {/* YÊU CẦU CỰC KỲ QUAN TRỌNG: MỖI HÀNG CHỈ HIỂN THỊ ĐÚNG HAI THÔNG TIN: MSBA - HỌ VÀ TÊN */}
                    <Text style={styles.patientRowText} numberOfLines={1}>
                      <Text style={styles.patientMsbaText}>{displayMsba}</Text>
                      {' — '}
                      <Text style={styles.patientNameText}>{displayName}</Text>
                    </Text>
                  </View>

                  {/* Ở chế độ bình thường: Nút thùng rác xóa từng bệnh nhân + Mũi tên */}
                  {!isSelectMode ? (
                    <View style={styles.rowRightActions}>
                      <TouchableOpacity
                        style={styles.singleDeleteBtn}
                        onPress={() => handleDeleteSinglePatient(item)}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="trash-outline" size={17} color="#EF4444" />
                      </TouchableOpacity>
                      <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>

      {/* Thanh tác vụ nổi khi có bệnh nhân được chọn để xóa */}
      {isSelectMode && selectedIds.length > 0 && (
        <View style={styles.bottomActionBar}>
          <View style={styles.bottomActionInfo}>
            <Text style={styles.bottomActionCountText}>
              Đã chọn <Text style={{ fontWeight: '900', color: '#EF4444' }}>{selectedIds.length}</Text> bệnh nhân
            </Text>
            <Text style={styles.bottomActionHint}>Bấm nút để xóa các bệnh nhân đã chọn</Text>
          </View>
          <TouchableOpacity
            style={styles.bottomDeleteBtn}
            onPress={handleDeleteSelectedPatients}
            activeOpacity={0.85}
          >
            <Ionicons name="trash" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.bottomDeleteBtnText}>Xóa ({selectedIds.length})</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Modal Thêm bệnh nhân mới */}
      <AddPatientModal
        visible={isAddModalOpen}
        initialMsba={addModalInitialMsba}
        onClose={() => setIsAddModalOpen(false)}
        onPatientSaved={handlePatientSaved}
        currentUser={currentUser}
      />

      {/* Modal Thiết lập mốc T của Bác sĩ */}
      <TimepointConfigModal
        visible={isTimepointConfigModalOpen}
        onClose={() => setIsTimepointConfigModalOpen(false)}
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
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTConfigBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 9,
    backgroundColor: '#E0F2FE',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  headerTConfigBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
  refreshBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F0F9FF',
  },
  topAddArea: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  inputPlusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#0284C7',
    borderRadius: 14,
  },
  msbaTextInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  plusButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  topAddHint: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 8,
    fontStyle: 'italic',
  },
  summaryBtnContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 2,
  },
  summaryTableBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    elevation: 2,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    gap: 10,
  },
  summaryIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryBtnTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.3,
  },
  summaryBtnSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  listSection: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  listSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  listSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listSectionSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
  },
  flatListContent: {
    paddingBottom: 24,
    gap: 8,
  },
  patientRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  patientRowContent: {
    flex: 1,
    marginRight: 10,
  },
  patientRowText: {
    fontSize: 15,
    color: '#1E293B',
  },
  patientMsbaText: {
    fontWeight: '800',
    color: '#0284C7',
  },
  patientNameText: {
    fontWeight: '600',
    color: '#0F172A',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
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
    padding: 30,
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginTop: 12,
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  selectHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 9,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  selectHeaderBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
  selectDoneBtn: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
  },
  selectDoneBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  patientRowCardSelected: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  checkboxTouch: {
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  singleDeleteBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomActionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  bottomActionInfo: {
    flex: 1,
    marginRight: 12,
  },
  bottomActionCountText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  bottomActionHint: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  bottomDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    elevation: 2,
  },
  bottomDeleteBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
