import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authFetch } from '../utils/auth';
import theme from './ui/theme';

const { width } = Dimensions.get('window');

interface OnboardingSlide {
  id: string;
  title: string;
  description: string;
}

const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    id: '1',
    title: 'GPS Canlı Takip',
    description: 'Ekibinizin konumunu gerçek zamanlı olarak takip edin. Akıllı algoritmalar sayesinde batarya dostu ve yüksek performanslı. Planınıza göre otomatik optimizasyon.'
  },
  {
    id: '2',
    title: 'Grup Yönetimi',
    description: 'Çalışma grupları oluşturun, üyeleri ekleyin ve tüm ekibin konumunu tek ekranda görüntüleyin. Kolay yönetim, güçlü kontrol. Plan bazlı limitler.'
  },
  {
    id: '3',
    title: 'Akıllı Optimizasyon',
    description: 'Hızınıza göre otomatik ayarlanan güncelleme sıklığı. Daha az batarya tüketimi, daha fazla verimlilik. Business plan ile 0.5 saniye güncelleme.'
  },
  {
    id: '4',
    title: 'Detaylı Raporlama',
    description: 'Günlük mesafe, rota analizi, hız istatistikleri ve daha fazlası. İş verimliliğinizi artırın, verilerle karar verin. Plan bazlı rapor limitleri.'
  },
  {
    id: '5',
    title: 'Premium Planlar',
    description: 'Free, Plus ve Business planlar. Planınızı yükselterek daha fazla özellik açın. iyzico ile güvenli ödeme, anında aktifleştirme.'
  }
];

interface OnboardingModalProps {
  visible: boolean;
  onClose: () => void;
}

export function OnboardingModal({ visible, onClose }: OnboardingModalProps) {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [isCompleting, setIsCompleting] = React.useState(false);
  const flatListRef = React.useRef<FlatList>(null);

  React.useEffect(() => {
    if (visible) {
      setCurrentIndex(0);
      flatListRef.current?.scrollToIndex({ index: 0, animated: false });
    }
  }, [visible]);

  const completeOnboarding = React.useCallback(async (completed: boolean) => {
    try {
      await authFetch('/ui/preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preference: 'onboarding_completed',
          value: completed ? 'true' : 'skipped'
        })
      });
    } catch (error) {
      console.error('Onboarding completion tracking error:', error);
    }
  }, []);

  const handleNext = React.useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (currentIndex < ONBOARDING_SLIDES.length - 1) {
      const nextIndex = currentIndex + 1;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setCurrentIndex(nextIndex);
    } else {
      setIsCompleting(true);
      await completeOnboarding(true);
      setIsCompleting(false);
      onClose();
    }
  }, [currentIndex, completeOnboarding, onClose]);

  const handleSkip = React.useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsCompleting(true);
    await completeOnboarding(false);
    setIsCompleting(false);
    onClose();
  }, [completeOnboarding, onClose]);

  const renderSlide = ({ item }: { item: OnboardingSlide }) => {
    return (
      <View style={styles.slideContainer}>
          <View style={styles.slideContent}>
          <View style={styles.textWrapper}>
            <Text style={styles.slideTitle}>{item.title}</Text>
            <Text style={styles.slideDescription}>{item.description}</Text>
                  </View>
                </View>
              </View>
    );
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <View style={styles.container}>
            <Pressable 
              style={styles.skipButton} 
              onPress={handleSkip}
              disabled={isCompleting}
            >
                <Text style={styles.skipText}>Atla</Text>
            </Pressable>

            <FlatList
              ref={flatListRef}
              data={ONBOARDING_SLIDES}
              renderItem={renderSlide}
              keyExtractor={(item) => item.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              scrollEnabled={false}
              contentContainerStyle={{ flexGrow: 1 }}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / width);
                if (index >= 0 && index < ONBOARDING_SLIDES.length) {
                setCurrentIndex(index);
                }
              }}
            />

            <View style={styles.footer}>
                <View style={styles.dotsContainer}>
                {ONBOARDING_SLIDES.map((_, index) => (
                  <View
                        key={index}
                        style={[
                          styles.dot,
                      index === currentIndex && styles.dotActive
                        ]}
                      />
                ))}
                </View>

                <Pressable 
                  style={styles.nextButton} 
                  onPress={handleNext}
                  disabled={isCompleting}
                  >
                    <Text style={styles.nextButtonText}>
                      {currentIndex === ONBOARDING_SLIDES.length - 1 ? 'Başlayalım' : 'İleri'}
                    </Text>
                </Pressable>
              </View>
            </View>
        </SafeAreaView>
          </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.bg.primary
  },
  safeArea: {
    flex: 1
  },
  container: {
    flex: 1,
    width: '100%'
  },
  skipButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 20 : 16,
    right: theme.spacing.lg,
    zIndex: 100,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm + 2,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface.elevated,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle
  },
  skipText: {
    color: theme.colors.text.secondary,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2
  },
  slideContainer: {
    flex: 1,
    width,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl + 8
  },
  slideContent: {
    alignItems: 'center',
    maxWidth: 420,
    width: '100%'
  },
  textWrapper: {
    alignItems: 'center',
    width: '100%'
  },
  slideTitle: {
    fontSize: 38,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
    color: theme.colors.text.primary,
    letterSpacing: -0.5,
    lineHeight: 46
  },
  slideDescription: {
    fontSize: 17,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 26,
    letterSpacing: 0.1,
    paddingHorizontal: theme.spacing.sm
  },
  footer: {
    paddingHorizontal: theme.spacing.xl + 8,
    paddingTop: theme.spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? theme.spacing.xxl + 8 : theme.spacing.xl + 8,
    backgroundColor: theme.colors.bg.primary,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.subtle
  },
  dotsContainer: {
    flexDirection: 'row',
    marginBottom: theme.spacing.xl,
    gap: theme.spacing.sm + 2,
    alignItems: 'center',
    justifyContent: 'center'
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.border.default,
    opacity: 0.4
  },
  dotActive: {
    width: 32,
    height: 8,
    opacity: 1,
    backgroundColor: theme.colors.primary.main
  },
  nextButton: {
    width: '100%',
    paddingVertical: theme.spacing.md + 4,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary.main
  },
  nextButtonText: {
    color: theme.colors.text.primary,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3
  }
});
