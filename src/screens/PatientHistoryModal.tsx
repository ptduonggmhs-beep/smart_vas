import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Assessment } from '../types';
import { FirebaseService } from '../services/firebaseService';

interface PatientHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  studyId: string;
}

export const PatientHistoryModal: React.FC<PatientHistoryModalProps> = ({
  visible,
  onClose,
  studyId,
}) => {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (visible && studyId.trim()) {
      setLoading(true);
      FirebaseService.getAssessmentsByPatient(studyId.trim())
        .then((list) => {
          // Sort chronological order (newest first)
          const sorted = [...list].sort(
            (a, b) => new Date(b.submit_timestamp).getTime() - new Date(a.submit_timestamp).getTime()
          );
          setAssessments(sorted);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [visible, studyId]);

  const getScoreColor = (score: number) => {
    if (score === 0) return '#10B981';
    if (score < 30) return '#059669';
    if (score < 70) return '#D97706';
    return '#DC2626';
  };

  const getScoreLabel = (score: number) => {
    if (score === 0) return 'Không đau';
    if (score < 30) return 'Đau nhẹ';
    if (score < 70) return 'Đau vừa';
    return 'Đau dữ dội';
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <View style={styles.badgeRow}>
              <View style={styles.patientBadge}>
                <Ionicons name="person" size={14} color="#0284C7" />
                <Text style={styles.patientBadgeText}>Mã: {studyId.toUpperCase()}</Text>
              </View>
              <Text style={styles.totalCountText}>({assessments.length} lần đánh giá)</Text>
            </View>
            <Text style={styles.headerTitle}>Lịch sử Đánh giá Điểm đau</Text>
          </View>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="close" size={24} color="#334155" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#0284C7" />
            <Text style={styles.loadingText}>Đang tải lịch sử đánh giá của chị...</Text>
          </View>
        ) : assessments.length === 0 ? (
          <View style={styles.centerBox}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="time-outline" size={44} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTitle}>Chưa có lần đánh giá nào</Text>
            <Text style={styles.emptySubtitle}>
              Khi chị hoàn thành đánh giá điểm đau, lịch sử theo dõi sẽ tự động hiển thị tại đây để chị và bác sĩ cùng theo dõi diễn tiến giảm đau.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollList} bounces={false}>
            {/* Quick summary banner */}
            <View style={styles.summaryBanner}>
              <View style={styles.summaryCol}>
                <Text style={styles.summaryLabel}>Mức đau gần nhất</Text>
                <Text style={[styles.summaryValue, { color: getScoreColor(assessments[0].eVAS_score) }]}>
                  {getScoreLabel(assessments[0].eVAS_score)}
                </Text>
                <Text style={styles.summarySub}>
                  {assessments[0].pain_context === 'nghi' ? 'Lúc nghỉ ngơi' : 'Khi vận động'}
                </Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryCol}>
                <Text style={styles.summaryLabel}>Thời gian</Text>
                <Text style={styles.summaryValueTime}>
                  {new Date(assessments[0].submit_timestamp).toLocaleTimeString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
                <Text style={styles.summarySub}>
                  {new Date(assessments[0].submit_timestamp).toLocaleDateString('vi-VN')}
                </Text>
              </View>
            </View>

            <Text style={styles.timelineTitle}>Chi tiết các lần đánh giá:</Text>

            {/* List of assessments */}
            {assessments.map((item, index) => {
              const color = getScoreColor(item.eVAS_score);
              const label = getScoreLabel(item.eVAS_score);
              const isRest = item.pain_context === 'nghi';

              return (
                <View key={item.assessment_id} style={styles.historyCard}>
                  {/* Left accent color bar */}
                  <View style={[styles.cardColorBar, { backgroundColor: color }]} />

                  <View style={styles.cardMain}>
                    <View style={styles.cardHeaderRow}>
                      <View style={styles.cardIndexBadge}>
                        <Text style={styles.cardIndexText}>Lần {assessments.length - index}</Text>
                      </View>

                      <View style={[styles.contextBadge, isRest ? styles.badgeRest : styles.badgeMove]}>
                        <Ionicons
                          name={isRest ? 'bed-outline' : 'walk-outline'}
                          size={14}
                          color={isRest ? '#0284C7' : '#D97706'}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={[styles.contextText, isRest ? styles.textRest : styles.textMove]}>
                          {isRest ? 'Lúc nghỉ' : 'Khi vận động'}
                        </Text>
                      </View>

                      {/* Nhãn mức độ đau bằng chữ, không hiển thị số */}
                      <View style={[styles.levelBadgeTag, { backgroundColor: `${color}15`, borderColor: `${color}40` }]}>
                        <Text style={[styles.cardScoreLabel, { color }]}>{label}</Text>
                      </View>
                    </View>

                    {/* Thanh tỷ lệ thị giác trực quan (không hiển thị số mm) */}
                    <View style={styles.miniBarBg}>
                      <View
                        style={[
                          styles.miniBarFill,
                          {
                            width: `${Math.max(3, Math.min(100, item.eVAS_score))}%`,
                            backgroundColor: color,
                          },
                        ]}
                      />
                    </View>

                    <View style={styles.cardFooterRow}>
                      <Text style={styles.cardDurationText}>
                        {item.duration_seconds}s thao tác
                      </Text>
                      <Text style={styles.cardTimeText}>
                        {new Date(item.submit_timestamp).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        • {new Date(item.submit_timestamp).toLocaleDateString('vi-VN')}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* Bottom Close Button */}
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.doneBtnText}>Đóng lại</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  patientBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 4,
  },
  patientBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
  totalCountText: {
    fontSize: 12,
    color: '#64748B',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  scrollList: {
    padding: 20,
    paddingBottom: 40,
  },
  summaryBanner: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  summaryCol: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '900',
  },
  summaryValueTime: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  summarySub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  timelineTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 12,
  },
  historyCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardColorBar: {
    width: 6,
  },
  cardMain: {
    flex: 1,
    padding: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardIndexBadge: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  cardIndexText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  contextBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  badgeRest: {
    backgroundColor: '#E0F2FE',
  },
  badgeMove: {
    backgroundColor: '#FEF3C7',
  },
  contextText: {
    fontSize: 12,
    fontWeight: '700',
  },
  textRest: {
    color: '#0284C7',
  },
  textMove: {
    color: '#D97706',
  },
  levelBadgeTag: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginLeft: 'auto',
  },
  cardScoreLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  miniBarBg: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
    marginVertical: 6,
  },
  miniBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  cardDurationText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  cardTimeText: {
    fontSize: 12,
    color: '#64748B',
  },
  bottomBar: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  doneBtn: {
    backgroundColor: '#0284C7',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
