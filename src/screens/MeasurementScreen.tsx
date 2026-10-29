import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  Modal,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StorageService } from '../services/storageService';
import {
  getCalibratedVASHeight,
  getStoredCalibrationFactor,
} from '../utils/physicalScale';
import { CalibrationModal } from '../components/CalibrationModal';

interface MeasurementScreenProps {
  studyId?: string;
  patientName?: string;
  selectedTimepoint?: string;
  isQuickSurvey?: boolean;
  onConfirmScore?: (score: number) => Promise<{ success: boolean; error?: string } | void> | void;
  onBack: () => void;
  isSubmitting?: boolean;
}

export const MeasurementScreen: React.FC<MeasurementScreenProps> = ({
  studyId = '',
  patientName = '',
  selectedTimepoint = 'T1',
  isQuickSurvey = false,
  onConfirmScore,
  onBack,
  isSubmitting = false,
}) => {
  // Điểm VAS từ 0.0 đến 100.0 mm
  const [score, setScore] = useState<number>(0);
  // Trạng thái A: Chưa đánh giá (chưa chạm). Chỉ chuyển sang Trạng thái B khi chạm vào thang.
  const [hasTouched, setHasTouched] = useState<boolean>(false);
  // Chế độ người bệnh (Patient View) làm ẩn / khóa tạm thời các nút điều hướng
  const [isPatientMode, setIsPatientMode] = useState<boolean>(false);

  const [calibrationFactor, setCalibrationFactor] = useState<number>(1.0);
  const [isCalibrationOpen, setIsCalibrationOpen] = useState<boolean>(false);
  const [isInteracting, setIsInteracting] = useState<boolean>(false);

  // Hướng thang: Mặc định đỉnh là 0 mm (Không đau), đáy là 100 mm (Đau dữ dội)
  const [isFlipped180, setIsFlipped180] = useState<boolean>(true);

  // Overlay kết quả cho Khảo sát VAS nhanh (Section IV)
  const [isQuickResultModalVisible, setIsQuickResultModalVisible] = useState<boolean>(false);

  // Overlay kết quả cho Theo dõi đau bệnh nhân (Section V)
  const [isPatientResultModalVisible, setIsPatientResultModalVisible] = useState<boolean>(false);
  const [isSavingPatientResult, setIsSavingPatientResult] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Phân loại mức độ đau theo chuẩn lâm sàng: 0 - <4: Đau nhẹ, >=4 - <7: Đau vừa, >=7: Đau nặng
  const getPainCategory = (vasMm: number) => {
    if (vasMm < 40) return { label: 'Đau nhẹ', color: '#16A34A', bg: '#DCFCE7', icon: 'happy-outline' as const };
    if (vasMm < 70) return { label: 'Đau vừa', color: '#D97706', bg: '#FEF3C7', icon: 'alert-circle-outline' as const };
    return { label: 'Đau nặng', color: '#DC2626', bg: '#FEE2E2', icon: 'warning-outline' as const };
  };

  useEffect(() => {
    getStoredCalibrationFactor().then((factor) => {
      setCalibrationFactor(factor);
    });
  }, []);

  // Chiều cao chuẩn 10cm (100mm) sau hiệu chuẩn thực tế của thiết bị
  const trackHeight = getCalibratedVASHeight(calibrationFactor);

  // References cho PanResponder tránh closure lag
  const trackHeightRef = useRef<number>(trackHeight);
  const isFlippedRef = useRef<boolean>(isFlipped180);
  const scoreRef = useRef<number>(score);
  const isSubmittingRef = useRef<boolean>(isSubmitting);
  const startScoreRef = useRef<number>(score);
  const hasTouchedRef = useRef<boolean>(hasTouched);

  useEffect(() => {
    trackHeightRef.current = trackHeight;
    isFlippedRef.current = isFlipped180;
    scoreRef.current = score;
    isSubmittingRef.current = isSubmitting;
    hasTouchedRef.current = hasTouched;
  }, [trackHeight, isFlipped180, score, isSubmitting, hasTouched]);

  // PanResponder lồng trong khung trong suốt:
  // Chặn 100% cuộn màn hình của ScrollView khi người dùng chạm hoặc kéo trên thanh VAS
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isSubmittingRef.current,
      onStartShouldSetPanResponderCapture: () => !isSubmittingRef.current,
      onMoveShouldSetPanResponder: () => !isSubmittingRef.current,
      onMoveShouldSetPanResponderCapture: () => !isSubmittingRef.current,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,

      onPanResponderGrant: (evt: GestureResponderEvent) => {
        if (isSubmittingRef.current) return;
        setIsInteracting(true);

        const currentTrackH = trackHeightRef.current;
        if (currentTrackH <= 0) return;

        const locationY = evt.nativeEvent.locationY;
        const boundedY = Math.max(0, Math.min(currentTrackH, locationY));

        let calculatedScore = 0;
        let currentThumbCenterY = 0;
        if (isFlippedRef.current) {
          // Đỉnh = 0 mm (Không đau), Đáy = 100 mm (Đau dữ dội)
          calculatedScore = (boundedY / currentTrackH) * 100;
          currentThumbCenterY = (scoreRef.current / 100) * currentTrackH;
        } else {
          // Đáy = 0 mm, Đỉnh = 100 mm
          calculatedScore = (1 - boundedY / currentTrackH) * 100;
          currentThumbCenterY = (1 - scoreRef.current / 100) * currentTrackH;
        }

        const clamped = Math.max(0, Math.min(100, Math.round(calculatedScore * 10) / 10));

        // Khi người bệnh chạm lần đầu -> chuyển sang trạng thái đã chọn điểm
        if (!hasTouchedRef.current) {
          hasTouchedRef.current = true;
          setHasTouched(true);
          startScoreRef.current = clamped;
          setScore(clamped);
        } else {
          const distFromThumb = Math.abs(boundedY - currentThumbCenterY);
          if (distFromThumb <= 28) {
            startScoreRef.current = scoreRef.current;
          } else {
            startScoreRef.current = clamped;
            setScore(clamped);
          }
        }
      },

      onPanResponderMove: (_evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        if (isSubmittingRef.current) return;
        const currentTrackH = trackHeightRef.current;
        if (currentTrackH <= 0) return;

        if (!hasTouchedRef.current) {
          hasTouchedRef.current = true;
          setHasTouched(true);
        }

        let deltaScore = 0;
        if (isFlippedRef.current) {
          deltaScore = (gestureState.dy / currentTrackH) * 100;
        } else {
          deltaScore = (-gestureState.dy / currentTrackH) * 100;
        }

        const newScore = Math.max(0, Math.min(100, startScoreRef.current + deltaScore));
        const rounded = Math.round(newScore * 10) / 10;
        setScore(rounded);
      },

      onPanResponderRelease: () => {
        setIsInteracting(false);
      },

      onPanResponderTerminate: () => {
        setIsInteracting(false);
      },
    })
  ).current;

  // Tính vị trí Thumb trên thang 10cm
  const progressRatio = Math.max(0, Math.min(100, score)) / 100;
  const thumbSize = isInteracting ? 46 : 42;

  let thumbCenterY = 0;
  if (isFlipped180) {
    // 0mm ở đỉnh, 100mm ở đáy
    thumbCenterY = progressRatio * trackHeight;
  } else {
    // 0mm ở đáy, 100mm ở đỉnh
    thumbCenterY = (1 - progressRatio) * trackHeight;
  }
  const thumbTop = thumbCenterY - thumbSize / 2;

  // Nhãn ở hai đầu theo hướng
  // Đầu 0 mm: KHÔNG ĐAU (#DC2626)
  // Đầu 100 mm: ĐAU DỮ DỘI (#DC2626)
  const topLabel = isFlipped180 ? 'KHÔNG ĐAU' : 'ĐAU DỮ DỘI';
  const bottomLabel = isFlipped180 ? 'ĐAU DỮ DỘI' : 'KHÔNG ĐAU';

  // Dải màu gradient xanh liên tục theo Section III.3:
  // Không đau: #DCEEFF, Thấp: #A9D5FF, Trung bình: #559DE8, Đau dữ dội nhất: #0B3D91
  const blueGradientColors: [string, string, ...string[]] = isFlipped180
    ? ['#DCEEFF', '#A9D5FF', '#559DE8', '#0B3D91']
    : ['#0B3D91', '#559DE8', '#A9D5FF', '#DCEEFF'];

  // Xử lý nút Làm lại
  const handleReset = () => {
    hasTouchedRef.current = false;
    setHasTouched(false);
    setScore(0);
  };

  // Xử lý Xác nhận từ màn hình chính
  const handleConfirmPress = () => {
    if (!hasTouched) return;
    if (isQuickSurvey) {
      setIsQuickResultModalVisible(true);
    } else {
      setSaveError(null);
      setIsPatientResultModalVisible(true);
    }
  };

  // Đóng modal kết quả Khảo sát nhanh (Section IV.2):
  // Trở về màn hình VAS nhanh, đưa thang về màu đen #222222, xóa lựa chọn trước đó
  const handleCloseQuickResultModal = () => {
    setIsQuickResultModalVisible(false);
    handleReset();
  };

  // Lưu kết quả Theo dõi bệnh nhân (Section V.2)
  const handleSavePatientResult = async () => {
    if (!onConfirmScore) return;
    setIsSavingPatientResult(true);
    setSaveError(null);

    try {
      const res = await onConfirmScore(score);
      setIsSavingPatientResult(false);
      if (res && res.success === false) {
        setSaveError(res.error || 'Không thể lưu kết quả. Vui lòng thử lại.');
      } else {
        // Lưu thành công, đóng modal
        setIsPatientResultModalVisible(false);
      }
    } catch (err: any) {
      setIsSavingPatientResult(false);
      setSaveError(err?.message || 'Có lỗi xảy ra khi lưu kết quả.');
    }
  };

  return (
    <ScrollView
      scrollEnabled={!isInteracting}
      contentContainerStyle={styles.container}
      bounces={false}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. KHU VỰC TRÊN: Header điều hướng tối thiểu chiều cao */}
      <View style={styles.topSection}>
        {isPatientMode ? (
          <View style={styles.patientModeLockedBar}>
            <View style={styles.patientModeLockedInfo}>
              <Ionicons name="lock-closed" size={14} color="#047857" style={{ marginRight: 6 }} />
              <Text style={styles.patientModeLockedText}>
                Chế độ người bệnh • Đã khóa điều hướng
              </Text>
            </View>
            <TouchableOpacity
              style={styles.unlockBtn}
              onPress={() => setIsPatientMode(false)}
              activeOpacity={0.7}
            >
              <Ionicons name="lock-open-outline" size={13} color="#065F46" style={{ marginRight: 3 }} />
              <Text style={styles.unlockBtnText}>Mở khóa</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.topBarCompact}>
            <TouchableOpacity
              style={styles.backButtonCompact}
              onPress={onBack}
              disabled={isSubmitting}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={16} color="#334155" />
              <Text style={styles.backTextCompact}>
                {isQuickSurvey ? 'Trang chủ' : 'Quay lại'}
              </Text>
            </TouchableOpacity>

            <View style={styles.centerBadgeCompact}>
              {isQuickSurvey ? (
                <View style={styles.quickPillCompact}>
                  <Ionicons name="flash" size={12} color="#D97706" style={{ marginRight: 4 }} />
                  <Text style={styles.quickPillTextCompact}>Khảo sát VAS nhanh</Text>
                </View>
              ) : (
                <View style={styles.patientPillCompact}>
                  <Ionicons name="person-circle-outline" size={13} color="#0284C7" style={{ marginRight: 4 }} />
                  <Text style={styles.patientPillTextCompact} numberOfLines={1}>
                    {patientName ? `${studyId} — ${patientName}` : `MSBA: ${studyId}`} • Mốc {selectedTimepoint}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.topRightActionsCompact}>
              <TouchableOpacity
                style={styles.calibBtnCompact}
                onPress={() => setIsCalibrationOpen(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="options-outline" size={15} color="#0284C7" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.patientModeToggleBtnCompact}
                onPress={() => setIsPatientMode(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="person" size={14} color="#047857" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* 2. KHU VỰC GIỮA: Thanh VAS đứng dọc 10 cm và 2 nhãn đỏ nằm ngang ở chế độ xem màn hình nằm ngang */}
      <View style={styles.scaleArea}>
        {/* VÙNG THƯỚC ĐO ĐỨNG DỌC CHUẨN 10 CM (100 MM) */}
        <View style={[styles.vasContainer, { height: trackHeight }]}>
          {/* KHUNG CẢM ỨNG BẢO VỆ CHỐNG TRƯỢT MÀN HÌNH */}
          <View
            style={[styles.touchContainer, { height: trackHeight }]}
            {...panResponder.panHandlers}
          >
            {/* Vạch chặn Đỉnh (Stopper Bar) */}
            <View pointerEvents="none" style={styles.stopperLineTop} />

            {/* TRẠNG THÁI A: CHƯA ĐÁNH GIÁ -> TOÀN BỘ MÀU ĐEN ĐỒNG NHẤT #222222
                TRẠNG THÁI B: ĐÃ CHỌN ĐIỂM -> DẢI GRADIENT XANH NHẠT ĐẾN XANH ĐẬM (SECTION III.3) */}
            {!hasTouched ? (
              <View
                pointerEvents="none"
                style={[styles.trackSolidBlack, { height: trackHeight }]}
              />
            ) : (
              <LinearGradient
                pointerEvents="none"
                colors={blueGradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={[styles.trackGradient, { height: trackHeight }]}
              />
            )}

            {/* Con trượt điểm đau (Thumb) - CHỈ HIỂN THỊ KHI ĐÃ CHẠM */}
            {hasTouched && (
              <View
                pointerEvents="none"
                style={[
                  styles.sliderThumb,
                  {
                    top: thumbTop,
                    width: thumbSize,
                    height: thumbSize,
                    borderRadius: thumbSize / 2,
                  },
                ]}
              >
                <View pointerEvents="none" style={styles.thumbCenterDot} />
              </View>
            )}

            {/* Vạch chặn Đáy (Stopper Bar) */}
            <View pointerEvents="none" style={styles.stopperLineBottom} />
          </View>

          {/* NHÃN 1: KHÔNG ĐAU - Chữ màu đỏ in đậm phóng to, nằm ngang ở chế độ xem màn hình nằm ngang, nằm phía dưới đầu mút 0 mm */}
          <View pointerEvents="none" style={styles.landscapeLabelWrapTop}>
            <Text style={styles.landscapeRedText} numberOfLines={1}>
              {topLabel}
            </Text>
          </View>

          {/* NHÃN 2: ĐAU DỮ DỘI - Chữ màu đỏ in đậm phóng to, nằm ngang ở chế độ xem màn hình nằm ngang, nằm phía dưới đầu mút 100 mm */}
          <View pointerEvents="none" style={styles.landscapeLabelWrapBottom}>
            <Text style={styles.landscapeRedText} numberOfLines={1}>
              {bottomLabel}
            </Text>
          </View>
        </View>
      </View>

      {/* 3. KHU VỰC DƯỚI: NÚT XÁC NHẬN NẰM NGAY BÊN DƯỚI THANH VAS */}
      <View style={styles.bottomActionArea}>
        <TouchableOpacity
          style={[
            styles.confirmBtn,
            !hasTouched ? styles.confirmBtnDisabled : styles.confirmBtnActive,
          ]}
          onPress={handleConfirmPress}
          disabled={!hasTouched}
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.confirmBtnText,
              !hasTouched && styles.confirmBtnTextDisabled,
            ]}
          >
            {hasTouched ? 'XÁC NHẬN' : 'Chạm trên thang để chọn điểm'}
          </Text>
          {hasTouched && (
            <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" style={{ marginLeft: 6 }} />
          )}
        </TouchableOpacity>

        {hasTouched && (
          <TouchableOpacity
            style={styles.resetBtnCompact}
            onPress={handleReset}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={15} color="#64748B" style={{ marginRight: 3 }} />
            <Text style={styles.resetBtnCompactText}>Làm lại</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ============================================================ */}
      {/* MODAL / OVERLAY: KẾT QUẢ KHẢO SÁT VAS NHANH (SECTION IV)     */}
      {/* ============================================================ */}
      <Modal
        visible={isQuickResultModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseQuickResultModal}
      >
        <TouchableWithoutFeedback onPress={handleCloseQuickResultModal}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.resultCard}>
                <View style={styles.resultHeader}>
                  <Text style={styles.resultHeaderTitle}>KẾT QUẢ VAS</Text>
                  <TouchableOpacity onPress={handleCloseQuickResultModal} style={styles.resultCloseBtn}>
                    <Ionicons name="close" size={20} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {/* Điểm VAS thật lớn */}
                <View style={styles.bigScoreBox}>
                  <Text style={styles.bigScoreNumber}>
                    {score.toFixed(1).replace('.', ',')}
                  </Text>
                  <Text style={styles.bigScoreUnit}>mm</Text>
                </View>

                <Text style={styles.completedSubtitle}>Đã hoàn thành đánh giá</Text>

                {/* Phân loại mức độ đau */}
                <View style={[styles.painCategoryPill, { backgroundColor: getPainCategory(score).bg }]}>
                  <Ionicons
                    name={getPainCategory(score).icon}
                    size={16}
                    color={getPainCategory(score).color}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.painCategoryText, { color: getPainCategory(score).color }]}>
                    Mức độ: {getPainCategory(score).label}
                  </Text>
                </View>

                <View style={styles.quickModalDivider} />

                {/* Hướng dẫn chạm để tiếp tục (Section IV.2) */}
                <TouchableOpacity
                  style={styles.continueTouchArea}
                  onPress={handleCloseQuickResultModal}
                  activeOpacity={0.8}
                >
                  <Ionicons name="finger-print-outline" size={18} color="#0284C7" style={{ marginRight: 6 }} />
                  <Text style={styles.continueTouchText}>Chạm vào màn hình để tiếp tục</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL / OVERLAY: KẾT QUẢ THEO DÕI ĐAU BỆNH NHÂN (SECTION V)  */}
      {/* ============================================================ */}
      <Modal
        visible={isPatientResultModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (!isSavingPatientResult) {
            setIsPatientResultModalVisible(false);
          }
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultHeaderTitle}>KẾT QUẢ VAS</Text>
              {!isSavingPatientResult && (
                <TouchableOpacity
                  onPress={() => setIsPatientResultModalVisible(false)}
                  style={styles.resultCloseBtn}
                >
                  <Ionicons name="close" size={20} color="#64748B" />
                </TouchableOpacity>
              )}
            </View>

            {/* Điểm VAS thật lớn */}
            <View style={styles.bigScoreBox}>
              <Text style={styles.bigScoreNumber}>
                {score.toFixed(1).replace('.', ',')}
              </Text>
              <Text style={styles.bigScoreUnit}>mm</Text>
            </View>

            {/* Phân loại mức độ đau */}
            <View style={[styles.painCategoryPill, { backgroundColor: getPainCategory(score).bg, marginBottom: 12 }]}>
              <Ionicons
                name={getPainCategory(score).icon}
                size={16}
                color={getPainCategory(score).color}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.painCategoryText, { color: getPainCategory(score).color }]}>
                Mức độ: {getPainCategory(score).label}
              </Text>
            </View>

            {/* Thông tin MSBA và Mốc T (Section V.1) */}
            <View style={styles.patientResultMetaBox}>
              <View style={styles.patientMetaLine}>
                <Ionicons name="barcode-outline" size={15} color="#0284C7" style={{ marginRight: 6 }} />
                <Text style={styles.patientMetaText}>
                  MSBA: <Text style={styles.boldText}>{studyId}</Text>
                </Text>
              </View>

              <View style={styles.patientMetaLine}>
                <Ionicons name="alarm-outline" size={15} color="#0284C7" style={{ marginRight: 6 }} />
                <Text style={styles.patientMetaText}>
                  Mốc đánh giá: <Text style={styles.boldText}>{selectedTimepoint}</Text>
                </Text>
              </View>

              {patientName ? (
                <View style={styles.patientMetaLine}>
                  <Ionicons name="person-outline" size={15} color="#64748B" style={{ marginRight: 6 }} />
                  <Text style={styles.patientMetaText}>Bệnh nhân: {patientName}</Text>
                </View>
              ) : null}
            </View>

            {/* Thông báo lỗi nếu lưu thất bại (Section V.2) */}
            {saveError && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={18} color="#DC2626" style={{ marginRight: 6 }} />
                <Text style={styles.errorBannerText}>{saveError}</Text>
              </View>
            )}

            {/* Nút Hoàn tất và lưu kết quả (Section V.2) */}
            <TouchableOpacity
              style={[styles.saveResultBtn, isSavingPatientResult && { opacity: 0.7 }]}
              onPress={handleSavePatientResult}
              disabled={isSavingPatientResult}
              activeOpacity={0.85}
            >
              {isSavingPatientResult ? (
                <View style={styles.savingRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.saveResultBtnText}>Đang lưu kết quả...</Text>
                </View>
              ) : (
                <View style={styles.savingRow}>
                  <Ionicons name="checkmark-done" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.saveResultBtnText}>HOÀN TẤT VÀ LƯU KẾT QUẢ</Text>
                </View>
              )}
            </TouchableOpacity>

            {!isSavingPatientResult && (
              <TouchableOpacity
                style={styles.reAssessBtn}
                onPress={() => setIsPatientResultModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.reAssessBtnText}>Chỉnh sửa lại điểm</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal Hiệu chuẩn thước đo theo thước kẻ thực tế */}
      <CalibrationModal
        visible={isCalibrationOpen}
        onClose={() => setIsCalibrationOpen(false)}
        onCalibrationSaved={(newFactor) => {
          setCalibrationFactor(newFactor);
        }}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    minHeight: Platform.OS === 'web' ? '100dvh' : '100%',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'ios' ? 4 : 6,
    paddingBottom: Platform.OS === 'ios' ? 8 : 10,
    backgroundColor: '#F8FAFC',
  },
  topSection: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    marginBottom: 2,
  },
  topBarCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  backButtonCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  backTextCompact: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginLeft: 3,
  },
  centerBadgeCompact: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickPillCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  quickPillTextCompact: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  patientPillCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  patientPillTextCompact: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369A1',
  },
  topRightActionsCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  calibBtnCompact: {
    padding: 6,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  patientModeToggleBtnCompact: {
    padding: 6,
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  patientModeLockedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  patientModeLockedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  patientModeLockedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
  unlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 6,
  },
  unlockBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
  scaleArea: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  vasContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  touchContainer: {
    width: 120, // Khung cảm ứng rộng bảo vệ chống trượt
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  stopperLineTop: {
    position: 'absolute',
    top: 0,
    width: 44,
    height: 4,
    backgroundColor: '#0F172A',
    borderRadius: 2,
    zIndex: 10,
  },
  stopperLineBottom: {
    position: 'absolute',
    bottom: 0,
    width: 44,
    height: 4,
    backgroundColor: '#0F172A',
    borderRadius: 2,
    zIndex: 10,
  },
  trackSolidBlack: {
    width: 22,
    backgroundColor: '#222222',
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#111111',
  },
  trackGradient: {
    width: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#0B3D91',
  },
  sliderThumb: {
    position: 'absolute',
    left: '50%',
    marginLeft: -21, // Căn giữa
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#0284C7',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  thumbCenterDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#0284C7',
  },
  landscapeLabelWrapTop: {
    position: 'absolute',
    left: '50%',
    marginLeft: -34,
    top: 66,
    width: 160,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '90deg' }],
    zIndex: 5,
  },
  landscapeLabelWrapBottom: {
    position: 'absolute',
    left: '50%',
    marginLeft: -34,
    bottom: 66,
    width: 160,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '90deg' }],
    zIndex: 5,
  },
  landscapeRedText: {
    color: '#DC2626',
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  bottomActionArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 10,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    marginTop: 2,
  },
  confirmBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnActive: {
    backgroundColor: '#0284C7',
    elevation: 3,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  confirmBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  confirmBtnTextDisabled: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    letterSpacing: 0,
  },
  resetBtnCompact: {
    height: 46,
    paddingHorizontal: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  resetBtnCompactText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  resultCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  resultHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultHeaderTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  resultCloseBtn: {
    padding: 4,
  },
  bigScoreBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginVertical: 12,
  },
  bigScoreNumber: {
    fontSize: 48,
    fontWeight: '900',
    color: '#0284C7',
    letterSpacing: -1,
  },
  bigScoreUnit: {
    fontSize: 20,
    fontWeight: '800',
    color: '#64748B',
    marginLeft: 6,
  },
  completedSubtitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 10,
  },
  painCategoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginBottom: 16,
  },
  painCategoryText: {
    fontSize: 13,
    fontWeight: '800',
  },
  quickModalDivider: {
    width: '100%',
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 14,
  },
  continueTouchArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F0F9FF',
    width: '100%',
  },
  continueTouchText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0284C7',
  },
  patientResultMetaBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  patientMetaLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  patientMetaText: {
    fontSize: 13,
    color: '#334155',
  },
  boldText: {
    fontWeight: '800',
    color: '#0F172A',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    width: '100%',
  },
  errorBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B91C1C',
    flex: 1,
  },
  saveResultBtn: {
    width: '100%',
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    elevation: 3,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  savingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  saveResultBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  reAssessBtn: {
    paddingVertical: 10,
    marginTop: 4,
  },
  reAssessBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
});
