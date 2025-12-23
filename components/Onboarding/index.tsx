/**
 * Premium Onboarding Flow
 * World-class mobile onboarding with sophisticated animations and animated backgrounds
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Easing
} from 'react-native';
import { PremiumBackground } from '../PremiumBackground';

const { width, height } = Dimensions.get('window');

interface OnboardingSlide {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  backgroundColor: string;
  accentColor: string;
}

const slides: OnboardingSlide[] = [
  {
    icon: 'location',
    title: 'Gerçek Zamanlı Takip',
    description: 'Sevdiklerinizin ve ekibinizin konumunu anlık olarak takip edin',
    backgroundColor: '#1A56DB',
    accentColor: '#06B6D4',
  },
  {
    icon: 'people',
    title: 'Grup Yönetimi',
    description: 'Gruplar oluşturun ve üyelerinizi kolayca yönetin',
    backgroundColor: '#059669',
    accentColor: '#10B981',
  },
  {
    icon: 'notifications',
    title: 'Anlık Bildirimler',
    description: 'Önemli olaylardan anında haberdar olun',
    backgroundColor: '#7C3AED',
    accentColor: '#EC4899',
  },
  {
    icon: 'analytics',
    title: 'Detaylı Analitik',
    description: 'Hareketlerinizi analiz edin ve raporlar oluşturun',
    backgroundColor: '#4F46E5',
    accentColor: '#8B5CF6',
  },
];


interface SlideContentProps {
  slide: OnboardingSlide;
  isActive: boolean;
}

const SlideContent: React.FC<SlideContentProps> = ({ slide, isActive }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const iconRotateAnim = useRef(new Animated.Value(0)).current;
  const iconScaleAnim = useRef(new Animated.Value(0.3)).current;
  const titleSlideAnim = useRef(new Animated.Value(50)).current;
  const descSlideAnim = useRef(new Animated.Value(50)).current;
  const iconPulseAnim = useRef(new Animated.Value(1)).current;
  const ringScaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (isActive) {
      // Reset all animations
      fadeAnim.setValue(0);
      iconRotateAnim.setValue(0);
      iconScaleAnim.setValue(0.3);
      titleSlideAnim.setValue(50);
      descSlideAnim.setValue(50);
      ringScaleAnim.setValue(0.8);

      // Staggered entrance animations
      Animated.parallel([
        // Icon animations
        Animated.parallel([
          Animated.spring(iconScaleAnim, {
            toValue: 1,
            tension: 60,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.timing(iconRotateAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.out(Easing.back(1.2)),
            useNativeDriver: true,
          }),
        ]),
        // Ring animation
        Animated.spring(ringScaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          delay: 200,
          useNativeDriver: true,
        }),
        // Content fade
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          delay: 200,
          useNativeDriver: true,
        }),
        // Title slide in
        Animated.spring(titleSlideAnim, {
          toValue: 0,
          tension: 50,
          friction: 8,
          delay: 300,
          useNativeDriver: true,
        }),
        // Description slide in
        Animated.spring(descSlideAnim, {
          toValue: 0,
          tension: 50,
          friction: 8,
          delay: 450,
          useNativeDriver: true,
        }),
      ]).start();

      // Continuous subtle pulse on icon
      Animated.loop(
        Animated.sequence([
          Animated.timing(iconPulseAnim, {
            toValue: 1.08,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(iconPulseAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      fadeAnim.setValue(0);
      iconScaleAnim.setValue(0.3);
      iconRotateAnim.setValue(0);
      ringScaleAnim.setValue(0.8);
    }
  }, [isActive]);

  const iconRotation = iconRotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        styles.slideContent,
        { opacity: fadeAnim },
      ]}
    >
      {/* Icon Container with Animations */}
      <Animated.View
        style={[
          styles.iconWrapper,
          {
            transform: [
              { scale: Animated.multiply(iconScaleAnim, iconPulseAnim) },
              { rotate: iconRotation },
            ],
          },
        ]}
      >
        <View style={[styles.iconContainer, { backgroundColor: slide.accentColor }]}>
          <Ionicons
            name={slide.icon}
            size={64}
            color="#FFFFFF"
          />
        </View>
        {/* Animated ring around icon */}
        <Animated.View
          style={[
            styles.iconRing,
            {
              borderColor: slide.accentColor,
              opacity: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.3],
              }),
              transform: [{ scale: ringScaleAnim }]
            }
          ]}
        />
      </Animated.View>

      {/* Title with slide animation */}
      <Animated.View
        style={{
          transform: [{ translateY: titleSlideAnim }],
          opacity: fadeAnim,
        }}
      >
        <Text style={styles.title}>
          {slide.title}
        </Text>
      </Animated.View>

      {/* Description with slide animation */}
      <Animated.View
        style={{
          transform: [{ translateY: descSlideAnim }],
          opacity: fadeAnim,
        }}
      >
        <Text style={styles.description}>
          {slide.description}
        </Text>
      </Animated.View>
    </Animated.View>
  );
};

