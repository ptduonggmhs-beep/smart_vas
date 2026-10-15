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
  const isOffline = assessment.save_status === 'offline_cached';

  return (
    <ScrollView contentContainerStyle={styles.container} bounces={false}>
      <View style={styles.contentWrapper}>
        {/* Animated-like Success Icon Circle */}
        <View style={styles.iconCircle}>
          <Ionicons name="checkmark" size={56} color="#FFFFFF" />
        </View>

        {/* Success Title */}
        <Text style={styles.title}>Đã ghi nhận</Text>
        <Text style={styles.subtitle}>Cảm ơn chị đã hoàn thành đánh giá.</Text>

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
              ? 'Đã đồng bộ lên Firebase (smart-vas-f312e)'
              : 'Đã lưu an toàn trong máy (Bộ nhớ cục bộ)'}
          </Text>
        </View>

        {/* Permission warning banner if applicable */}
        {assessment.error_code && assessment.error_code.toLowerCase().includes('permission') && (
          <View style={styles.permissionWarningBanner}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#B45309" />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.permissionWarningTitle}>
                Dữ liệu đã lưu an toàn trên máy
              </Text>
              <Text style={styles.permissionWarningSub}>
                Kết quả đánh giá đã được lưu vào bộ nhớ cục bộ và sẽ tự động đồng bộ khi kết nối lại.
              </Text>
            </View>
          </View>
        )}

        {/* Summary Card for Researcher & Clinical Validation */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Thông tin phiên đánh giá</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Mã nghiên cứu:</Text>
            <Text style={styles.infoValue}>{assessment.study_id}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Thời điểm đánh giá:</Text>
            <Text style={styles.infoValue}>
              {new Date(assessment.submit_timestamp).toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Bối cảnh đau:</Text>
            <Text style={styles.infoValue}>
              {assessment.pain_context === 'nghi' ? 'Đau lúc nghỉ' : 'Đau khi vận động'}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Thời gian thao tác:</Text>
            <Text style={styles.infoValue}>{assessment.duration_seconds} giây</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Mã đánh giá (UUID):</Text>
            <Text style={styles.infoValueUUID} numberOfLines={1}>
              {assessment.assessment_id.slice(0, 18)}...
            </Text>
          </View>
        </View>

        {/* Safety Warning Box (Theo đúng PRD Trang 3 & 4) */}
        <View style={styles.safetyBox}>
          <View style={styles.safetyHeader}>
            <Ionicons name="alert-circle" size={20} color="#DC2626" />
            <Text style={styles.safetyTitle}>Cảnh báo an toàn</Text>
          </View>
          <Text style={styles.safetyText}>
            Nếu chị đau nhiều hoặc cần hỗ trợ, hãy gọi nhân viên y tế ngay lập tức.
          </Text>
          <Text style={styles.safetySubtext}>
            Ứng dụng chỉ thu thập dữ liệu nghiên cứu, KHÔNG được thiết kế để tự động ra quyết định dùng thuốc hoặc thay thế phác đồ điều trị thường quy của khoa.
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.bottomSection}>
        {onOpenHistory && (
          <TouchableOpacity
            style={styles.historyButton}
            onPress={onOpenHistory}
            activeOpacity={0.8}
          >
            <Ionicons name="time-outline" size={20} color="#0284C7" style={{ marginRight: 8 }} />
            <Text style={styles.historyButtonText}>Xem lịch sử các đánh giá của tôi</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.doneButton} onPress={onReset} activeOpacity={0.85}>
          <Text style={styles.doneButtonText}>Hoàn tất / Đánh giá mới</Text>
          <Ionicons name="refresh" size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingTop: 36,
    flexGrow: 1,
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
  },
  contentWrapper: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 16,
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginBottom: 24,
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
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  syncTextSuccess: {
    color: '#047857',
  },
  syncTextOffline: {
    color: '#B45309',
  },
  permissionWarningBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  permissionWarningTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 2,
  },
  permissionWarningSub: {
    fontSize: 12,
    color: '#B45309',
    lineHeight: 16,
  },
  summaryCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  infoLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  infoValueUUID: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#64748B',
    maxWidth: '55%',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 4,
  },
  safetyBox: {
    width: '100%',
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 16,
  },
  safetyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  safetyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#B91C1C',
    marginLeft: 6,
  },
  safetyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#991B1B',
    lineHeight: 20,
    marginBottom: 6,
  },
  safetySubtext: {
    fontSize: 12,
    color: '#7F1D1D',
    lineHeight: 17,
  },
  bottomSection: {
    marginTop: 12,
    alignItems: 'center',
    width: '100%',
  },
  historyButton: {
    width: '100%',
    backgroundColor: '#E0F2FE',
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 12,
  },
  historyButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0284C7',
  },
  doneButton: {
    width: '100%',
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
  doneButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
