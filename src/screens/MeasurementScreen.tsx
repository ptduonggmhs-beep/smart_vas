import React, { useState } from 'react';
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
  // Bắt đầu ở vị trí trung lập 0 hoặc 50 tùy theo thiết kế, chuẩn VAS thường để ở 0 hoặc để sản phụ kéo
  const [score, setScore] = useState<number>(0);
  const [scrollEnabled, setScrollEnabled] = useState<boolean>(true);

  const contextLabel = painContext === 'nghi' ? 'Đau lúc nghỉ' : 'Đau khi vận động';

  return (
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
          <Ionicons name="arrow-back" size={22} color="#334155" />
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
        <Text style={styles.stepIndicator}>Bước 3/3 • Đo lường eVAS</Text>
        <Text style={styles.screenTitle}>Thang điểm VAS</Text>
        <Text style={styles.mainQuestion}>
          Mức độ đau hiện tại của chị là bao nhiêu?
        </Text>
        <Text style={styles.instruction}>
          Hãy di chuyển dấu chỉ trên đường ngang đến vị trí mô tả đúng nhất.
        </Text>
      </View>

      {/* Interactive Continuous Slider Area */}
      <View style={styles.sliderCard}>
        <EVASSlider
          value={score}
          onChange={setScore}
          onSlidingStart={() => setScrollEnabled(false)}
          onSlidingComplete={() => setScrollEnabled(true)}
          disabled={isSubmitting}
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
              <Ionicons name="checkmark-circle-outline" size={24} color="#FFFFFF" style={styles.btnIcon} />
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.subtext}>
          Sau khi xác nhận, điểm số sẽ được hệ thống mã hóa và lưu trữ tự động.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingTop: 16,
    flexGrow: 1,
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  backText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginLeft: 6,
  },
  topBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  contextBadge: {
    backgroundColor: '#E0F2FE',
    paddingVertical: 6,
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
    paddingVertical: 6,
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
    marginBottom: 20,
  },
  stepIndicator: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284C7',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  mainQuestion: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 6,
  },
  instruction: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  sliderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  bottomSection: {
    marginTop: 16,
  },
  confirmButton: {
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
  confirmButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnIcon: {
    marginLeft: 10,
  },
  subtext: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 18,
  },
});
