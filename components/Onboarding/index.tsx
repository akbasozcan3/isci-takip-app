/**
 * Premium Onboarding Flow
 * Beautiful onboarding experience with smooth animations
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../ui/Button';
import { FadeInView } from '../ui/FadeInView';
import { useTheme } from '../ui/theme';

const { width } = Dimensions.get('window');

interface OnboardingSlide {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  color: string;
}

const slides: OnboardingSlide[] = [
  {
    icon: 'location',
    title: 'Gerçek Zamanlı Takip',
    description: 'Sevdiklerinizin ve ekibinizin konumunu anlık olarak takip edin',
    color: '#4A90E2',
  },
  {
    icon: 'people',
    title: 'Grup Yönetimi',
    description: 'Gruplar oluşturun ve üyelerinizi kolayca yönetin',
    color: '#50C878',
  },
  {
    icon: 'notifications',
    title: 'Anlık Bildirimler',
    description: 'Önemli olaylardan anında haberdar olun',
    color: '#FF6B6B',
  },
  {
    icon: 'analytics',
    title: 'Detaylı Analitik',
    description: 'Hareketlerinizi analiz edin ve raporlar oluşturun',
    color: '#9B59B6',
  },
];

interface OnboardingProps {
  onComplete: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const theme = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = React.useRef<ScrollView>(null);

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
    setCurrentIndex(index);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg.primary }]}>
      <View style={styles.header}>
        {currentIndex < slides.length - 1 && (
          <Button
            title="Atla"
            onPress={handleSkip}
            variant="secondary"
          />
        )}
      </View>

      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {slides.map((slide, index) => (
          <View key={index} style={[styles.slide, { width }]}>
            <FadeInView delay={index * 200}>
              <View
                style={[
                  styles.iconContainer,
                  {
                    backgroundColor: `${slide.color}20`,
                  },
                ]}
              >
                <Ionicons
                  name={slide.icon}
                  size={80}
                  color={slide.color}
                />
              </View>

              <Text
                style={[
                  styles.title,
                  {
                    color: theme.colors.text.primary,
                  },
                ]}
              >
                {slide.title}
              </Text>

              <Text
                style={[
                  styles.description,
                  {
                    color: theme.colors.text.secondary,
                  },
                ]}
              >
                {slide.description}
              </Text>
            </FadeInView>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    index === currentIndex
                      ? theme.colors.primary.main
                      : theme.colors.surface.elevated,
                  width: index === currentIndex ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>

        <Button
          title={currentIndex === slides.length - 1 ? 'Başlayalım' : 'Devam Et'}
          onPress={handleNext}
          variant="primary"
          style={styles.button}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    paddingTop: 50,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  footer: {
    padding: 24,
    paddingBottom: 40,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  button: {
    width: '100%',
  },
});

export default Onboarding;

