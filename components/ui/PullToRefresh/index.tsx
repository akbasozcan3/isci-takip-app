/**
 * Pull to Refresh Component
 * Premium pull-to-refresh with smooth animations
 */

import React from 'react';
import { ActivityIndicator, Animated, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';

interface PullToRefreshProps {
  refreshing: boolean;
  onRefresh: () => void;
  children: React.ReactNode;
  threshold?: number;
  style?: any;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  refreshing,
  onRefresh,
  children,
  threshold = 80,
  style,
}) => {
  const theme = useTheme();
  const scrollY = React.useRef(new Animated.Value(0)).current;
  const [isPulling, setIsPulling] = React.useState(false);
  const [canRefresh, setCanRefresh] = React.useState(false);

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: false }
  );

  React.useEffect(() => {
    const listener = scrollY.addListener(({ value }) => {
      if (value < 0) {
        setIsPulling(true);
        if (Math.abs(value) >= threshold) {
          setCanRefresh(true);
        } else {
          setCanRefresh(false);
        }
      } else {
        setIsPulling(false);
        setCanRefresh(false);
      }
    });

    return () => {
      scrollY.removeListener(listener);
    };
  }, [scrollY, threshold]);

  const opacity = scrollY.interpolate({
    inputRange: [-threshold, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const scale = scrollY.interpolate({
    inputRange: [-threshold, 0],
    outputRange: [1, 0.5],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.container, style]}>
      {isPulling && (
        <Animated.View
          style={[
            styles.refreshIndicator,
            {
              opacity,
              transform: [{ scale }],
            },
          ]}
        >
          <ActivityIndicator
            size="large"
            color={theme.colors.primary}
          />
        </Animated.View>
      )}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  refreshIndicator: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
});

export default PullToRefresh;

