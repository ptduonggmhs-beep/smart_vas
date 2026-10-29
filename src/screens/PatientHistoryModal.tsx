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
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Assessment, PatientEpisode } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { StorageService } from '../services/storageService';
import { CLINICAL_DEFINITIONS, REASON_NOT_COMPLETED_LABELS } from '../config/clinicalConfig';
import { formatTimestamp } from '../utils/timepointRules';

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
  const [contextFilter, setContextFilter] = useState<'all' | 'nghi' | 'hoat_dong'>('all');
  const [activeEpisode, setActiveEpisode] = useState<PatientEpisode | null>(null);

  const loadData = async () => {
    if (!studyId.trim()) return;
    setLoading(true);
    try {
      const [list, ep] = await Promise.all([
        FirebaseService.getAssessmentsByPatient(studyId.trim()),
        StorageService.getActiveEpisode(studyId.trim()),
      ]);
      const sorted = [...list].sort(
        (a, b) =>
          new Date(b.actual_timestamp || b.submit_timestamp).getTime() -
          new Date(a.actual_timestamp || a.submit_timestamp).getTime()
      );
      setAssessments(sorted);
      setActiveEpisode(ep);
    } catch (e) {
      console.error('Error loading history modal data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && studyId.trim()) {
      loadData();
    }
  }, [visible, studyId]);

  const handleStartNewEpisode = () => {
    Alert.alert(
      'Xác nhận tạo đợt theo dõi mới',
      `Bạn có chắc chắn muốn kết thúc đợt theo dõi hiện tại cho bệnh nhân "${studyId.toUpperCase()}" và bắt đầu một đợt theo dõi mới không?\n\n• Toàn bộ dữ liệu của đợt trước sẽ được bảo toàn nguyên vẹn.\n• Đợt mới sẽ có mã episode_id riêng.\n• Mốc T0 mới sẽ được tự động thiết lập tại lần lưu đánh giá VAS thành công tiếp theo.`,
      [
        { text: 'Hủy bỏ', style: 'cancel' },
        {
          text: 'Tạo đợt mới',
          style: 'destructive',
          onPress: async () => {
            try {
              await StorageService.deactivateActiveEpisode(studyId);
              await loadData();
              Alert.alert('Thành công', 'Đã kết thúc đợt theo dõi cũ. Lần đánh giá tiếp theo của bệnh nhân sẽ tạo mốc T0 mới.');
            } catch (err: any) {
              Alert.alert('Lỗi', err?.message || 'Không thể tạo đợt mới.');
            }
          },
        },
      ]
    );
  };

  const getScoreColor = (score: number | null) => {
    if (score === null || score === undefined) return '#64748B';
    if (score < 40) return '#059669'; // 0 - <40 mm: Đau nhẹ (xanh lá)
    if (score < 70) return '#D97706'; // 40 - <70 mm: Đau vừa (vàng cam)
    return '#DC2626'; // >=70 mm: Đau nặng (đỏ)
  };

  const getScoreLabel = (score: number | null) => {
    if (score === null || score === undefined) return 'Không thực hiện';
    if (score < 40) return 'Đau nhẹ';
    if (score < 70) return 'Đau vừa';
    return 'Đau nặng';
  };

  const getTimepointBadgeStyle = (status?: string) => {
    switch (status) {
      case 'BASELINE':
        return { bg: '#E0F2FE', text: '#0284C7', label: 'T0 (Gốc)' };
      case 'ON_TIME':
        return { bg: '#DCFCE7', text: '#15803D', label: 'Đúng giờ' };
      case 'EARLY':
        return { bg: '#FEF3C7', text: '#B45309', label: 'Đánh giá sớm' };
      case 'OUT_OF_WINDOW':
        return { bg: '#FEE2E2', text: '#B91C1C', label: 'Ngoài cửa sổ' };
      default:
        return { bg: '#F1F5F9', text: '#475569', label: status || 'Chưa rõ' };
    }
  };

  const filteredAssessments = assessments.filter((a) => {
    if (contextFilter === 'all') return true;
    if (contextFilter === 'nghi') return a.pain_context === 'nghi';
    return a.pain_context === 'hoat_dong' || a.pain_context === 'van_dong';
  });

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
              <Text style={styles.totalCountText}>({assessments.length} lần ghi nhận)</Text>
            </View>
            <Text style={styles.headerTitle}>Lịch sử Đánh giá Đau sau mổ</Text>
          </View>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="close" size={24} color="#334155" />
          </TouchableOpacity>
        </View>

        {/* Thông tin Đợt theo dõi & T0 gốc */}
        <View style={styles.episodeBanner}>
          <View style={styles.episodeInfoCol}>
            <View style={styles.episodeHeaderRow}>
              <Ionicons name="git-branch-outline" size={15} color="#0369A1" />
              <Text style={styles.episodeTitle}>
                {activeEpisode ? `Đợt theo dõi: ${activeEpisode.episode_id}` : 'Chưa có đợt theo dõi hoạt động'}
              </Text>
            </View>
            {activeEpisode?.t0_timestamp ? (
              <Text style={styles.episodeSubtitle}>
                Mốc T0 gốc: <Text style={styles.bold}>{formatTimestamp(new Date(activeEpisode.t0_timestamp))}</Text>
              </Text>
            ) : (
              <Text style={styles.episodeSubtitle}>Lần đánh giá VAS đầu tiên sẽ tự động thiết lập T0</Text>
            )}
          </View>

          {activeEpisode && (
            <TouchableOpacity
              style={styles.newEpisodeBtn}
              onPress={handleStartNewEpisode}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle-outline" size={15} color="#0369A1" />
              <Text style={styles.newEpisodeBtnText}>Đợt mới</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Bar */}
        <View style={styles.filterBar}>
          <TouchableOpacity
            style={[styles.filterChip, contextFilter === 'all' && styles.filterChipActive]}
            onPress={() => setContextFilter('all')}
          >
            <Text style={[styles.filterChipText, contextFilter === 'all' && styles.filterChipTextActive]}>
              Tất cả ({assessments.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, contextFilter === 'nghi' && styles.filterChipActive]}
            onPress={() => setContextFilter('nghi')}
          >
            <Text style={[styles.filterChipText, contextFilter === 'nghi' && styles.filterChipTextActive]}>
              Đau khi nghỉ
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, contextFilter === 'hoat_dong' && styles.filterChipActive]}
            onPress={() => setContextFilter('hoat_dong')}
          >
            <Text style={[styles.filterChipText, contextFilter === 'hoat_dong' && styles.filterChipTextActive]}>
              Đau khi hoạt động
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#0284C7" />
            <Text style={styles.loadingText}>Đang tải lịch sử đánh giá...</Text>
          </View>
        ) : filteredAssessments.length === 0 ? (
          <View style={styles.centerBox}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="time-outline" size={44} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTitle}>Chưa có bản ghi nào</Text>
            <Text style={styles.emptySubtitle}>
              Khi Anh/Chị hoàn thành đánh giá VAS, lịch sử theo dõi với các mốc T0, Tn và thời gian thực tế sẽ hiển thị tại đây.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollList} bounces={false}>
            {filteredAssessments.map((item, index) => {
              const scoreVal = typeof item.vas_score === 'number' ? item.vas_score : item.eVAS_score;
              const isNotCompleted = item.completion_status === 'not_completed';
              const color = isNotCompleted ? '#F59E0B' : getScoreColor(scoreVal);
              const label = getScoreLabel(scoreVal);
              const isRest = item.pain_context === 'nghi';
              const tpStatus = item.timepoint_status || (item.timepoint_label === 'T0' ? 'BASELINE' : 'ON_TIME');
              const statusStyle = getTimepointBadgeStyle(tpStatus);
              const displayLabel = item.timepoint_label || (item.assessment_timepoint as string) || 'T0';
              const actualTime = item.actual_timestamp || item.submit_timestamp;

              const reasonText = item.reason_not_completed
                ? (REASON_NOT_COMPLETED_LABELS[item.reason_not_completed as keyof typeof REASON_NOT_COMPLETED_LABELS] || item.reason_not_completed)
                : '';

              return (
                <View key={item.assessment_id} style={styles.historyCard}>
                  <View style={[styles.cardColorBar, { backgroundColor: color }]} />

                  <View style={styles.cardMain}>
                    {/* Hàng 1: Mốc thời gian T0/Tn & Trạng thái cửa sổ */}
                    <View style={styles.cardTopRow}>
                      <View style={styles.tpPill}>
                        <Ionicons name="alarm-outline" size={14} color="#0B3D91" />
                        <Text style={styles.tpPillText}>{displayLabel}</Text>
                      </View>

                      <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                        <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>
                          {statusStyle.label}
                        </Text>
                      </View>

                      <View style={styles.scoreBadge}>
                        <Text style={[styles.scoreBadgeText, { color }]}>
                          {scoreVal !== null && scoreVal !== undefined ? `${scoreVal.toFixed(1)} mm` : '—'}
                        </Text>
                      </View>
                    </View>

                    {/* Hàng 2: Chi tiết thời gian từ T0 & giờ đánh giá thực tế */}
                    <View style={styles.timingDetailBox}>
                      <View style={styles.timingRow}>
                        <Ionicons name="time-outline" size={13} color="#475569" />
                        <Text style={styles.timingLabel}>Giờ thực tế:</Text>
                        <Text style={styles.timingValue}>
                          {formatTimestamp(new Date(actualTime))}
                        </Text>
                      </View>

                      <View style={styles.timingRow}>
                        <Ionicons name="hourglass-outline" size={13} color="#475569" />
                        <Text style={styles.timingLabel}>Thời gian từ T0:</Text>
                        <Text style={[styles.timingValue, styles.elapsedHighlight]}>
                          {item.elapsed_minutes_from_T0 !== undefined
                            ? `${item.elapsed_minutes_from_T0} phút`
                            : '0 phút'}
                        </Text>
                      </View>

                      {item.episode_id && (
                        <View style={styles.timingRow}>
                          <Ionicons name="barcode-outline" size={13} color="#94A3B8" />
                          <Text style={styles.timingLabelMuted}>Đợt:</Text>
                          <Text style={styles.timingValueMuted}>{item.episode_id}</Text>
                        </View>
                      )}
                    </View>

                    {/* Hàng 3: Bối cảnh đau & mức độ */}
                    <View style={styles.cardHeaderRow}>
                      <View style={styles.cardIndexBadge}>
                        <Text style={styles.cardIndexText}>Lần {filteredAssessments.length - index}</Text>
                      </View>

                      <View style={[styles.contextBadge, isRest ? styles.badgeRest : styles.badgeMove]}>
                        <Ionicons
                          name={isRest ? 'bed-outline' : 'walk-outline'}
                          size={12}
                          color={isRest ? '#0284C7' : '#D97706'}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={[styles.contextText, isRest ? styles.textRest : styles.textMove]}>
                          {isRest ? CLINICAL_DEFINITIONS.RESTING_LABEL : CLINICAL_DEFINITIONS.ACTIVITY_LABEL}
                        </Text>
                      </View>

                      <View style={[styles.levelBadgeTag, { backgroundColor: `${color}15`, borderColor: `${color}40` }]}>
                        <Text style={[styles.cardScoreLabel, { color }]}>
                          {isNotCompleted ? 'Không thực hiện' : label}
                        </Text>
                      </View>
                    </View>

                    {/* Chi tiết hoạt động nếu có */}
                    {!isRest && item.activity_name && (
                      <View style={styles.activityInfoRow}>
                        <Ionicons name="fitness-outline" size={13} color="#64748B" />
                        <Text style={styles.activityInfoName}>{item.activity_name}</Text>
                        {item.activity_timing && (
                          <Text style={styles.activityInfoTiming}>
                            ({item.activity_timing === 'ngay_sau_hoat_dong' ? 'Ngay sau hoạt động' : 'Trong hoạt động'})
                          </Text>
                        )}
                      </View>
                    )}

                    {/* Hiển thị thanh đo hoặc lý do không hoàn thành */}
                    {isNotCompleted ? (
                      <View style={styles.reasonRow}>
                        <Ionicons name="information-circle" size={14} color="#D97706" />
                        <Text style={styles.reasonText}>Lý do: {reasonText}</Text>
                      </View>
                    ) : (
                      <View style={styles.miniBarBg}>
                        <View
                          style={[
                            styles.miniBarFill,
                            {
                              width: `${Math.max(3, Math.min(100, scoreVal ?? 0))}%`,
                              backgroundColor: color,
                            },
                          ]}
                        />
                      </View>
                    )}

                    <View style={styles.cardFooterRow}>
                      <Text style={styles.cardDurationText}>
                        {item.assistance_status === 'self' ? 'Tự làm' : 'Có hỗ trợ'}
                        {item.duration_seconds ? ` • ${item.duration_seconds}s` : ''}
                      </Text>
                      <Text style={styles.cardRecordIdText}>ID: {item.record_id || item.assessment_id.slice(0, 8)}</Text>
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
  episodeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0F9FF',
    borderBottomWidth: 1,
    borderBottomColor: '#BAE6FD',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  episodeInfoCol: {
    flex: 1,
  },
  episodeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  episodeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0369A1',
  },
  episodeSubtitle: {
    fontSize: 11,
    color: '#475569',
  },
  bold: {
    fontWeight: '700',
    color: '#0F172A',
  },
  newEpisodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E0F2FE',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#7DD3FC',
  },
  newEpisodeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369A1',
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  filterChipActive: {
    backgroundColor: '#E0F2FE',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#0284C7',
    fontWeight: '700',
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
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
  },
  scrollList: {
    padding: 16,
    paddingBottom: 30,
  },
  historyCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    elevation: 2,
  },
  cardColorBar: {
    width: 6,
  },
  cardMain: {
    flex: 1,
    padding: 14,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 6,
  },
  tpPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  tpPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0B3D91',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  scoreBadge: {
    marginLeft: 'auto',
  },
  scoreBadgeText: {
    fontSize: 15,
    fontWeight: '900',
  },
  timingDetailBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
    gap: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  timingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  timingLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  timingValue: {
    fontSize: 11,
    color: '#0F172A',
    fontWeight: '600',
  },
  elapsedHighlight: {
    color: '#0284C7',
    fontWeight: '800',
  },
  timingLabelMuted: {
    fontSize: 10,
    color: '#94A3B8',
  },
  timingValueMuted: {
    fontSize: 10,
    color: '#94A3B8',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  cardIndexBadge: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  cardIndexText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  contextBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  badgeRest: {
    backgroundColor: '#E0F2FE',
  },
  badgeMove: {
    backgroundColor: '#FEF3C7',
  },
  contextText: {
    fontSize: 11,
    fontWeight: '700',
  },
  textRest: {
    color: '#0284C7',
  },
  textMove: {
    color: '#D97706',
  },
  levelBadgeTag: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    marginLeft: 'auto',
  },
  cardScoreLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  activityInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  activityInfoName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  activityInfoTiming: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    padding: 8,
    borderRadius: 8,
    marginVertical: 4,
  },
  reasonText: {
    fontSize: 12,
    color: '#B45309',
    fontWeight: '500',
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
    fontSize: 11,
    color: '#94A3B8',
  },
  cardRecordIdText: {
    fontSize: 10,
    color: '#94A3B8',
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
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
