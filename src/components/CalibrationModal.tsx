import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getCalibratedVASHeight,
  getStoredCalibrationFactor,
  saveCalibrationFactor,
  resetCalibrationFactor,
  getDisplayDiagnostics,
  VAS_CLINICAL_LENGTH_MM,
  REFERENCE_CARD_LENGTH_MM,
  mmToPixels,
} from '../utils/physicalScale';

interface CalibrationModalProps {
  visible: boolean;
  onClose: () => void;
  onCalibrationSaved?: (factor: number) => void;
}

export const CalibrationModal: React.FC<CalibrationModalProps> = ({
  visible,
  onClose,
  onCalibrationSaved,
}) => {
  const [factor, setFactor] = useState<number>(1.0);
  const [diagnostics, setDiagnostics] = useState<any>(null);

  useEffect(() => {
    if (visible) {
      getStoredCalibrationFactor().then((f) => {
        setFactor(f);
        setDiagnostics(getDisplayDiagnostics(f));
      });
    }
  }, [visible]);

  const handleAdjustMm = (deltaMm: number) => {
    // 100mm tương ứng factor 1.0 => deltaMm làm thay đổi factor tương ứng deltaMm / 100
    const deltaFactor = deltaMm / VAS_CLINICAL_LENGTH_MM;
    const newFactor = Math.round((factor + deltaFactor) * 1000) / 1000;
    const clamped = Math.max(0.7, Math.min(1.3, newFactor));
    setFactor(clamped);
    setDiagnostics(getDisplayDiagnostics(clamped));
  };

  const handleSave = async () => {
    await saveCalibrationFactor(factor);
    onCalibrationSaved?.(factor);
    Alert.alert(
      '✅ Đã lưu hiệu chuẩn',
      `Thước đo VAS 10cm đã được hiệu chuẩn thành công với hệ số ${(factor * 100).toFixed(1)}% trên thiết bị này.`
    );
    onClose();
  };

  const handleReset = async () => {
    await resetCalibrationFactor();
    setFactor(1.0);
    setDiagnostics(getDisplayDiagnostics(1.0));
    onCalibrationSaved?.(1.0);
    Alert.alert('Đã khôi phục', 'Thước đo đã trở về thông số chuẩn tự động của nhà sản xuất.');
  };

  const vasHeightPx = getCalibratedVASHeight(factor);
  const cardHeightPx = mmToPixels(REFERENCE_CARD_LENGTH_MM, factor);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Modal Top Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#0F172A" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Kiểm tra & Hiệu chuẩn 10cm</Text>
            <Text style={styles.headerSubtitle}>Chuẩn Thước Đo Lâm Sàng eVAS (100 mm)</Text>
          </View>
          <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
            <Text style={styles.saveBtnText}>Lưu</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
          {/* Card: Hướng dẫn đo thực tế */}
          <View style={styles.guideCard}>
            <View style={styles.guideIconRow}>
              <Ionicons name="shield-checkmark" size={22} color="#0284C7" />
              <Text style={styles.guideTitle}>Quy chuẩn nghiên cứu y khoa</Text>
            </View>
            <Text style={styles.guideText}>
              Theo y văn quốc tế, thang đo VAS có chiều dài đoạn thẳng chính xác <Text style={styles.boldText}>10,0 cm (100 mm)</Text>.
              Hệ thống đã tự động tính toán theo phần cứng màn hình ({diagnostics?.os?.toUpperCase()} • {diagnostics?.calculatedHeight100mm} pt/dp).
            </Text>
            <View style={styles.guideStepBox}>
              <Text style={styles.guideStepText}>
                👉 <Text style={styles.boldText}>Cách kiểm tra:</Text> Đặt một chiếc thước kẻ milimet cơ học áp sát vào đoạn thẳng màu đỏ bên dưới.
                Khoảng cách giữa <Text style={styles.boldText}>Vạch 0</Text> và <Text style={styles.boldText}>Vạch 100</Text> phải đạt đúng <Text style={styles.boldText}>10,0 cm</Text>.
              </Text>
            </View>
          </View>

          {/* Card: Bộ điều chỉnh tinh chỉnh kích thước */}
          <View style={styles.adjustCard}>
            <Text style={styles.adjustTitle}>Tinh chỉnh chiều dài vật lý</Text>
            <Text style={styles.adjustSub}>
              Nếu màn hình có dán kính cường lực hoặc sai lệch phần cứng, hãy dùng nút bên dưới:
            </Text>

            <View style={styles.adjustControlsRow}>
              <TouchableOpacity
                style={styles.adjustBtn}
                onPress={() => handleAdjustMm(-0.5)}
              >
                <Ionicons name="remove-circle-outline" size={20} color="#DC2626" />
                <Text style={styles.adjustBtnText}>- 0.5 mm</Text>
              </TouchableOpacity>

              <View style={styles.factorDisplay}>
                <Text style={styles.factorValue}>
                  {(VAS_CLINICAL_LENGTH_MM * factor).toFixed(1)} mm
                </Text>
                <Text style={styles.factorSub}>
                  ({vasHeightPx} pt • {(factor * 100).toFixed(1)}%)
                </Text>
              </View>

              <TouchableOpacity
                style={styles.adjustBtn}
                onPress={() => handleAdjustMm(0.5)}
              >
                <Ionicons name="add-circle-outline" size={20} color="#10B981" />
                <Text style={styles.adjustBtnText}>+ 0.5 mm</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.secondaryControlsRow}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => handleAdjustMm(-1.0)}
              >
                <Text style={styles.secondaryBtnText}>- 1 mm</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryBtn, styles.resetBtn]}
                onPress={handleReset}
              >
                <Ionicons name="refresh" size={14} color="#64748B" />
                <Text style={styles.resetBtnText}>Mặc định (100mm)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => handleAdjustMm(1.0)}
              >
                <Text style={styles.secondaryBtnText}>+ 1 mm</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* VÙNG THƯỚC ĐỐI CHIẾU 1:1 ĐÚNG 10,0 CM TRÊN MÀN HÌNH */}
          <View style={styles.rulerContainerCard}>
            <View style={styles.rulerCardHeader}>
              <Ionicons name="color-wand-outline" size={18} color="#0284C7" />
              <Text style={styles.rulerCardTitle}>Thước hiển thị 1:1 thực tế (10 cm)</Text>
            </View>

            <View style={styles.rulerVisualArea}>
              {/* Thước Milimet trực quan */}
              <View style={[styles.virtualRuler, { height: vasHeightPx }]}>
                {Array.from({ length: 11 }).map((_, cm) => {
                  const top = ((10 - cm) / 10) * vasHeightPx;
                  const isMajor = cm === 0 || cm === 5 || cm === 10;
                  return (
                    <View
                      key={`cm-${cm}`}
                      style={[
                        styles.rulerTickRow,
                        { top: top - 1 },
                      ]}
                    >
                      <View
                        style={[
                          styles.rulerTickLine,
                          {
                            width: isMajor ? 24 : 14,
                            backgroundColor: isMajor ? '#0F172A' : '#64748B',
                            height: isMajor ? 2.5 : 1.5,
                          },
                        ]}
                      />
                      <Text
                        style={[
                          styles.rulerTickNumber,
                          isMajor && styles.rulerTickNumberMajor,
                        ]}
                      >
                        {cm} cm ({cm * 10} mm)
                      </Text>
                    </View>
                  );
                })}
              </View>

              {/* Thanh VAS chuẩn đỏ */}
              <View style={styles.vasBarColumn}>
                <View style={styles.stopperBarTop} />
                <View style={[styles.vasBar, { height: vasHeightPx }]} />
                <View style={styles.stopperBarBottom} />
              </View>

              {/* Chỉ báo thẻ CCCD / ATM (85.6 mm) đối chiếu nhanh */}
              <View style={styles.cardRefColumn}>
                <View style={[styles.cardRefBox, { height: cardHeightPx }]}>
                  <Ionicons name="card-outline" size={18} color="#0284C7" />
                  <Text style={styles.cardRefTitle}>Thẻ CCCD / ATM</Text>
                  <Text style={styles.cardRefMm}>85.6 mm</Text>
                  <Text style={styles.cardRefSub}>(Chuẩn ISO 7810)</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Card: Thông số chẩn đoán phần cứng */}
          {diagnostics && (
            <View style={styles.diagCard}>
              <Text style={styles.diagTitle}>Thông số phần cứng thiết bị</Text>
              <View style={styles.diagRow}>
                <Text style={styles.diagLabel}>Hệ điều hành:</Text>
                <Text style={styles.diagValue}>{diagnostics.os.toUpperCase()}</Text>
              </View>
              <View style={styles.diagRow}>
                <Text style={styles.diagLabel}>Kích thước màn hình:</Text>
                <Text style={styles.diagValue}>
                  {diagnostics.screenWidth} × {diagnostics.screenHeight} pt/dp
                </Text>
              </View>
              <View style={styles.diagRow}>
                <Text style={styles.diagLabel}>Tỷ lệ Pixel Ratio:</Text>
                <Text style={styles.diagValue}>{diagnostics.pixelRatio}x</Text>
              </View>
              <View style={styles.diagRow}>
                <Text style={styles.diagLabel}>Mật độ quy đổi:</Text>
                <Text style={styles.diagValue}>{diagnostics.basePointsPerMm} pt/mm</Text>
              </View>
              <View style={styles.diagRow}>
                <Text style={styles.diagLabel}>Chiều cao tính toán 100mm:</Text>
                <Text style={styles.diagValue}>
                  {diagnostics.calculatedHeight100mm} pt/dp
                </Text>
              </View>
              <View style={styles.diagRow}>
                <Text style={styles.diagLabel}>Chiều cao sau hiệu chuẩn:</Text>
                <Text style={[styles.diagValue, { color: '#0284C7', fontWeight: '800' }]}>
                  {diagnostics.finalCalibratedHeight} pt/dp
                </Text>
              </View>
            </View>
          )}

          {/* Bottom Action Save */}
          <View style={styles.bottomActions}>
            <TouchableOpacity style={styles.mainSaveBtn} onPress={handleSave}>
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={styles.mainSaveBtnText}>Lưu & Áp dụng cho toàn bộ Thang VAS</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 48 : 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  closeBtn: {
    padding: 8,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  saveBtn: {
    backgroundColor: '#0284C7',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  guideCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  guideIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  guideTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  guideText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
  },
  boldText: {
    fontWeight: '700',
    color: '#0F172A',
  },
  guideStepBox: {
    marginTop: 10,
    backgroundColor: '#F0F9FF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  guideStepText: {
    fontSize: 13,
    color: '#0369A1',
    lineHeight: 19,
  },
  adjustCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  adjustTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  adjustSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 14,
  },
  adjustControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  adjustBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  adjustBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  factorDisplay: {
    alignItems: 'center',
  },
  factorValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0284C7',
  },
  factorSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  secondaryControlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  secondaryBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  secondaryBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  resetBtn: {
    flex: 2,
    flexDirection: 'row',
    gap: 4,
    backgroundColor: '#F1F5F9',
  },
  resetBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  rulerContainerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    alignItems: 'center',
  },
  rulerCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  rulerCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  rulerVisualArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 10,
  },
  virtualRuler: {
    position: 'relative',
    width: 140,
    borderRightWidth: 1.5,
    borderRightColor: '#CBD5E1',
  },
  rulerTickRow: {
    position: 'absolute',
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rulerTickLine: {
    borderRadius: 1,
  },
  rulerTickNumber: {
    fontSize: 10,
    color: '#64748B',
    marginLeft: 6,
  },
  rulerTickNumberMajor: {
    fontWeight: '800',
    color: '#0F172A',
    fontSize: 11,
  },
  vasBarColumn: {
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  stopperBarTop: {
    width: 34,
    height: 3.5,
    backgroundColor: '#DC2626',
    borderRadius: 2,
  },
  stopperBarBottom: {
    width: 34,
    height: 3.5,
    backgroundColor: '#10B981',
    borderRadius: 2,
  },
  vasBar: {
    width: 14,
    backgroundColor: '#DC2626',
    borderRadius: 7,
  },
  cardRefColumn: {
    width: 100,
    alignItems: 'center',
  },
  cardRefBox: {
    width: 90,
    backgroundColor: '#F0F9FF',
    borderWidth: 1.5,
    borderColor: '#0284C7',
    borderStyle: 'dashed',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  cardRefTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0369A1',
    marginTop: 4,
    textAlign: 'center',
  },
  cardRefMm: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0284C7',
    marginTop: 2,
  },
  cardRefSub: {
    fontSize: 8,
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
  },
  diagCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  diagTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  diagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  diagLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  diagValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
  bottomActions: {
    marginTop: 8,
  },
  mainSaveBtn: {
    backgroundColor: '#0284C7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    elevation: 3,
  },
  mainSaveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
