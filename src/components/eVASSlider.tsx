import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  Platform,
} from 'react-native';
import { getCalibratedVASHeight, getStoredCalibrationFactor, VAS_CLINICAL_LENGTH_MM } from '../utils/physicalScale';

interface EVASSliderProps {
  value: number; // 0 đến 100
  onChange: (value: number) => void;
  onSlidingStart?: () => void;
  onSlidingComplete?: () => void;
  disabled?: boolean;
  calibrationFactor?: number;
  showRulerTicks?: boolean; // Tùy chọn hiển thị vạch mm/cm kiểm chuẩn
  showScore?: boolean; // Hiển thị điểm (dành cho chế độ kiểm thử / NCV)
}

// Factory tạo PanResponder độc lập với render cycle
const createVASPanResponder = (
  getProps: () => {
    disabled: boolean;
    trackHeight: number;
    startValue: number;
    setStartValue: (val: number) => void;
    setIsInteracting: (val: boolean) => void;
    onSlidingStart?: () => void;
    onSlidingComplete?: () => void;
    onChange: (val: number) => void;
  }
) =>
  PanResponder.create({
    onStartShouldSetPanResponder: () => !getProps().disabled,
    onStartShouldSetPanResponderCapture: () => !getProps().disabled,
    onMoveShouldSetPanResponder: () => !getProps().disabled,
    onMoveShouldSetPanResponderCapture: () => !getProps().disabled,
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,

    onPanResponderGrant: (evt: GestureResponderEvent) => {
      const { disabled, trackHeight, setStartValue, setIsInteracting, onSlidingStart, onChange } =
        getProps();
      if (disabled || trackHeight <= 0) return;

      setIsInteracting(true);
      onSlidingStart?.();

      const locationY = evt.nativeEvent.locationY;
      const boundedY = Math.max(0, Math.min(trackHeight, locationY));
      const tappedScore = Math.max(0, Math.min(100, (1 - boundedY / trackHeight) * 100));
      const rounded = Math.round(tappedScore * 10) / 10;

      setStartValue(rounded);
      onChange(rounded);
    },

    onPanResponderMove: (_evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
      const { disabled, trackHeight, startValue, onChange } = getProps();
      if (disabled || trackHeight <= 0) return;

      const deltaScore = (-gestureState.dy / trackHeight) * 100;
      const newScore = Math.max(0, Math.min(100, startValue + deltaScore));
      const rounded = Math.round(newScore * 10) / 10;

      onChange(rounded);
    },

    onPanResponderRelease: () => {
      const { setIsInteracting, onSlidingComplete } = getProps();
      setIsInteracting(false);
      onSlidingComplete?.();
    },

    onPanResponderTerminate: () => {
      const { setIsInteracting, onSlidingComplete } = getProps();
      setIsInteracting(false);
      onSlidingComplete?.();
    },
  });

