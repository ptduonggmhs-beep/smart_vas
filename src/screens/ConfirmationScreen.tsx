import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Assessment } from '../types';
import { formatDateTime } from '../utils/timepointRules';

interface ConfirmationScreenProps {
  assessment: Assessment;
  onReset: () => void;
  onOpenHistory?: () => void;
}

export const ConfirmationScreen: React.FC<ConfirmationScreenProps> = ({
  assessment,
  onReset,
  onOpenHistory,
}) => {
  const isSuccess = assessment.save_status === 'success';
  const isNotCompleted = assessment.completion_status === 'not_completed';
  const actualTimeStr = formatDateTime(assessment.actual_timestamp || assessment.submit_timestamp);
  const timepointLabel = assessment.timepoint_label || (assessment.assessment_timepoint as string) || 'T0';
  const scoreStr = typeof assessment.vas_score === 'number'
    ? assessment.vas_score.toFixed(1)
    : typeof assessment.eVAS_score === 'number'
    ? assessment.eVAS_score.toFixed(1)
    : '---';

  const isT0 = assessment.timepoint_status === 'BASELINE' || timepointLabel === 'T0';
  const elapsedMinutes = assessment.elapsed_minutes_from_T0 ?? 0;

  return (
    <ScrollView contentContainerStyle={styles.container} bounces={false}>
      <View style={styles.contentWrapper}>
        {/* Biểu tượng trạng thái thành công */}
        <View
          style={[
            styles.iconCircle,
            isNotCompleted && { backgroundColor: '#F59E0B' },
          ]}
        >
          <Ionicons
            name={isNotCompleted ? 'document-text-outline' : 'checkmark'}
            size={52}
            color="#FFFFFF"
          />
        </View>

        {/* Tiêu đề trạng thái: Đã lưu đánh giá thành công */}
        <Text style={styles.title}>Đã lưu đánh giá thành công</Text>
        <Text style={styles.subtitle}>
          Dữ liệu đánh giá đau đã được xác nhận và lưu vào hệ thống nghiên cứu an toàn.
        </Text>

        {/* Sync Status Badge */}
        <View
          style={[
            styles.syncBadge,
            isSuccess ? styles.syncBadgeSuccess : styles.syncBadgeOffline,
          ]}
        >
          <Ionicons
            name={isSuccess ? 'cloud-done-outline' : 'cloud-offline-outline'}
            size={16}
            color={isSuccess ? '#059669' : '#D97706'}
          />
          <Text
            style={[
              styles.syncText,
              isSuccess ? styles.syncTextSuccess : styles.syncTextOffline,
            ]}
          >
            {isSuccess
              ? 'Đã đồng bộ lên CSDL trung tâm (Firebase)'
              : 'Đã lưu an toàn trong máy (Bộ nhớ cục bộ)'}
          </Text>
        </View>

        {/* Thẻ tóm tắt thông tin kết quả đánh giá theo Phần 3.2 & 5.2 */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Chi tiết kết quả đánh giá</Text>

          {/* Mốc thời gian */}
          <View style={styles.highlightInfoRow}>
            <Text style={styles.highlightLabel}>Mốc thời gian:</Text>
            <View style={styles.timepointBadge}>
              <Text style={styles.timepointBadgeText}>{timepointLabel}</Text>
            </View>
          </View>

          {/* Giờ đánh giá thực tế */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Giờ đánh giá thực tế:</Text>
            <Text style={styles.infoValue}>{actualTimeStr}</Text>
          </View>

          {/* Số phút từ T0 (nếu không phải T0) */}
          {!isT0 && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Thời gian từ T0:</Text>
              <Text style={styles.infoValue}>{Math.round(elapsedMinutes)} phút</Text>
            </View>
          )}

          {/* Điểm VAS */}
          <View style={styles.divider} />
          <View style={styles.scoreRow}>
            <Text style={styles.scoreLabel}>Điểm VAS ghi nhận:</Text>
            <Text style={styles.scoreValue}>{scoreStr} mm</Text>
          </View>
          <View style={styles.divider} />

          {/* Mã bệnh nhân & Đợt theo dõi */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Mã bệnh nhân:</Text>
            <Text style={styles.infoValue}>{assessment.patient_code || assessment.study_id}</Text>
          </View>

          {assessment.episode_id && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Đợt theo dõi:</Text>
              <Text style={[styles.infoValue, { fontSize: 12, color: '#64748B' }]}>
                {assessment.episode_id}
              </Text>
            </View>
          )}

          {/* Trạng thái thời điểm */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Trạng thái cửa sổ:</Text>
            <Text
              style={[
                styles.infoValue,
                assessment.timepoint_status === 'ON_TIME' && { color: '#059669' },
                assessment.timepoint_status === 'EARLY' && { color: '#D97706' },
                assessment.timepoint_status === 'OUT_OF_WINDOW' && { color: '#7C3AED' },
                assessment.timepoint_status === 'BASELINE' && { color: '#0284C7' },
              ]}
            >
              {assessment.timepoint_status === 'BASELINE'
                ? 'Thiết lập mốc T0 gốc'
                : assessment.timepoint_status === 'ON_TIME'
                ? 'Đúng cửa sổ quy định (±10 phút)'
                : assessment.timepoint_status === 'EARLY'
                ? 'Đánh giá sớm trước T1'
                : 'Ngoài cửa sổ thời gian'}
            </Text>
          </View>
        </View>

        {/* Nút hành động */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={onReset}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Tiếp tục lượt đánh giá mới</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
          </TouchableOpacity>

          {onOpenHistory && (
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={onOpenHistory}
              activeOpacity={0.7}
            >
              <Ionicons name="time-outline" size={18} color="#0284C7" style={{ marginRight: 6 }} />
              <Text style={styles.secondaryBtnText}>Xem lịch sử đánh giá của bệnh nhân</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    flexGrow: 1,
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  contentWrapper: {
    alignItems: 'center',
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginBottom: 20,
  },
  syncBadgeSuccess: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  syncBadgeOffline: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  syncText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  syncTextSuccess: {
    color: '#047857',
  },
  syncTextOffline: {
    color: '#B45309',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    width: '100%',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  highlightInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#F0F9FF',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  highlightLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0369A1',
  },
  timepointBadge: {
    backgroundColor: '#0284C7',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  timepointBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '700',
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  scoreLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  scoreValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0B3D91',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 10,
  },
  actionsContainer: {
    width: '100%',
    gap: 10,
  },
  primaryBtn: {
    backgroundColor: '#0284C7',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
    borderRadius: 14,
    elevation: 3,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 13,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0284C7',
  },
});
