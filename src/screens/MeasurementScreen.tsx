import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PainContext } from '../types';
import { EVASSlider } from '../components/eVASSlider';
import { CalibrationModal } from '../components/CalibrationModal';
import { getStoredCalibrationFactor } from '../utils/physicalScale';

interface MeasurementScreenProps {
  studyId: string;
  painContext: PainContext;
  onConfirmScore: (score: number) => void;
  onBack: () => void;
  isSubmitting?: boolean;
}

export const MeasurementScreen: React.FC<MeasurementScreenProps> = ({
  studyId,
  painContext,
  onConfirmScore,
  onBack,
  isSubmitting = false,
}) => {
  // Điểm VAS từ 0 đến 100, chuẩn y khoa ban đầu đặt ở 0 (Không đau)
  const [score, setScore] = useState<number>(0);
  const [scrollEnabled, setScrollEnabled] = useState<boolean>(true);
  const [isCalibrationOpen, setIsCalibrationOpen] = useState<boolean>(false);
  const [calibrationFactor, setCalibrationFactor] = useState<number>(1.0);
  const [showRulerTicks, setShowRulerTicks] = useState<boolean>(false);

  useEffect(() => {
    getStoredCalibrationFactor().then((f) => setCalibrationFactor(f));
  }, []);

  const contextLabel = painContext === 'nghi' ? 'Đau lúc nghỉ' : 'Đau khi vận động';

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.container}
        bounces={false}
        scrollEnabled={scrollEnabled}
      >
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            disabled={isSubmitting}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color="#334155" />
            <Text style={styles.backText}>Quay lại</Text>
          </TouchableOpacity>

          <View style={styles.topBadges}>
            <View style={styles.contextBadge}>
              <Text style={styles.contextBadgeText}>{contextLabel}</Text>
            </View>
            <View style={styles.studyBadge}>
              <Text style={styles.studyBadgeValue}>{studyId}</Text>
            </View>
          </View>
        </View>

        {/* Screen Title & Prompt */}
        <View style={styles.headerSection}>
          <View style={styles.stepHeaderRow}>
            <Text style={styles.stepIndicator}>Bước 3/3 • Đo lường eVAS</Text>
            <TouchableOpacity
              style={styles.calibQuickBtn}
              onPress={() => setIsCalibrationOpen(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="resize-outline" size={13} color="#0284C7" />
              <Text style={styles.calibQuickText}>Chuẩn 10 cm</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.screenTitle}>Thang Điểm VAS Dọc</Text>
          <Text style={styles.mainQuestion}>
            Mức độ đau hiện tại của chị là bao nhiêu?
          </Text>
          <Text style={styles.instruction}>
            Chạm hoặc vuốt dấu chỉ dọc theo thanh thước 10cm đến vị trí mô tả đúng nhất cảm giác đau.
          </Text>
        </View>

        {/* Interactive Continuous Vertical Slider Area */}
        <View style={styles.sliderCard}>
          <View style={styles.cardToolbar}>
            <View style={styles.scaleSpecBadge}>
              <Ionicons name="shield-checkmark-outline" size={13} color="#059669" />
              <Text style={styles.scaleSpecText}>Chuẩn 100 mm vật lý</Text>
            </View>

            <TouchableOpacity
              style={[styles.toggleRulerBtn, showRulerTicks && styles.toggleRulerBtnActive]}
              onPress={() => setShowRulerTicks((prev) => !prev)}
            >
              <Ionicons
                name={showRulerTicks ? 'eye-outline' : 'eye-off-outline'}
                size={13}
                color={showRulerTicks ? '#0284C7' : '#64748B'}
              />
              <Text style={[styles.toggleRulerText, showRulerTicks && styles.toggleRulerTextActive]}>
                {showRulerTicks ? 'Ẩn vạch cm' : 'Hiện vạch cm'}
              </Text>
            </TouchableOpacity>
          </View>

          <EVASSlider
            value={score}
            onChange={setScore}
            onSlidingStart={() => setScrollEnabled(false)}
            onSlidingComplete={() => setScrollEnabled(true)}
            disabled={isSubmitting}
            calibrationFactor={calibrationFactor}
            showRulerTicks={showRulerTicks}
          />
        </View>

        {/* Confirm Button */}
        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={[styles.confirmButton, isSubmitting && styles.buttonDisabled]}
            onPress={() => onConfirmScore(score)}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.confirmButtonText}>Xác nhận điểm đau</Text>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={24}
                  color="#FFFFFF"
                  style={styles.btnIcon}
                />
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.subtext}>
            Sau khi xác nhận, điểm số sẽ được hệ thống mã hóa và lưu trữ tự động.
          </Text>
        </View>
      </ScrollView>

      {/* Modal Kiểm tra & Hiệu chuẩn Thước 10cm */}
      <CalibrationModal
        visible={isCalibrationOpen}
        onClose={() => setIsCalibrationOpen(false)}
        onCalibrationSaved={(newFactor) => setCalibrationFactor(newFactor)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingTop: 12,
    flexGrow: 1,
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  backText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginLeft: 4,
  },
  topBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  contextBadge: {
    backgroundColor: '#E0F2FE',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  contextBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369A1',
  },
  studyBadge: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  studyBadgeValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 10,
  },
  stepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
  },
  stepIndicator: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  calibQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 7,
    gap: 4,
  },
  calibQuickText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  mainQuestion: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 4,
  },
  instruction: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  sliderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 18,
    paddingHorizontal: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  cardToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  scaleSpecBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  scaleSpecText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  toggleRulerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  toggleRulerBtnActive: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  toggleRulerText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  toggleRulerTextActive: {
    color: '#0284C7',
    fontWeight: '700',
  },
  bottomSection: {
    marginTop: 10,
  },
  confirmButton: {
    backgroundColor: '#0284C7',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
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
  confirmButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnIcon: {
    marginLeft: 8,
  },
  subtext: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 16,
  },
});
