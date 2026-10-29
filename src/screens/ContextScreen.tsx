import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  PainContext,
  ReasonNotCompleted,
  ActivityExecutionStatus,
  ClinicalActivityItem,
  ClinicalSurgeryGroupItem,
  ClinicalActivityGroupItem,
} from '../types';
import {
  CLINICAL_DEFINITIONS,
  REASON_NOT_COMPLETED_LABELS,
  EXECUTION_STATUS_LABELS,
  DEFAULT_CLINICAL_CONFIG,
} from '../config/clinicalConfig';
import { StorageService } from '../services/storageService';

interface ContextScreenProps {
  studyId: string;
  initialSurgeryGroup?: string | null;
  onSelectContext: (
    context: PainContext,
    activityName?: string | null,
    activityTiming?: null,
    surgeryGroup?: string | null,
    activityGroup?: string | null,
    executionStatus?: ActivityExecutionStatus | null
  ) => void;
  onNotCompleted: (
    context: PainContext,
    reason: ReasonNotCompleted | string,
    activityName?: string | null,
    surgeryGroup?: string | null,
    activityGroup?: string | null,
    executionStatus?: ActivityExecutionStatus | null
  ) => void;
  onBack: () => void;
}

export const ContextScreen: React.FC<ContextScreenProps> = ({
  studyId,
  initialSurgeryGroup,
  onSelectContext,
  onNotCompleted,
  onBack,
}) => {
  // Lựa chọn tình huống chính: null | 'nghi' | 'hoat_dong'
  const [selectedContext, setSelectedContext] = useState<PainContext | null>(null);

  // Danh mục từ cấu hình
  const [surgeryGroups, setSurgeryGroups] = useState<ClinicalSurgeryGroupItem[]>([]);
  const [activityGroups, setActivityGroups] = useState<ClinicalActivityGroupItem[]>([]);
  const [allActivities, setAllActivities] = useState<ClinicalActivityItem[]>([]);

  // Lựa chọn chi tiết khi chọn "Đau khi thực hiện hoạt động"
  const [selectedSurgeryRegion, setSelectedSurgeryRegion] = useState<string>('');
  const [isChangingRegion, setIsChangingRegion] = useState<boolean>(false);
  const [selectedActivityGroupId, setSelectedActivityGroupId] = useState<string>('');
  const [selectedActivityName, setSelectedActivityName] = useState<string>('');
  const [executionStatus, setExecutionStatus] = useState<ActivityExecutionStatus>('da_thuc_hien');
  const [selectedReason, setSelectedReason] = useState<ReasonNotCompleted | string>('');

  // Tải danh mục cấu hình
  useEffect(() => {
    StorageService.getClinicalConfig().then((cfg) => {
      const activeSurgery = (cfg.surgery_groups || DEFAULT_CLINICAL_CONFIG.surgery_groups).filter((s) => s.is_active);
      const activeGroups = (cfg.activity_groups || DEFAULT_CLINICAL_CONFIG.activity_groups || []).filter((g) => g.is_active);
      const activeActs = (cfg.activities || DEFAULT_CLINICAL_CONFIG.activities).filter((a) => a.is_active);

      setSurgeryGroups(activeSurgery);
      setActivityGroups(activeGroups);
      setAllActivities(activeActs);

      // Điền sẵn vùng phẫu thuật
      if (initialSurgeryGroup && activeSurgery.some((s) => s.name === initialSurgeryGroup)) {
        setSelectedSurgeryRegion(initialSurgeryGroup);
      } else if (activeSurgery.length > 0) {
        setSelectedSurgeryRegion(activeSurgery[0].name);
      }

      // Điền sẵn nhóm hoạt động đầu tiên
      if (activeGroups.length > 0) {
        setSelectedActivityGroupId(activeGroups[0].id);
      }
    });
  }, [initialSurgeryGroup]);

  // Lọc các hoạt động thuộc nhóm hoạt động đang chọn
  const filteredActivities = useMemo(() => {
    if (!selectedActivityGroupId) return [];
    return allActivities.filter((a) => a.group_id === selectedActivityGroupId);
  }, [allActivities, selectedActivityGroupId]);

  // Cập nhật hoạt động mặc định khi đổi nhóm
  useEffect(() => {
    if (filteredActivities.length > 0) {
      if (!filteredActivities.some((a) => a.name === selectedActivityName)) {
        setSelectedActivityName(filteredActivities[0].name);
      }
    } else {
      setSelectedActivityName('');
    }
  }, [filteredActivities]);

  // Tên nhóm hoạt động hiện tại
  const currentActivityGroup = activityGroups.find((g) => g.id === selectedActivityGroupId);
  const currentActivityGroupName = currentActivityGroup ? currentActivityGroup.name : '';

  // Xử lý Lựa chọn A: ĐAU KHI NGHỈ
  const handleChooseResting = () => {
    setSelectedContext('nghi');
    onSelectContext('nghi', null, null, selectedSurgeryRegion || null, null, null);
  };

  // Xử lý Lựa chọn B: Tiếp tục sang đánh giá hoạt động
  const handleConfirmActivityFlow = () => {
    if (!selectedSurgeryRegion) {
      Alert.alert('Chưa chọn vùng phẫu thuật', 'Vui lòng chọn vùng hoặc loại phẫu thuật liên quan.');
      return;
    }
    if (!selectedActivityName) {
      Alert.alert('Chưa chọn hoạt động', 'Vui lòng chọn tên một hoạt động cụ thể đã được cho phép.');
      return;
    }

    if (executionStatus === 'da_thuc_hien') {
      // Đã thực hiện hoạt động -> Sang màn hình chấm điểm eVAS
      onSelectContext(
        'hoat_dong',
        selectedActivityName,
        null,
        selectedSurgeryRegion,
        currentActivityGroupName,
        'da_thuc_hien'
      );
    } else {
      // Các trạng thái không chấm điểm (Chưa thực hiện / Không được phép / Không thể hoàn thành)
      if (!selectedReason) {
        Alert.alert(
          'Chưa chọn lý do',
          'Vui lòng chọn lý do người bệnh chưa thực hiện, không được phép hoặc không thể hoàn thành đánh giá.'
        );
        return;
      }
      onNotCompleted(
        'hoat_dong',
        selectedReason,
        selectedActivityName,
        selectedSurgeryRegion,
        currentActivityGroupName,
        executionStatus
      );
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} bounces={false}>
      {/* Top Bar with Back and Study ID */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="#334155" />
          <Text style={styles.backText}>Quay lại Bước 1</Text>
        </TouchableOpacity>
        <View style={styles.studyBadge}>
          <Text style={styles.studyBadgeLabel}>Mã BN:</Text>
          <Text style={styles.studyBadgeValue}>{studyId}</Text>
        </View>
      </View>

      {/* Screen Title & Header chuẩn yêu cầu */}
      <View style={styles.headerSection}>
        <Text style={styles.stepIndicator}>Bước 2/3 • Tình Huống Đánh Giá</Text>
        <Text style={styles.screenTitle}>{CLINICAL_DEFINITIONS.TITLE_STEP_2}</Text>
        <Text style={styles.promptText}>
          Chọn một trong hai tình huống dưới đây để tiến hành ghi nhận mức độ đau:
        </Text>
      </View>

      {/* ======================================================== */}
      {/* LỰA CHỌN A: ĐAU KHI NGHỈ */}
      {/* ======================================================== */}
      <TouchableOpacity
        style={[
          styles.contextCard,
          styles.cardResting,
          selectedContext === 'nghi' && styles.cardActiveRest,
        ]}
        onPress={handleChooseResting}
        activeOpacity={0.82}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.iconCircle, { backgroundColor: '#E0F2FE' }]}>
            <Ionicons name="bed-outline" size={28} color="#0284C7" />
          </View>
          <View style={styles.primaryTag}>
            <Text style={styles.primaryTagText}>Lựa chọn A</Text>
          </View>
        </View>

        <Text style={styles.cardTitle}>{CLINICAL_DEFINITIONS.RESTING_LABEL}</Text>
        <Text style={styles.definitionText}>{CLINICAL_DEFINITIONS.RESTING_DEFINITION}</Text>

        <View style={styles.microDisclaimerBox}>
          <Ionicons name="information-circle-outline" size={15} color="#0369A1" style={{ marginRight: 6 }} />
          <Text style={styles.microDisclaimerText}>
            {CLINICAL_DEFINITIONS.TOUCH_SCREEN_DISCLAIMER}
          </Text>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.cardActionText}>Nhấn để đánh giá đau khi nghỉ ngay</Text>
          <Ionicons name="chevron-forward" size={18} color="#0284C7" />
        </View>
      </TouchableOpacity>

      {/* ======================================================== */}
      {/* LỰA CHỌN B: ĐAU KHI THỰC HIỆN HOẠT ĐỘNG */}
      {/* ======================================================== */}
      <View
        style={[
          styles.contextCard,
          styles.cardMoving,
          selectedContext === 'hoat_dong' && styles.cardActiveMoving,
        ]}
      >
        <TouchableOpacity
          onPress={() => setSelectedContext(selectedContext === 'hoat_dong' ? null : 'hoat_dong')}
          activeOpacity={0.85}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="walk-outline" size={28} color="#D97706" />
            </View>
            <View style={[styles.primaryTag, { backgroundColor: '#FEF3C7' }]}>
              <Text style={[styles.primaryTagText, { color: '#B45309' }]}>Lựa chọn B</Text>
            </View>
          </View>

          <Text style={styles.cardTitle}>{CLINICAL_DEFINITIONS.ACTIVITY_LABEL}</Text>
          <Text style={styles.definitionText}>{CLINICAL_DEFINITIONS.ACTIVITY_DEFINITION}</Text>

          <View style={styles.toggleRow}>
            <Text style={[styles.cardActionText, { color: '#D97706' }]}>
              {selectedContext === 'hoat_dong'
                ? 'Đang mở danh mục chọn hoạt động'
                : 'Nhấn để chọn vùng phẫu thuật & hoạt động cụ thể'}
            </Text>
            <Ionicons
              name={selectedContext === 'hoat_dong' ? 'chevron-up' : 'chevron-down'}
              size={18}
              color="#D97706"
            />
          </View>
        </TouchableOpacity>

        {/* SECTION CHI TIẾT MỞ RỘNG KHI CHỌN HOẠT ĐỘNG */}
        {selectedContext === 'hoat_dong' && (
          <View style={styles.activityWorkflowContainer}>
            <View style={styles.divider} />

            {/* NHÃN CỐ ĐỊNH VÙNG PHẪU THUẬT (KÈM NÚT THAY ĐỔI KHI CẦN) */}
            <View style={styles.compactRegionContainer}>
              <View style={styles.compactRegionLeft}>
                <Ionicons name="bandage-outline" size={15} color="#0284C7" style={{ marginRight: 6 }} />
                <Text style={styles.compactRegionLabel}>Vùng phẫu thuật: </Text>
                <Text style={styles.compactRegionValue}>{selectedSurgeryRegion || 'Chưa chọn'}</Text>
              </View>
              <TouchableOpacity
                style={styles.changeRegionBtn}
                onPress={() => setIsChangingRegion((prev) => !prev)}
                activeOpacity={0.7}
              >
                <Text style={styles.changeRegionBtnText}>{isChangingRegion ? 'Đóng' : 'Thay đổi'}</Text>
                <Ionicons
                  name={isChangingRegion ? 'chevron-up' : 'chevron-down'}
                  size={13}
                  color="#0284C7"
                  style={{ marginLeft: 3 }}
                />
              </TouchableOpacity>
            </View>

            {/* DANH MỤC VÙNG PHẪU THUẬT MỞ RỘNG KHI CẦN THAY ĐỔI */}
            {isChangingRegion && (
              <View style={styles.regionDropdownContainer}>
                <Text style={styles.regionDropdownGuide}>
                  Chọn vùng phẫu thuật liên quan của người bệnh:
                </Text>
                <View style={styles.chipsWrapCompact}>
                  {surgeryGroups.map((surg) => {
                    const isSelected = selectedSurgeryRegion === surg.name;
                    return (
                      <TouchableOpacity
                        key={surg.id}
                        style={[styles.regionChip, isSelected && styles.regionChipSelected]}
                        onPress={() => {
                          setSelectedSurgeryRegion(surg.name);
                          setIsChangingRegion(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                          size={14}
                          color={isSelected ? '#0284C7' : '#94A3B8'}
                          style={{ marginRight: 6 }}
                        />
                        <Text
                          style={[styles.regionChipText, isSelected && styles.regionChipTextSelected]}
                        >
                          {surg.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* BƯỚC 1: CHỌN SÁU NHÓM HOẠT ĐỘNG */}
            <View style={styles.stepSection}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.stepNumberBadge}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <Text style={styles.subSectionTitle}>
                  Chọn nhóm hoạt động <Text style={styles.requiredStar}>*</Text>
                </Text>
              </View>
              <Text style={styles.subSectionGuide}>
                (Danh mục 6 nhóm hoạt động chuẩn phục hồi chức năng sau mổ)
              </Text>

              <View style={styles.activityGroupsList}>
                {activityGroups.map((grp) => {
                  const isSelected = selectedActivityGroupId === grp.id;
                  const isSuggested =
                    selectedSurgeryRegion &&
                    grp.suggested_surgery_regions &&
                    grp.suggested_surgery_regions.includes(selectedSurgeryRegion);

                  return (
                    <TouchableOpacity
                      key={grp.id}
                      style={[styles.groupCardItem, isSelected && styles.groupCardItemSelected]}
                      onPress={() => setSelectedActivityGroupId(grp.id)}
                      activeOpacity={0.75}
                    >
                      <View style={styles.groupCardHeader}>
                        <Ionicons
                          name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                          size={18}
                          color={isSelected ? '#0284C7' : '#94A3B8'}
                          style={{ marginRight: 8 }}
                        />
                        <Text
                          style={[
                            styles.groupCardTitle,
                            isSelected && styles.groupCardTitleSelected,
                          ]}
                        >
                          {grp.name}
                        </Text>
                      </View>
                      {isSuggested && (
                        <View style={styles.suggestedBadge}>
                          <Ionicons name="sparkles" size={12} color="#047857" style={{ marginRight: 4 }} />
                          <Text style={styles.suggestedBadgeText}>Gợi ý cho {selectedSurgeryRegion}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* BƯỚC 2: CHỌN HOẠT ĐỘNG CỤ THỂ */}
            <View style={styles.stepSection}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.stepNumberBadge}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <Text style={styles.subSectionTitle}>
                  Chọn hoạt động cụ thể <Text style={styles.requiredStar}>*</Text>
                </Text>
              </View>
              <Text style={styles.subSectionGuide}>
                (Phải là hoạt động đã được nhân viên y tế cho phép và phù hợp với người bệnh)
              </Text>

              {filteredActivities.length === 0 ? (
                <Text style={styles.emptyActivityText}>Không có hoạt động nào trong nhóm này.</Text>
              ) : (
                <View style={styles.activitiesListCol}>
                  {filteredActivities.map((act) => {
                    const isSelected = selectedActivityName === act.name;
                    return (
                      <TouchableOpacity
                        key={act.id}
                        style={[styles.activityItemRow, isSelected && styles.activityItemRowSelected]}
                        onPress={() => setSelectedActivityName(act.name)}
                        activeOpacity={0.75}
                      >
                        <Ionicons
                          name={isSelected ? 'checkbox' : 'square-outline'}
                          size={20}
                          color={isSelected ? '#0284C7' : '#94A3B8'}
                          style={{ marginRight: 10 }}
                        />
                        <Text
                          style={[
                            styles.activityItemText,
                            isSelected && styles.activityItemTextSelected,
                          ]}
                        >
                          {act.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* BƯỚC 3: TRẠNG THÁI THỰC HIỆN HOẠT ĐỘNG (4 TRẠNG THÁI) */}
            <View style={styles.stepSection}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.stepNumberBadge}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <Text style={styles.subSectionTitle}>
                  Trạng thái thực hiện hoạt động <Text style={styles.requiredStar}>*</Text>
                </Text>
              </View>
              <Text style={styles.subSectionGuide}>
                (Chỉ cho phép chấm eVAS khi hoạt động thực tế đã diễn ra và người bệnh có thể đánh giá)
              </Text>

              <View style={styles.statusOptionsContainer}>
                {/* 1. Đã thực hiện hoạt động */}
                <TouchableOpacity
                  style={[
                    styles.statusOptionCard,
                    executionStatus === 'da_thuc_hien' && styles.statusOptionCardActiveGreen,
                  ]}
                  onPress={() => setExecutionStatus('da_thuc_hien')}
                  activeOpacity={0.8}
                >
                  <View style={styles.statusOptionLeft}>
                    <Ionicons
                      name={executionStatus === 'da_thuc_hien' ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={executionStatus === 'da_thuc_hien' ? '#059669' : '#94A3B8'}
                    />
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text
                        style={[
                          styles.statusOptionTitle,
                          executionStatus === 'da_thuc_hien' && { color: '#059669', fontWeight: '700' },
                        ]}
                      >
                        {EXECUTION_STATUS_LABELS.da_thuc_hien}
                      </Text>
                      <Text style={styles.statusOptionDesc}>
                        Người bệnh đã kết thúc hoạt động, sẵn sàng đánh giá mức đau cao nhất.
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* 2. Chưa thực hiện hoạt động */}
                <TouchableOpacity
                  style={[
                    styles.statusOptionCard,
                    executionStatus === 'chua_thuc_hien' && styles.statusOptionCardActiveAmber,
                  ]}
                  onPress={() => {
                    setExecutionStatus('chua_thuc_hien');
                    if (!selectedReason) setSelectedReason('chua_duoc_cho_phep');
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.statusOptionLeft}>
                    <Ionicons
                      name={executionStatus === 'chua_thuc_hien' ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={executionStatus === 'chua_thuc_hien' ? '#D97706' : '#94A3B8'}
                    />
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text
                        style={[
                          styles.statusOptionTitle,
                          executionStatus === 'chua_thuc_hien' && { color: '#D97706', fontWeight: '700' },
                        ]}
                      >
                        {EXECUTION_STATUS_LABELS.chua_thuc_hien}
                      </Text>
                      <Text style={styles.statusOptionDesc}>
                        Chưa diễn ra hoạt động • Không chấm điểm VAS • Không tự tạo điểm 0.
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* 3. Không được phép thực hiện hoạt động theo kế hoạch hiện tại */}
                <TouchableOpacity
                  style={[
                    styles.statusOptionCard,
                    executionStatus === 'khong_duoc_phep' && styles.statusOptionCardActiveOrange,
                  ]}
                  onPress={() => {
                    setExecutionStatus('khong_duoc_phep');
                    if (!selectedReason) setSelectedReason('khong_phu_hop_lam_sang');
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.statusOptionLeft}>
                    <Ionicons
                      name={executionStatus === 'khong_duoc_phep' ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={executionStatus === 'khong_duoc_phep' ? '#EA580C' : '#94A3B8'}
                    />
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text
                        style={[
                          styles.statusOptionTitle,
                          executionStatus === 'khong_duoc_phep' && { color: '#EA580C', fontWeight: '700' },
                        ]}
                      >
                        {EXECUTION_STATUS_LABELS.khong_duoc_phep}
                      </Text>
                      <Text style={styles.statusOptionDesc}>
                        Chưa có chỉ định/chưa được phép • Lưu trạng thái và lý do lâm sàng.
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* 4. Đã thực hiện nhưng không thể hoàn thành đánh giá */}
                <TouchableOpacity
                  style={[
                    styles.statusOptionCard,
                    executionStatus === 'khong_the_hoan_thanh' && styles.statusOptionCardActiveRed,
                  ]}
                  onPress={() => {
                    setExecutionStatus('khong_the_hoan_thanh');
                    if (!selectedReason) setSelectedReason('khong_the_thuc_hien');
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.statusOptionLeft}>
                    <Ionicons
                      name={executionStatus === 'khong_the_hoan_thanh' ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={executionStatus === 'khong_the_hoan_thanh' ? '#DC2626' : '#94A3B8'}
                    />
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text
                        style={[
                          styles.statusOptionTitle,
                          executionStatus === 'khong_the_hoan_thanh' && { color: '#DC2626', fontWeight: '700' },
                        ]}
                      >
                        {EXECUTION_STATUS_LABELS.khong_the_hoan_thanh}
                      </Text>
                      <Text style={styles.statusOptionDesc}>
                        Đã làm nhưng mệt, không hiểu hướng dẫn, lỗi kỹ thuật hoặc từ chối.
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>

              {/* CHỌN LÝ DO NẾU KHÔNG PHẢI "ĐÃ THỰC HIỆN" */}
              {executionStatus !== 'da_thuc_hien' && (
                <View style={styles.reasonSelectionBox}>
                  <Text style={styles.reasonTitle}>
                    Chọn lý do cụ thể <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <Text style={styles.reasonNote}>
                    (Hệ thống sẽ lưu bản ghi với điểm đau = null, tuyệt đối KHÔNG tự ghi điểm 0)
                  </Text>
                  <View style={styles.reasonChipsList}>
                    {(Object.keys(REASON_NOT_COMPLETED_LABELS) as ReasonNotCompleted[]).map((rKey) => {
                      const isRSelected = selectedReason === rKey;
                      return (
                        <TouchableOpacity
                          key={rKey}
                          style={[styles.reasonChipItem, isRSelected && styles.reasonChipItemSelected]}
                          onPress={() => setSelectedReason(rKey)}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={isRSelected ? 'radio-button-on' : 'radio-button-off'}
                            size={16}
                            color={isRSelected ? '#DC2626' : '#94A3B8'}
                            style={{ marginRight: 6 }}
                          />
                          <Text
                            style={[
                              styles.reasonChipText,
                              isRSelected && styles.reasonChipTextSelected,
                            ]}
                          >
                            {REASON_NOT_COMPLETED_LABELS[rKey]}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>

            {/* NÚT HÀNH ĐỘNG CUỐI CÙNG THEO TRẠNG THÁI */}
            <View style={styles.finalActionSection}>
              {executionStatus === 'da_thuc_hien' ? (
                <TouchableOpacity
                  style={[
                    styles.primaryActionBtn,
                    (!selectedActivityName || !selectedSurgeryRegion) && styles.actionBtnDisabled,
                  ]}
                  onPress={handleConfirmActivityFlow}
                  disabled={!selectedActivityName || !selectedSurgeryRegion}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryActionBtnText}>
                    Tiến hành đánh giá điểm đau eVAS
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.saveNotCompletedBtn, !selectedReason && styles.actionBtnDisabled]}
                  onPress={handleConfirmActivityFlow}
                  disabled={!selectedReason}
                  activeOpacity={0.85}
                >
                  <Ionicons name="save-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.saveNotCompletedBtnText}>
                    Lưu ghi nhận vào hồ sơ (Không chấm điểm VAS)
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>

      {/* Cảnh báo an toàn y tế */}
      <View style={styles.safetyBox}>
        <Ionicons name="shield-checkmark-outline" size={18} color="#059669" style={{ marginRight: 8 }} />
        <Text style={styles.safetyText}>
          {CLINICAL_DEFINITIONS.SAFETY_ADVISORY}
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
    backgroundColor: '#F8FAFC',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  backText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '600',
    marginLeft: 4,
  },
  studyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  studyBadgeLabel: {
    fontSize: 12,
    color: '#1E40AF',
    fontWeight: '500',
    marginRight: 4,
  },
  studyBadgeValue: {
    fontSize: 14,
    color: '#1E40AF',
    fontWeight: '700',
  },
  headerSection: {
    marginBottom: 18,
  },
  stepIndicator: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 28,
    marginBottom: 6,
  },
  promptText: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  contextCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardResting: {
    borderColor: '#BAE6FD',
  },
  cardActiveRest: {
    borderColor: '#0284C7',
    backgroundColor: '#F0F9FF',
  },
  cardMoving: {
    borderColor: '#FDE68A',
  },
  cardActiveMoving: {
    borderColor: '#D97706',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryTag: {
    backgroundColor: '#E0F2FE',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  primaryTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  definitionText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
    marginBottom: 10,
  },
  microDisclaimerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  microDisclaimerText: {
    fontSize: 11,
    color: '#0369A1',
    lineHeight: 16,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cardActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0284C7',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  activityWorkflowContainer: {
    marginTop: 14,
  },
  divider: {
    height: 1,
    backgroundColor: '#CBD5E1',
    marginBottom: 16,
  },
  stepSection: {
    marginBottom: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  stepNumberBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  subSectionGuide: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 10,
    marginLeft: 30,
    fontStyle: 'italic',
  },
  requiredStar: {
    color: '#DC2626',
    fontWeight: '700',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginLeft: 30,
  },
  regionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  regionChipSelected: {
    backgroundColor: '#E0F2FE',
    borderColor: '#0284C7',
  },
  regionChipText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '500',
  },
  regionChipTextSelected: {
    color: '#0284C7',
    fontWeight: '700',
  },
  activityGroupsList: {
    gap: 8,
    marginLeft: 30,
  },
  groupCardItem: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
  },
  groupCardItemSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#0284C7',
    borderWidth: 1.5,
  },
  groupCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupCardTitle: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
    flex: 1,
  },
  groupCardTitleSelected: {
    color: '#0284C7',
    fontWeight: '700',
  },
  suggestedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    marginTop: 6,
    marginLeft: 26,
  },
  suggestedBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#065F46',
  },
  activitiesListCol: {
    gap: 6,
    marginLeft: 30,
  },
  activityItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  activityItemRowSelected: {
    borderColor: '#0284C7',
    backgroundColor: '#F0F9FF',
  },
  activityItemText: {
    fontSize: 13,
    color: '#334155',
    flex: 1,
  },
  activityItemTextSelected: {
    color: '#0284C7',
    fontWeight: '700',
  },
  emptyActivityText: {
    fontSize: 12,
    color: '#94A3B8',
    marginLeft: 30,
    fontStyle: 'italic',
  },
  statusOptionsContainer: {
    gap: 8,
    marginLeft: 30,
  },
  statusOptionCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
  },
  statusOptionCardActiveGreen: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669',
    borderWidth: 1.5,
  },
  statusOptionCardActiveAmber: {
    backgroundColor: '#FFFBEB',
    borderColor: '#D97706',
    borderWidth: 1.5,
  },
  statusOptionCardActiveOrange: {
    backgroundColor: '#FFF7ED',
    borderColor: '#EA580C',
    borderWidth: 1.5,
  },
  statusOptionCardActiveRed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#DC2626',
    borderWidth: 1.5,
  },
  statusOptionLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  statusOptionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  statusOptionDesc: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
  },
  reasonSelectionBox: {
    marginTop: 12,
    marginLeft: 30,
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  reasonTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 2,
  },
  reasonNote: {
    fontSize: 11,
    color: '#B91C1C',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  reasonChipsList: {
    gap: 6,
  },
  reasonChipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  reasonChipItemSelected: {
    backgroundColor: '#FEE2E2',
    borderColor: '#DC2626',
  },
  reasonChipText: {
    fontSize: 12,
    color: '#334155',
    flex: 1,
  },
  reasonChipTextSelected: {
    color: '#DC2626',
    fontWeight: '700',
  },
  finalActionSection: {
    marginTop: 18,
    marginLeft: 30,
  },
  primaryActionBtn: {
    backgroundColor: '#0284C7',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  saveNotCompletedBtn: {
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveNotCompletedBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  safetyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginTop: 8,
  },
  safetyText: {
    fontSize: 12,
    color: '#065F46',
    lineHeight: 17,
    flex: 1,
  },
  compactRegionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  compactRegionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  compactRegionLabel: {
    fontSize: 13,
    color: '#0369A1',
    fontWeight: '500',
  },
  compactRegionValue: {
    fontSize: 13,
    color: '#0284C7',
    fontWeight: '700',
  },
  changeRegionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#0284C7',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  changeRegionBtnText: {
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '600',
  },
  regionDropdownContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 16,
  },
  regionDropdownGuide: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  chipsWrapCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
