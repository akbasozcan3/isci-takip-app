import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

interface OnboardingSlide {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  gradient: string[];
  accentColor: string;
}

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<OnboardingSlide>);

const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    id: '1',
    title: 'GPS Canlı Takip',
    description: 'Ekibinizin konumunu gerçek zamanlı olarak takip edin. Akıllı algoritmalar sayesinde batarya dostu ve yüksek performanslı. Planınıza göre otomatik optimizasyon.',
    icon: 'navigate-circle',
    color: '#06b6d4',
    gradient: ['#0a1929', '#0f172a', '#1a2332'],
    accentColor: '#06b6d4'
  },
  {
    id: '2',
    title: 'Grup Yönetimi',
    description: 'Çalışma grupları oluşturun, üyeleri ekleyin ve tüm ekibin konumunu tek ekranda görüntüleyin. Kolay yönetim, güçlü kontrol. Plan bazlı limitler.',
    icon: 'people',
    color: '#7c3aed',
    gradient: ['#1a0b2e', '#0f172a', '#1e1a2e'],
    accentColor: '#8b5cf6'
  },
  {
    id: '3',
    title: 'Akıllı Optimizasyon',
    description: 'Hızınıza göre otomatik ayarlanan güncelleme sıklığı. Daha az batarya tüketimi, daha fazla verimlilik. Business plan ile 0.5 saniye güncelleme.',
    icon: 'speedometer',
    color: '#10b981',
    gradient: ['#0a1f1a', '#0f172a', '#1a2e1f'],
    accentColor: '#34d399'
  },
  {
    id: '4',
    title: 'Detaylı Raporlama',
    description: 'Günlük mesafe, rota analizi, hız istatistikleri ve daha fazlası. İş verimliliğinizi artırın, verilerle karar verin. Plan bazlı rapor limitleri.',
    icon: 'stats-chart',
    color: '#f59e0b',
    gradient: ['#2e1f0a', '#0f172a', '#2e241a'],
    accentColor: '#fbbf24'
  },
  {
    id: '5',
    title: 'Premium Planlar',
    description: 'Free, Plus ve Business planlar. Planınızı yükselterek daha fazla özellik açın. iyzico ile güvenli ödeme, anında aktifleştirme.',
    icon: 'rocket',
    color: '#ec4899',
    gradient: ['#2e0a1f', '#0f172a', '#2e1a24'],
    accentColor: '#f472b6'
  }
];

interface OnboardingModalProps {
  visible: boolean;
  onClose: () => void;
}

