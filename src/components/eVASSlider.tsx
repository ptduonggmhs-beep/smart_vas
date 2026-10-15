import React, { useRef, useState } from 'react';
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

interface EVASSliderProps {
  value: number; // 0 to 100
  onChange: (value: number) => void;
  onSlidingStart?: () => void;
  onSlidingComplete?: () => void;
  disabled?: boolean;
}

export const EVASSlider: React.FC<EVASSliderProps> = ({
  value,
  onChange,
  onSlidingStart,
  onSlidingComplete,
  disabled = false,
}) => {
  const [trackWidth, setTrackWidth] = useState<number>(0);
  const [isInteracting, setIsInteracting] = useState<boolean>(false);
  
  // Track start position and initial value during drag
  const startValueRef = useRef<number>(value);
  const trackWidthRef = useRef<number>(0);

  // Update track width
  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) {
      setTrackWidth(w);
      trackWidthRef.current = w;
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onStartShouldSetPanResponderCapture: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponderCapture: () => !disabled,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,

      onPanResponderGrant: (evt: GestureResponderEvent) => {
        if (disabled || trackWidthRef.current <= 0) return;
        setIsInteracting(true);
        onSlidingStart?.();

        const currentWidth = trackWidthRef.current;
        const locationX = evt.nativeEvent.locationX;

        // If user tapped directly on track, move thumb there
        const tappedScore = Math.max(0, Math.min(100, (locationX / currentWidth) * 100));
        const rounded = Math.round(tappedScore * 10) / 10;
        
        startValueRef.current = rounded;
        onChange(rounded);
      },

      onPanResponderMove: (_evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        if (disabled || trackWidthRef.current <= 0) return;

        const currentWidth = trackWidthRef.current;
        const deltaScore = (gestureState.dx / currentWidth) * 100;
        const newScore = Math.max(0, Math.min(100, startValueRef.current + deltaScore));
        const rounded = Math.round(newScore * 10) / 10;

        onChange(rounded);
      },

      onPanResponderRelease: () => {
        setIsInteracting(false);
        onSlidingComplete?.();
      },

      onPanResponderTerminate: () => {
        setIsInteracting(false);
        onSlidingComplete?.();
      },
    })
  ).current;

  const clampedValue = Math.max(0, Math.min(100, value));
  const progressPercent = clampedValue / 100;

  // Dynamic theme color based on score level
  const getScoreTheme = (score: number) => {
    if (score === 0) return { color: '#10B981', label: 'Không đau' };
    if (score < 30) return { color: '#059669', label: 'Đau nhẹ' };
    if (score < 70) return { color: '#D97706', label: 'Đau vừa' };
    return { color: '#DC2626', label: 'Đau dữ dội' };
  };

  const currentTheme = getScoreTheme(clampedValue);

  // Position of thumb center
  const thumbSize = isInteracting ? 44 : 36;
  const thumbLeft = trackWidth > 0 
    ? Math.max(0, Math.min(trackWidth - thumbSize, (trackWidth * progressPercent) - (thumbSize / 2)))
    : 0;

  return (
    <View style={styles.container}>
      {/* Main Touch & Gesture Area (Chuẩn eVAS: Thuần thị giác, không hiển thị số để tránh sai lệch) */}
      <View
        style={styles.touchArea}
        onLayout={handleLayout}
        {...panResponder.panHandlers}
      >
        {/* Inactive Track Background (100mm scale) */}
        <View style={styles.trackBackground}>
          {/* Active Colored Progress Track */}
          <View
            style={[
              styles.trackActive,
              {
                width: `${progressPercent * 100}%`,
                backgroundColor: currentTheme.color,
              },
            ]}
          />
        </View>

        {/* Continuous Thumb Indicator (Dấu chỉ liên tục) */}
        {trackWidth > 0 && (
          <View
            pointerEvents="none"
            style={[
              styles.thumb,
              {
                width: thumbSize,
                height: thumbSize,
                borderRadius: thumbSize / 2,
                top: (80 - thumbSize) / 2,
                left: thumbLeft,
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
        )}
      </View>

      {/* Two Anchor Labels (Chuẩn lâm sàng eVAS: Chỉ hiển thị nhãn chữ hai đầu, không hiển thị số) */}
      <View style={styles.labelsRow}>
        <View style={styles.labelColLeft}>
          <View style={[styles.endpointDot, { backgroundColor: '#10B981' }]} />
          <Text style={styles.labelTitle}>Không đau</Text>
        </View>

        <View style={styles.labelColRight}>
          <View style={[styles.endpointDot, { backgroundColor: '#EF4444' }]} />
          <Text style={[styles.labelTitle, styles.labelRight]}>Đau dữ dội nhất</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 10,
  },
  touchArea: {
    height: 80,
    justifyContent: 'center',
    position: 'relative',
    marginHorizontal: 16,
    backgroundColor: 'transparent',
    cursor: Platform.OS === 'web' ? 'pointer' : undefined,
  },
  trackBackground: {
    height: 18,
    backgroundColor: '#E2E8F0',
    borderRadius: 9,
    overflow: 'hidden',
    position: 'relative',
  },
  trackActive: {
    height: '100%',
    borderRadius: 9,
  },
  thumb: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    borderWidth: 3.5,
    borderColor: '#FFFFFF',
    zIndex: 99,
  },
  thumbInteracting: {
    transform: [{ scale: 1.15 }],
    elevation: 14,
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
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingHorizontal: 16,
  },
  labelColLeft: {
    alignItems: 'flex-start',
  },
  labelColRight: {
    alignItems: 'flex-end',
  },
  endpointDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 4,
  },
  labelTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  labelRight: {
    textAlign: 'right',
  },
});
