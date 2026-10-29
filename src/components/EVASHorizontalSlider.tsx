import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  LayoutChangeEvent,
  Platform,
} from 'react-native';

interface EVASHorizontalSliderProps {
  value: number; // 0.0 đến 100.0 mm
  onChange: (value: number) => void;
  onSlidingStart?: () => void;
  onSlidingComplete?: () => void;
  disabled?: boolean;
  anchorLeftLabel?: string; // Mặc định: "Không đau"
  anchorRightLabel?: string; // Mặc định: "Đau dữ dội nhất có thể tưởng tượng"
  showScore?: boolean; // Chỉ bật khi NCV/Admin kiểm tra, mặc định false để giữ chuẩn VAS
}

export const EVASHorizontalSlider: React.FC<EVASHorizontalSliderProps> = ({
  value,
  onChange,
  onSlidingStart,
  onSlidingComplete,
  disabled = false,
  anchorLeftLabel = 'Không đau',
  anchorRightLabel = 'Đau dữ dội nhất có thể tưởng tượng',
  showScore = false,
}) => {
  const [trackWidth, setTrackWidth] = useState<number>(0);
  const [isInteracting, setIsInteracting] = useState<boolean>(false);

  const disabledRef = useRef<boolean>(disabled);
  const trackWidthRef = useRef<number>(trackWidth);
  const valueRef = useRef<number>(value);
  const onChangeRef = useRef<(v: number) => void>(onChange);
  const onSlidingStartRef = useRef<(() => void) | undefined>(onSlidingStart);
  const onSlidingCompleteRef = useRef<(() => void) | undefined>(onSlidingComplete);

  useEffect(() => {
    disabledRef.current = disabled;
    trackWidthRef.current = trackWidth;
    valueRef.current = value;
    onChangeRef.current = onChange;
    onSlidingStartRef.current = onSlidingStart;
    onSlidingCompleteRef.current = onSlidingComplete;
  }, [disabled, trackWidth, value, onChange, onSlidingStart, onSlidingComplete]);

  const calculateScoreFromX = useCallback((touchX: number): number => {
    const width = trackWidthRef.current;
    if (width <= 0) return 0;
    const boundedX = Math.max(0, Math.min(width, touchX));
    // Tỷ lệ 0.0 đến 100.0 mm
    const rawScore = (boundedX / width) * 100.0;
    // Quy tắc làm tròn rõ ràng: 0.1 mm
    return Math.round(rawScore * 10) / 10;
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabledRef.current,
      onStartShouldSetPanResponderCapture: () => !disabledRef.current,
      onMoveShouldSetPanResponder: () => !disabledRef.current,
      onMoveShouldSetPanResponderCapture: () => !disabledRef.current,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,

      onPanResponderGrant: (evt: GestureResponderEvent) => {
        if (disabledRef.current || trackWidthRef.current <= 0) return;
        setIsInteracting(true);
        onSlidingStartRef.current?.();

        const locationX = evt.nativeEvent.locationX;
        const newScore = calculateScoreFromX(locationX);
        onChangeRef.current(newScore);
      },

      onPanResponderMove: (evt: GestureResponderEvent, _gestureState: PanResponderGestureState) => {
        if (disabledRef.current || trackWidthRef.current <= 0) return;
        const locationX = evt.nativeEvent.locationX;
        const newScore = calculateScoreFromX(locationX);
        onChangeRef.current(newScore);
      },

      onPanResponderRelease: () => {
        setIsInteracting(false);
        onSlidingCompleteRef.current?.();
      },

      onPanResponderTerminate: () => {
        setIsInteracting(false);
        onSlidingCompleteRef.current?.();
      },
    })
  ).current;

  const handleTrackLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    if (width > 0) {
      setTrackWidth(width);
    }
  };

  const clampedValue = Math.max(0, Math.min(100, value));
  const progressRatio = clampedValue / 100.0;

  // Tính vị trí tâm con trượt
  const thumbSize = isInteracting ? 42 : 36;
  const thumbLeft = trackWidth > 0 ? progressRatio * trackWidth - thumbSize / 2 : 0;
  const activeWidth = trackWidth > 0 ? progressRatio * trackWidth : 0;

  // Màu sắc đổi tinh tế theo mức độ (0 - <4: Đau nhẹ, >=4 - <7: Đau vừa, >=7: Đau nặng)
  const getThemeColor = (s: number) => {
    if (s < 40) return '#059669'; // Xanh lá dịu (Đau nhẹ)
    if (s < 70) return '#D97706'; // Vàng cam (Đau vừa)
    return '#DC2626'; // Đỏ (Đau nặng)
  };

  const currentColor = getThemeColor(clampedValue);

  return (
    <View style={styles.wrapper}>
      {/* Thông tin hỗ trợ dành cho NCV/Admin nếu được bật */}
      {showScore && (
        <View style={styles.scoreRow}>
          <Text style={[styles.scoreNumberText, { color: currentColor }]}>
            {clampedValue.toFixed(1)} mm
          </Text>
        </View>
      )}

      {/* Cụm thanh đo ngang VAS 100mm liên tục */}
      <View style={styles.vasContainer}>
        {/* Vạch chặn đứng bên trái (0 mm) */}
        <View style={styles.stopperBarLeft} />

        {/* Vùng tương tác trượt ngang liên tục */}
        <View
          style={styles.touchArea}
          onLayout={handleTrackLayout}
          {...panResponder.panHandlers}
        >
          {/* Thanh rãnh nền trượt */}
          <View style={styles.trackBackground}>
            {/* Phần trượt tích cực màu sắc */}
            <View
              style={[
                styles.trackActive,
                {
                  width: activeWidth,
                  backgroundColor: currentColor,
                },
              ]}
            />
          </View>

          {/* Nút chỉ báo mức đau (Thumb) */}
          {trackWidth > 0 && (
            <View
              pointerEvents="none"
              style={[
                styles.thumb,
                {
                  width: thumbSize,
                  height: thumbSize,
                  borderRadius: thumbSize / 2,
                  left: thumbLeft,
                  backgroundColor: currentColor,
                },
                isInteracting && styles.thumbActive,
              ]}
            >
              <View style={styles.thumbCenterDot} />
            </View>
          )}
        </View>

        {/* Vạch chặn đứng bên phải (100 mm) */}
        <View style={styles.stopperBarRight} />
      </View>

      {/* Hai đầu mút được mô tả bằng lời chuẩn y văn */}
      <View style={styles.anchorsRow}>
        <View style={styles.anchorLeftCol}>
          <Text style={styles.anchorLabelPrimaryLeft}>{anchorLeftLabel}</Text>
          <Text style={styles.anchorLabelSecondary}>(Hoàn toàn thoải mái)</Text>
        </View>

        <View style={styles.anchorRightCol}>
          <Text style={styles.anchorLabelPrimaryRight}>{anchorRightLabel}</Text>
          <Text style={styles.anchorLabelSecondary}>(Không thể chịu nổi)</Text>
        </View>
      </View>

      {/* Hướng dẫn lâm sàng: Tuyệt đối không hiển thị số 0-10 khi đang đo */}
      <View style={styles.clinicalHint}>
        <Text style={styles.clinicalHintText}>
          Chạm hoặc kéo dấu chỉ dọc theo đường thẳng đến vị trí mô tả đúng nhất cảm giác đau.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    paddingVertical: 12,
  },
  scoreRow: {
    alignItems: 'center',
    marginBottom: 8,
  },
  scoreNumberText: {
    fontSize: 16,
    fontWeight: '800',
  },
  vasContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 70,
    paddingHorizontal: 4,
  },
  stopperBarLeft: {
    width: 4,
    height: 48,
    backgroundColor: '#059669',
    borderRadius: 2,
  },
  stopperBarRight: {
    width: 4,
    height: 48,
    backgroundColor: '#DC2626',
    borderRadius: 2,
  },
  touchArea: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    position: 'relative',
    paddingHorizontal: 0,
    cursor: Platform.OS === 'web' ? 'pointer' : undefined,
  },
  trackBackground: {
    width: '100%',
    height: 12,
    backgroundColor: '#E2E8F0',
    borderRadius: 6,
    overflow: 'hidden',
  },
  trackActive: {
    height: '100%',
    borderRadius: 6,
  },
  thumb: {
    position: 'absolute',
    top: (70 - 36) / 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3.5,
    borderColor: '#FFFFFF',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    zIndex: 10,
  },
  thumbActive: {
    top: (70 - 42) / 2,
    transform: [{ scale: 1.1 }],
    elevation: 10,
    shadowOpacity: 0.45,
  },
  thumbCenterDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  anchorsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 2,
  },
  anchorLeftCol: {
    flex: 1,
    alignItems: 'flex-start',
    paddingRight: 10,
  },
  anchorRightCol: {
    flex: 1,
    alignItems: 'flex-end',
    paddingLeft: 10,
  },
  anchorLabelPrimaryLeft: {
    fontSize: 14,
    fontWeight: '800',
    color: '#059669',
    textAlign: 'left',
  },
  anchorLabelPrimaryRight: {
    fontSize: 14,
    fontWeight: '800',
    color: '#DC2626',
    textAlign: 'right',
  },
  anchorLabelSecondary: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  clinicalHint: {
    marginTop: 14,
    paddingHorizontal: 8,
  },
  clinicalHintText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    fontStyle: 'italic',
  },
});
