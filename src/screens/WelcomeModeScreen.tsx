import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppUser } from '../types';

interface WelcomeModeScreenProps {
  onSelectQuickSurvey: () => void;
  onSelectPatientTracking: () => void;
  onOpenResearcher?: () => void;
  currentUser?: AppUser | null;
}

export const WelcomeModeScreen: React.FC<WelcomeModeScreenProps> = ({
  onSelectQuickSurvey,
  onSelectPatientTracking,
  onOpenResearcher,
  currentUser,
}) => {
  return (
    <ScrollView
      contentContainerStyle={styles.container}
      bounces={false}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar barStyle="dark-content" />

      {/* Top Bar with App branding and Researcher Access */}
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <Ionicons name="fitness" size={20} color="#0284C7" />
          </View>
          <View>
            <Text style={styles.brandTitle}>Smart-VAS</Text>
            <Text style={styles.brandSubtitle}>Thang đo eVAS chuẩn 10 cm</Text>
          </View>
        </View>

        {onOpenResearcher && (
          <TouchableOpacity
            style={styles.researcherBtn}
            onPress={onOpenResearcher}
            activeOpacity={0.7}
          >
            <Ionicons name="shield-checkmark" size={17} color="#0369A1" />
            <Text style={styles.researcherBtnText}>Tài khoản</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Welcome Hero */}
      <View style={styles.heroSection}>
        <View style={styles.medicalPill}>
          <Ionicons name="pulse" size={13} color="#059669" />
          <Text style={styles.medicalPillText}>Quy chuẩn nghiên cứu lâm sàng</Text>
        </View>
        <Text style={styles.heroHeading}>CHỌN CHẾ ĐỘ SỬ DỤNG</Text>
      </View>

      {/* Mode Cards Container - Phóng to cân đối và phân biệt màu sắc rõ ràng (Phần 3.1 & 3.2) */}
      <View style={styles.cardsContainer}>
        {/* CHẾ ĐỘ 1: KHẢO SÁT VAS NHANH (TÔNG CAM/VÀNG) */}
        <TouchableOpacity
          style={[styles.modeCard, styles.modeCardQuick]}
          onPress={onSelectQuickSurvey}
          activeOpacity={0.88}
        >
          <View style={[styles.cardAccentBar, { backgroundColor: '#F59E0B' }]} />
          <View style={styles.cardContent}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.cardIconBox, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="flash" size={32} color="#D97706" />
              </View>
              <View style={styles.cardBadgeWarning}>
                <Text style={styles.cardBadgeWarningText}>Không lưu kết quả</Text>
              </View>
            </View>

            <Text style={styles.cardTitle}>KHẢO SÁT VAS NHANH</Text>

            <View style={styles.cardFooter}>
              <View style={[styles.actionBtn, styles.actionBtnQuick]}>
                <Text style={[styles.actionText, { color: '#B45309' }]}>Bắt đầu khảo sát</Text>
                <Ionicons name="arrow-forward-circle" size={24} color="#D97706" />
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* CHẾ ĐỘ 2: THEO DÕI ĐAU BỆNH NHÂN (TÔNG XANH DƯƠNG) */}
        <TouchableOpacity
          style={[styles.modeCard, styles.modeCardPatient]}
          onPress={onSelectPatientTracking}
          activeOpacity={0.88}
        >
          <View style={[styles.cardAccentBar, { backgroundColor: '#0284C7' }]} />
          <View style={styles.cardContent}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.cardIconBox, { backgroundColor: '#E0F2FE' }]}>
                <Ionicons name="clipboard-outline" size={32} color="#0284C7" />
              </View>
              <View style={styles.cardBadgePrimary}>
                <Text style={styles.cardBadgePrimaryText}>Hồ sơ lâm sàng</Text>
              </View>
            </View>

            <Text style={styles.cardTitle}>THEO DÕI ĐAU BỆNH NHÂN</Text>

            <View style={styles.cardFooter}>
              <View style={[styles.actionBtn, styles.actionBtnPatient]}>
                <Text style={[styles.actionText, { color: '#0369A1' }]}>Mở danh sách bệnh nhân</Text>
                <Ionicons name="arrow-forward-circle" size={24} color="#0284C7" />
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* Footer Info - Container đồng nhất căn chỉnh chuẩn Icon và Chữ (Phần 3.4) */}
      <View style={styles.footerContainer}>
        <Ionicons name="shield-checkmark" size={18} color="#0284C7" style={styles.footerIcon} />
        <Text style={styles.footerInfoText}>
          Dữ liệu bệnh nhân được bảo mật an toàn trên thiết bị và tuân thủ quy chuẩn y tế.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 14,
    paddingBottom: 12,
    backgroundColor: '#F8FAFC',
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  brandSubtitle: {
    fontSize: 11,
    color: '#64748B',
  },
  researcherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    flexShrink: 0,
  },
  researcherBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369A1',
  },
  heroSection: {
    marginBottom: 14,
  },
  medicalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#ECFDF5',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    gap: 5,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  medicalPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  heroHeading: {
    fontSize: 21,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  cardsContainer: {
    gap: 16,
    flex: 1,
    justifyContent: 'center',
    marginVertical: 10,
  },
  modeCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1.5,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  modeCardQuick: {
    borderColor: '#FED7AA',
  },
  modeCardPatient: {
    borderColor: '#BAE6FD',
  },
  cardAccentBar: {
    width: 8,
  },
  cardContent: {
    flex: 1,
    padding: 20,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardIconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBadgeWarning: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  cardBadgeWarningText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
  },
  cardBadgePrimary: {
    backgroundColor: '#E0F2FE',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  cardBadgePrimaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369A1',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  cardFooter: {
    marginTop: 2,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  actionBtnQuick: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
  },
  actionBtnPatient: {
    backgroundColor: '#F0F9FF',
    borderColor: '#7DD3FC',
  },
  actionText: {
    fontSize: 15,
    fontWeight: '800',
  },
  footerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 10,
    marginBottom: Platform.OS === 'ios' ? 14 : 8,
  },
  footerIcon: {
    flexShrink: 0,
  },
  footerInfoText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
    lineHeight: 16,
    flex: 1,
  },
});