interface OnboardingProps {
  onComplete: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const bgColorAnim = useRef(new Animated.Value(0)).current;
  const buttonScaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(fadeAnim, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();

    // Subtle button pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(buttonScaleAnim, {
          toValue: 1.02,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(buttonScaleAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    Animated.timing(bgColorAnim, {
      toValue: currentIndex,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [currentIndex]);

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      scrollViewRef.current?.scrollTo({
        x: nextIndex * width,
        animated: true,
      });
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / width);
    if (index !== currentIndex) {
      setCurrentIndex(index);
    }
  };

  const handleDotPress = (index: number) => {
    setCurrentIndex(index);
    scrollViewRef.current?.scrollTo({
      x: index * width,
      animated: true,
    });
  };

  const currentSlide = slides[currentIndex];

  const backgroundColor = bgColorAnim.interpolate({
    inputRange: slides.map((_, i) => i),
    outputRange: slides.map(s => s.backgroundColor),
  });

  return (
    <Animated.View style={[styles.container, { backgroundColor }]}>
      {/* Animated Background Elements */}
      <PremiumBackground color={currentSlide.accentColor} lineCount={8} circleCount={5} />

      {/* Header with Skip Button */}
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        {currentIndex < slides.length - 1 && (
          <Pressable
            onPress={handleSkip}
            style={({ pressed }) => [
              styles.skipButton,
              pressed && styles.skipButtonPressed,
            ]}
          >
            <Text style={styles.skipText}>Atla</Text>
          </Pressable>
        )}
      </Animated.View>

      {/* Slides */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        {slides.map((slide, index) => (
          <View key={index} style={[styles.slide, { width }]}>
            <SlideContent slide={slide} isActive={index === currentIndex} />
          </View>
        ))}
      </ScrollView>

      {/* Footer with Dots and Button */}
      <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
        {/* Pagination Dots */}
        <View style={styles.dotsContainer}>
          {slides.map((_, index) => {
            const isActive = index === currentIndex;
            return (
              <Pressable
                key={index}
                onPress={() => handleDotPress(index)}
                style={styles.dotTouchable}
              >
                <Animated.View
                  style={[
                    styles.dot,
                    isActive && styles.dotActive,
                    {
                      backgroundColor: isActive
                        ? '#FFFFFF'
                        : 'rgba(255, 255, 255, 0.3)',
                    },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>

        {/* Continue/Start Button with pulse */}
        <Animated.View style={{ transform: [{ scale: buttonScaleAnim }] }}>
          <Pressable
            onPress={handleNext}
            style={({ pressed }) => [
              styles.continueButton,
              { backgroundColor: currentSlide.accentColor },
              pressed && styles.continueButtonPressed,
            ]}
          >
            <Text style={styles.continueButtonText}>
              {currentIndex === slides.length - 1 ? 'Başlayalım' : 'Devam Et'}
            </Text>
            <Ionicons
              name="arrow-forward"
              size={24}
              color="#FFFFFF"
              style={styles.buttonIcon}
            />
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 16,
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    zIndex: 10,
  },
  skipButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    minHeight: 48,
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  skipText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    zIndex: 1,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconWrapper: {
    marginBottom: 48,
    position: 'relative',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 8,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  iconRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    top: -10,
    left: -10,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 16,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    zIndex: 10,
    paddingTop: 16,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    gap: 8,
  },
  dotTouchable: {
    padding: 16,
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 32,
    height: 8,
    borderRadius: 4,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 28,
    minHeight: 56,
  },
  continueButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  buttonIcon: {
    marginLeft: 8,
  },
});

export default Onboarding;
