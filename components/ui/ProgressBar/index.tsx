/**
 * Progress Bar Component
 * Animated progress indicator
 */

import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';

interface ProgressBarProps {
  progress: number; // 0-100
  height?: number;
  color?: string;
  backgroundColor?: string;
  animated?: boolean;
  style?: any;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  height = 8,
  color,
  backgroundColor,
  animated = true,
  style,
}) => {
  const theme = useTheme();
  const progressAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (animated) {
      Animated.timing(progressAnim, {
        toValue: Math.min(Math.max(progress, 0), 100),
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
      progressAnim.setValue(Math.min(Math.max(progress, 0), 100));
    }
  }, [progress, animated, progressAnim]);

  const width = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View
      style={[
        styles.container,
        {
          height,
          backgroundColor: backgroundColor || theme.colors.surface.elevated,
          borderRadius: height / 2,
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.progress,
          {
            width,
            height,
            backgroundColor: color || theme.colors.primary.main,
            borderRadius: height / 2,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    width: '100%',
  },
  progress: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});

export default ProgressBar;

