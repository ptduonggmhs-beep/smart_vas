import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PainContext } from '../types';

interface ContextScreenProps {
  studyId: string;
  onSelectContext: (context: PainContext) => void;
  onBack: () => void;
}

export const ContextScreen: React.FC<ContextScreenProps> = ({
  studyId,
  onSelectContext,
  onBack,
}) => {
  return (
    <ScrollView contentContainerStyle={styles.container} bounces={false}>
      {/* Top Bar with Back and Study ID */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="#334155" />
          <Text style={styles.backText}>Quay lại</Text>
        </TouchableOpacity>
        <View style={styles.studyBadge}>
          <Text style={styles.studyBadgeLabel}>Mã BN:</Text>
          <Text style={styles.studyBadgeValue}>{studyId}</Text>
        </View>
      </View>

      {/* Screen Title & Prompt */}
      <View style={styles.headerSection}>
        <Text style={styles.stepIndicator}>Bước 2/3</Text>
        <Text style={styles.screenTitle}>Tình trạng hiện tại</Text>
        <Text style={styles.promptText}>
          Chị đang đánh giá đau trong tình huống nào?
        </Text>
      </View>

      {/* Two Big Context Cards */}
      <View style={styles.cardsContainer}>
        {/* Option 1: Đau lúc nghỉ */}
        <TouchableOpacity
          style={[styles.contextCard, styles.cardResting]}
          onPress={() => onSelectContext('nghi')}
          activeOpacity={0.8}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: '#E0F2FE' }]}>
              <Ionicons name="bed-outline" size={32} color="#0284C7" />
            </View>
            <View style={styles.primaryTag}>
              <Text style={styles.primaryTagText}>Chuẩn lâm sàng</Text>
            </View>
          </View>
          <Text style={styles.cardTitle}>Đau lúc nghỉ</Text>
          <Text style={styles.cardSubtitle}>Đang nằm yên, không chủ động vận động</Text>
          <View style={styles.cardFooter}>
            <Text style={styles.cardActionText}>Nhấn để chọn tình huống này</Text>
            <Ionicons name="chevron-forward" size={20} color="#0284C7" />
          </View>
        </TouchableOpacity>

        {/* Option 2: Đau khi vận động */}
        <TouchableOpacity
          style={[styles.contextCard, styles.cardMoving]}
          onPress={() => onSelectContext('van_dong')}
          activeOpacity={0.8}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="walk-outline" size={32} color="#D97706" />
            </View>
          </View>
          <Text style={styles.cardTitle}>Đau khi vận động</Text>
          <Text style={styles.cardSubtitle}>Khi trở mình hoặc ngồi dậy</Text>
          <View style={styles.cardFooter}>
            <Text style={[styles.cardActionText, { color: '#D97706' }]}>Nhấn để chọn tình huống này</Text>
            <Ionicons name="chevron-forward" size={20} color="#D97706" />
          </View>
        </TouchableOpacity>
      </View>

      {/* Clinical Reference Note */}
      <View style={styles.clinicalRecommendation}>
        <Ionicons name="information-circle-outline" size={18} color="#64748B" style={{ marginRight: 6 }} />
        <Text style={styles.clinicalRecText}>
          Khuyến nghị: Để đồng bộ với các thang điểm VAS giấy truyền thống, lần đánh giá chính nên chuẩn hóa là "đau lúc nghỉ".
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
  studyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  studyBadgeLabel: {
    fontSize: 12,
    color: '#0369A1',
    marginRight: 4,
  },
  studyBadgeValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0284C7',
  },
  headerSection: {
    marginBottom: 24,
    alignItems: 'center',
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
    marginBottom: 10,
    textAlign: 'center',
  },
  promptText: {
    fontSize: 17,
    fontWeight: '500',
    color: '#475569',
    textAlign: 'center',
    lineHeight: 24,
  },
  cardsContainer: {
    gap: 18,
    marginVertical: 12,
  },
  contextCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    borderWidth: 2,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  cardResting: {
    borderColor: '#BAE6FD',
  },
  cardMoving: {
    borderColor: '#FDE68A',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryTag: {
    backgroundColor: '#E0F2FE',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  primaryTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369A1',
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 15,
    color: '#64748B',
    lineHeight: 22,
    marginBottom: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cardActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0284C7',
  },
  clinicalRecommendation: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  clinicalRecText: {
    flex: 1,
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
});
