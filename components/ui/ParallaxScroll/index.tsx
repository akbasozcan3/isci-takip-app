/**
 * Parallax Scroll Component
 * Premium parallax scrolling effect
 */

import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';

interface ParallaxScrollProps {
  children: React.ReactNode;
  headerHeight?: number;
  headerContent?: React.ReactNode;
  parallaxSpeed?: number;
  style?: any;
}

export const ParallaxScroll: React.FC<ParallaxScrollProps> = ({
  children,
  headerHeight = 200,
  headerContent,
  parallaxSpeed = 0.5,
  style,
}) => {
  const scrollY = React.useRef(new Animated.Value(0)).current;

  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, headerHeight],
    outputRange: [0, -headerHeight],
    extrapolate: 'clamp',
  });

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, headerHeight * 0.5, headerHeight],
    outputRange: [1, 0.5, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.container, style]}>
      <Animated.View
        style={[
          styles.header,
          {
            height: headerHeight,
            transform: [{ translateY: headerTranslateY }],
            opacity: headerOpacity,
          },
        ]}
      >
        {headerContent}
      </Animated.View>
      
      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingTop: headerHeight }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        {children}
      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  scrollView: {
    flex: 1,
  },
});

export default ParallaxScroll;