export function OnboardingModal({ visible, onClose }: OnboardingModalProps) {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const flatListRef = React.useRef<any>(null);
  const scrollX = React.useRef(new Animated.Value(0)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const rotateAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true
        }),
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.15,
              duration: 2000,
              useNativeDriver: true
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 2000,
              useNativeDriver: true
            })
          ])
        ),
        Animated.loop(
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 20000,
            useNativeDriver: true
          })
        )
      ]).start();
    } else {
      fadeAnim.setValue(0);
      pulseAnim.setValue(1);
      rotateAnim.setValue(0);
    }
  }, [visible]);

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (currentIndex < ONBOARDING_SLIDES.length - 1) {
      const nextIndex = currentIndex + 1;
      const list = flatListRef.current as any;
      if (list && list.scrollToIndex) {
        list.scrollToIndex({ index: nextIndex, animated: true });
      }
      setCurrentIndex(nextIndex);
    } else {
      onClose();
    }
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const renderSlide = ({ item, index }: { item: OnboardingSlide; index: number }) => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
    
    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.75, 1, 0.75],
      extrapolate: 'clamp'
    });
    
    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.2, 1, 0.2],
      extrapolate: 'clamp'
    });
    
    const translateY = scrollX.interpolate({
      inputRange,
      outputRange: [60, 0, 60],
      extrapolate: 'clamp'
    });

    const iconScale = scrollX.interpolate({
      inputRange,
      outputRange: [0.5, 1, 0.5],
      extrapolate: 'clamp'
    });

    const iconRotate = scrollX.interpolate({
      inputRange,
      outputRange: ['-15deg', '0deg', '15deg'],
      extrapolate: 'clamp'
    });

    const iconOpacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.3, 1, 0.3],
      extrapolate: 'clamp'
    });

    const titleTranslateY = scrollX.interpolate({
      inputRange,
      outputRange: [40, 0, 40],
      extrapolate: 'clamp'
    });

    const titleOpacity = scrollX.interpolate({
      inputRange,
      outputRange: [0, 1, 0],
      extrapolate: 'clamp'
    });

    const rotate = rotateAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg']
    });

    return (
      <Animated.View style={[styles.slideContainer, { width, transform: [{ scale }, { translateY }], opacity }]}>
        <LinearGradient
          colors={item.gradient as any}
          style={styles.slideGradient}
          start={[0, 0]}
          end={[1, 1]}
        >
          <View style={styles.decorativeElements}>
            <Animated.View
              style={[
                styles.decorativeCircle1,
                {
                  backgroundColor: `${item.accentColor}15`,
                  transform: [{ rotate }, { scale: pulseAnim }]
                }
              ]}
            />
            <Animated.View
              style={[
                styles.decorativeCircle2,
                {
                  backgroundColor: `${item.accentColor}10`,
                  transform: [{ rotate: rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] }) }]
                }
              ]}
            />
            <Animated.View
              style={[
                styles.decorativeCircle3,
                {
                  backgroundColor: `${item.accentColor}08`,
                }
              ]}
            />
          </View>

          <View style={styles.slideContent}>
            <Animated.View
              style={[
                styles.iconContainer,
                {
                  transform: [
                    { scale: iconScale },
                    { rotate: iconRotate }
                  ],
                  opacity: iconOpacity
                }
              ]}
            >
              <Animated.View
                style={[
                  styles.iconGlow,
                  {
                    backgroundColor: `${item.accentColor}20`,
                    transform: [{ scale: pulseAnim }]
                  }
                ]}
              />
              <View style={[styles.iconOuterRing, { borderColor: `${item.accentColor}40` }]}>
                <View style={[styles.iconMiddleRing, { borderColor: `${item.accentColor}30` }]}>
                  <View style={[styles.iconInnerRing, { borderColor: `${item.accentColor}50` }]}>
                    <LinearGradient
                      colors={[`${item.accentColor}40`, `${item.accentColor}20`, `${item.accentColor}10`]}
                      style={styles.iconGradient}
                      start={[0, 0]}
                      end={[1, 1]}
                    >
                      <View style={[styles.iconShadow, { backgroundColor: `${item.accentColor}15` }]} />
                      <Ionicons name={item.icon as any} size={72} color={item.accentColor} style={styles.icon} />
                    </LinearGradient>
                  </View>
                </View>
              </View>
            </Animated.View>

            <Animated.View
              style={[
                styles.textContainer,
                {
                  transform: [{ translateY: titleTranslateY }],
                  opacity: titleOpacity
                }
              ]}
            >
              <Text style={[styles.slideTitle, { color: item.accentColor }]}>{item.title}</Text>
              <View style={[styles.titleUnderline, { backgroundColor: item.accentColor }]} />
              <Text style={styles.slideDescription}>{item.description}</Text>
            </Animated.View>
          </View>
        </LinearGradient>
      </Animated.View>
    );
  };

  const currentSlide = ONBOARDING_SLIDES[currentIndex];

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <View style={styles.container}>
            <Pressable style={styles.skipButton} onPress={handleSkip}>
              <View style={styles.skipButtonBlur}>
                <Text style={styles.skipText}>Atla</Text>
              </View>
            </Pressable>

            <AnimatedFlatList
              ref={flatListRef}
              data={ONBOARDING_SLIDES}
              renderItem={renderSlide}
              keyExtractor={(item) => item.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              contentContainerStyle={{ flexGrow: 1 }}
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                { useNativeDriver: false }
              )}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / width);
                setCurrentIndex(index);
              }}
            />

            <View style={styles.footer}>
              <View style={styles.footerBlur}>
                <View style={styles.dotsContainer}>
                  {ONBOARDING_SLIDES.map((_, index) => {
                    const inputRange = [
                      (index - 1) * width,
                      index * width,
                      (index + 1) * width
                    ];
                    const dotWidth = scrollX.interpolate({
                      inputRange,
                      outputRange: [10, 36, 10],
                      extrapolate: 'clamp'
                    });
                    const dotOpacity = scrollX.interpolate({
                      inputRange,
                      outputRange: [0.4, 1, 0.4],
                      extrapolate: 'clamp'
                    });
                    const dotScale = scrollX.interpolate({
                      inputRange,
                      outputRange: [0.8, 1.2, 0.8],
                      extrapolate: 'clamp'
                    });

                    return (
                      <Animated.View
                        key={index}
                        style={[
                          styles.dot,
                          {
                            width: dotWidth,
                            opacity: dotOpacity,
                            transform: [{ scale: dotScale }],
                            backgroundColor: currentSlide?.accentColor || '#06b6d4'
                          }
                        ]}
                      />
                    );
                  })}
                </View>

                <Pressable 
                  style={styles.nextButton} 
                  onPress={handleNext}
                  android_ripple={{ color: 'rgba(255,255,255,0.1)' }}
                >
                  <LinearGradient
                    colors={currentSlide ? [currentSlide.accentColor, currentSlide.color] : ['#06b6d4', '#0891b2']}
                    style={styles.nextButtonGradient}
                    start={[0, 0]}
                    end={[1, 1]}
                  >
                    <Text style={styles.nextButtonText}>
                      {currentIndex === ONBOARDING_SLIDES.length - 1 ? 'Başlayalım' : 'İleri'}
                    </Text>
                    <View style={styles.nextButtonIconContainer}>
                      <Ionicons
                        name={currentIndex === ONBOARDING_SLIDES.length - 1 ? 'checkmark-circle' : 'arrow-forward-circle'}
                        size={22}
                        color="#fff"
                      />
                    </View>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#000000'
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
    top: 60,
    right: 24,
    zIndex: 100,
    borderRadius: 28,
    overflow: 'hidden'
  },
  skipButtonBlur: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(0,0,0,0.4)'
  },
  skipText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
    fontFamily: 'Poppins-SemiBold'
  },
  slideContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  slideGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    position: 'relative',
    overflow: 'hidden'
  },
  decorativeElements: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    top: 0,
    left: 0
  },
  decorativeCircle1: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    top: -150,
    right: -150
  },
  decorativeCircle2: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    bottom: -100,
    left: -100
  },
  decorativeCircle3: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    top: '30%',
    right: -80
  },
  slideContent: {
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
    zIndex: 10
  },
  iconContainer: {
    marginBottom: 56,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center'
  },
  iconGlow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    opacity: 0.6
  },
  iconOuterRing: {
    width: 240,
    height: 240,
    borderRadius: 120,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    backgroundColor: 'rgba(0,0,0,0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.6,
    shadowRadius: 40,
    elevation: 20
  },
  iconMiddleRing: {
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    backgroundColor: 'rgba(0,0,0,0.1)'
  },
  iconInnerRing: {
    width: 170,
    height: 170,
    borderRadius: 85,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.15)'
  },
  iconGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative'
  },
  iconShadow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    top: '50%',
    left: '50%',
    marginTop: -60,
    marginLeft: -60,
    opacity: 0.5
  },
  icon: {
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 12,
    zIndex: 10
  },
  textContainer: {
    alignItems: 'center',
    width: '100%'
  },
  slideTitle: {
    fontSize: 42,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 6 },
    textShadowRadius: 16,
    fontFamily: 'Poppins-ExtraBold',
    lineHeight: 50
  },
  titleUnderline: {
    width: 80,
    height: 6,
    borderRadius: 3,
    marginBottom: 40,
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 8
  },
  slideDescription: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 26,
    fontWeight: '400',
    letterSpacing: 0.2,
    fontFamily: 'Poppins-Regular',
    paddingHorizontal: 12
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10
  },
  footerBlur: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 50,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(0,0,0,0.5)'
  },
  dotsContainer: {
    flexDirection: 'row',
    marginBottom: 28,
    gap: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  dot: {
    height: 10,
    borderRadius: 5,
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 8
  },
  nextButton: {
    width: '100%',
    maxWidth: 340,
    alignSelf: 'center',
    borderRadius: 24,
    overflow: 'hidden'
  },
  nextButtonGradient: {
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 16
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
    fontFamily: 'Poppins-Bold'
  },
  nextButtonIconContainer: {
    marginLeft: 14,
    justifyContent: 'center',
    alignItems: 'center'
  }
});