export const EVASSlider: React.FC<EVASSliderProps> = ({
  value,
  onChange,
  onSlidingStart,
  onSlidingComplete,
  disabled = false,
  calibrationFactor: propFactor,
  showRulerTicks = false,
  showScore = false,
}) => {
  const [storedFactor, setStoredFactor] = useState<number>(1.0);
  const [isInteracting, setIsInteracting] = useState<boolean>(false);

  // Load hệ số hiệu chuẩn nếu không truyền qua prop
  useEffect(() => {
    if (propFactor === undefined) {
      getStoredCalibrationFactor().then((f) => setStoredFactor(f));
    }
  }, [propFactor]);

  const calibrationFactor = propFactor !== undefined ? propFactor : storedFactor;

  // Chiều cao chuẩn 10cm (100mm) tính bằng pt/dp vật lý
  const trackHeight = getCalibratedVASHeight(calibrationFactor);

  const startValueRef = useRef<number>(value);
  const trackHeightRef = useRef<number>(trackHeight);
  const disabledRef = useRef<boolean>(disabled);
  const onChangeRef = useRef<(val: number) => void>(onChange);
  const onSlidingStartRef = useRef<(() => void) | undefined>(onSlidingStart);
  const onSlidingCompleteRef = useRef<(() => void) | undefined>(onSlidingComplete);

  useEffect(() => {
    trackHeightRef.current = trackHeight;
    disabledRef.current = disabled;
    onChangeRef.current = onChange;
    onSlidingStartRef.current = onSlidingStart;
    onSlidingCompleteRef.current = onSlidingComplete;
  }, [trackHeight, disabled, onChange, onSlidingStart, onSlidingComplete]);

  // Dynamic theme color theo mức độ đau
  const getScoreTheme = (score: number) => {
    if (score === 0) return { color: '#10B981', label: 'Không đau' };
    if (score < 30) return { color: '#059669', label: 'Đau nhẹ' };
    if (score < 70) return { color: '#D97706', label: 'Đau vừa' };
    return { color: '#DC2626', label: 'Đau dữ dội' };
  };

  const clampedValue = Math.max(0, Math.min(100, value));
  const progressPercent = clampedValue / 100;
  const currentTheme = getScoreTheme(clampedValue);

  // PanResponder cho thao tác chạm & vuốt dọc (Vertical)
  const panResponder = useRef(
    createVASPanResponder(() => ({
      disabled: disabledRef.current,
      trackHeight: trackHeightRef.current,
      startValue: startValueRef.current,
      setStartValue: (val) => {
        startValueRef.current = val;
      },
      setIsInteracting,
      onSlidingStart: () => onSlidingStartRef.current?.(),
      onSlidingComplete: () => onSlidingCompleteRef.current?.(),
      onChange: (val) => onChangeRef.current(val),
    }))
  ).current;

  // Kích thước nút trượt
  const thumbSize = isInteracting ? 46 : 38;
  // Tâm của thumb trùng khớp chính xác với vạch điểm:
  // Khi progress = 0 (đáy), center = trackHeight => top = trackHeight - thumbSize / 2
  // Khi progress = 1 (đỉnh), center = 0 => top = 0 - thumbSize / 2
  const thumbTop = (1 - progressPercent) * trackHeight - thumbSize / 2;
  const activeHeight = progressPercent * trackHeight;

  // Tạo các vạch mm / cm nếu bật chế độ kiểm chuẩn thước
  const renderRulerTicks = () => {
    if (!showRulerTicks) return null;
    const ticks = [];
    for (let cm = 0; cm <= 10; cm++) {
      const posFromTop = ((10 - cm) / 10) * trackHeight;
      const isMajor = cm === 0 || cm === 5 || cm === 10;
      ticks.push(
        <View
          key={`tick-${cm}`}
          style={[
            styles.tickMark,
            {
              top: posFromTop - 1,
              width: isMajor ? 14 : 8,
              backgroundColor: isMajor ? '#334155' : '#94A3B8',
            },
          ]}
        >
          {isMajor && (
            <Text style={styles.tickLabel}>
              {cm}
            </Text>
          )}
        </View>
      );
    }
    return <View style={styles.ticksContainer}>{ticks}</View>;
  };

  return (
    <View style={styles.wrapper}>
      {/* Cụm thang đo hướng dọc chuẩn 10cm */}
      <View style={styles.scaleContainer}>
        {/* Cột nhãn bên trái / đỉnh & đáy */}
        <View style={[styles.sideLabelsColumn, { height: trackHeight }]}>
          {/* Nhãn đỉnh: Đau dữ dội nhất */}
          <View style={styles.topLabelAnchor}>
            <View style={[styles.anchorIndicator, { backgroundColor: '#DC2626' }]} />
            <View>
              <Text style={styles.anchorTitleDanger}>Đau dữ dội nhất</Text>
              <Text style={styles.anchorSubtitle}>(Không thể chịu nổi)</Text>
            </View>
          </View>

          {/* Vùng giữa: Chỉ báo thước chuẩn lâm sàng 10cm */}
          <View style={styles.middleInfoContainer}>
            <View style={styles.lengthBadge}>
              <Text style={styles.lengthBadgeText}>{VAS_CLINICAL_LENGTH_MM} mm</Text>
              <Text style={styles.lengthBadgeSub}>(Đúng 10,0 cm)</Text>
            </View>
            {showScore && (
              <View style={[styles.scoreBadge, { borderColor: currentTheme.color }]}>
                <Text style={[styles.scoreText, { color: currentTheme.color }]}>
                  {clampedValue.toFixed(1)}
                </Text>
              </View>
            )}
          </View>

          {/* Nhãn đáy: Không đau */}
          <View style={styles.bottomLabelAnchor}>
            <View style={[styles.anchorIndicator, { backgroundColor: '#10B981' }]} />
            <View>
              <Text style={styles.anchorTitleSafe}>Không đau</Text>
              <Text style={styles.anchorSubtitle}>(Hoàn toàn thoải mái)</Text>
            </View>
          </View>
        </View>

        {/* Cột Thước đo Dọc (Chứa đúng 10cm chiều cao vật lý) */}
        <View style={styles.sliderColumn}>
          {/* Vạch chặn ngang Đỉnh (100mm) chuẩn y văn */}
          <View style={styles.stopperBarTop} />

          {/* Vùng cảm ứng trượt dọc đúng chiều cao 10cm */}
          <View
            style={[
              styles.touchArea,
              {
                height: trackHeight,
              },
            ]}
            {...panResponder.panHandlers}
          >
            {/* Vạch thước kiểm chuẩn nếu bật */}
            {renderRulerTicks()}

            {/* Trục thanh đo nền rỗng (100mm) */}
            <View style={styles.trackBackground}>
              {/* Phần đo tích cực đổi màu từ đáy lên */}
              <View
                style={[
                  styles.trackActive,
                  {
                    height: activeHeight,
                    backgroundColor: currentTheme.color,
                  },
                ]}
              />
            </View>

            {/* Nút trượt (Thumb) chỉ báo vị trí mức đau */}
            <View
              pointerEvents="none"
              style={[
                styles.thumb,
                {
                  width: thumbSize,
                  height: thumbSize,
                  borderRadius: thumbSize / 2,
                  top: thumbTop,
                  backgroundColor: currentTheme.color,
                },
                isInteracting && styles.thumbInteracting,
              ]}
            >
              <View style={styles.thumbInner} />
              <View
                style={[
                  styles.thumbRipple,
                  { borderColor: `${currentTheme.color}40` },
                  isInteracting && { borderColor: `${currentTheme.color}80` },
                ]}
              />
            </View>
          </View>

          {/* Vạch chặn ngang Đáy (0mm) chuẩn y văn */}
          <View style={styles.stopperBarBottom} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  scaleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  sideLabelsColumn: {
    justifyContent: 'space-between',
    paddingRight: 16,
    width: 175,
  },
  topLabelAnchor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    transform: [{ translateY: -10 }],
  },
  bottomLabelAnchor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    transform: [{ translateY: 10 }],
  },
  anchorIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  anchorTitleDanger: {
    fontSize: 15,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: -0.2,
  },
  anchorTitleSafe: {
    fontSize: 15,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: -0.2,
  },
  anchorSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  middleInfoContainer: {
    alignItems: 'flex-start',
    paddingLeft: 4,
    gap: 8,
  },
  lengthBadge: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  lengthBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0284C7',
  },
  lengthBadgeSub: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500',
  },
  scoreBadge: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  scoreText: {
    fontSize: 14,
    fontWeight: '800',
  },
  sliderColumn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopperBarTop: {
    width: 38,
    height: 3.5,
    backgroundColor: '#DC2626',
    borderRadius: 2,
  },
  stopperBarBottom: {
    width: 38,
    height: 3.5,
    backgroundColor: '#10B981',
    borderRadius: 2,
  },
  touchArea: {
    width: 76,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: 'transparent',
    cursor: Platform.OS === 'web' ? 'pointer' : undefined,
  },
  trackBackground: {
    width: 14,
    height: '100%',
    backgroundColor: '#E2E8F0',
    borderRadius: 7,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'flex-end',
  },
  trackActive: {
    width: '100%',
    borderRadius: 7,
  },
  thumb: {
    position: 'absolute',
    left: (76 - 38) / 2, // Căn giữa track
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    borderWidth: 3.5,
    borderColor: '#FFFFFF',
    zIndex: 99,
  },
  thumbInteracting: {
    left: (76 - 46) / 2,
    transform: [{ scale: 1.1 }],
    elevation: 12,
    shadowOpacity: 0.5,
  },
  thumbInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
  },
  thumbRipple: {
    position: 'absolute',
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
  },
  ticksContainer: {
    position: 'absolute',
    left: 2,
    top: 0,
    bottom: 0,
    width: 24,
  },
  tickMark: {
    position: 'absolute',
    left: 0,
    height: 1.5,
    borderRadius: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tickLabel: {
    position: 'absolute',
    left: -14,
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
  },
});
