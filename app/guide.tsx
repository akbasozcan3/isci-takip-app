import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  ListRenderItemInfo,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type Step = { id: string; title: string; desc: string; icon: keyof typeof Ionicons.glyphMap; color: string };

const { width: WINDOW_WIDTH } = Dimensions.get('window');
const CARD_GAP = 20;
const CARD_WIDTH = Math.min(520, Math.max(300, WINDOW_WIDTH - 96)); // kompakt genişlik

const STEPS: Step[] = [
  {
    id: 'welcome',
    title: 'İşçi Takip Paneli',
    desc: 'Ekibinizi gerçek zamanlı takip edin. Cihazlar konum gönderir, yönetici haritada anlık görür.',
    icon: 'navigate-circle-outline',
    color: '#06b6d4',
  },
  {
    id: 'roles',
    title: 'Roller',
    desc: 'Çalışan cihazda paylaşır; yönetici haritadan izler, filtreler ve rapor alır.',
    icon: 'people-outline',
    color: '#7c3aed',
  },
  {
    id: 'permission',
    title: 'İzinler',
    desc: 'Konum izni gereklidir. Reddedildiyse Ayarlar > Uygulama > Konum üzerinden açın.',
    icon: 'shield-checkmark-outline',
    color: '#f59e0b',
  },
  {
    id: 'start',
    title: 'Hızlı Başlangıç',
    desc: 'Alt orta butonla izlemeyi başlat/durdur. Üstten çalışan listesine ve aramaya ulaşın.',
    icon: 'flash-outline',
    color: '#10b981',
  },
  {
    id: 'done',
    title: 'Hazırsınız',
    desc: 'Kurulum tamamlandı. "Takip Ekranına Git" ile hemen başlayın.',
    icon: 'checkmark-done-outline',
    color: '#06b6d4',
  },
];

export default function GuideScreen(): React.JSX.Element {
  console.log('[Guide] Component rendering');
  const router = useRouter();
  const scrollX = React.useRef(new Animated.Value(0)).current;
  const [index, setIndex] = React.useState(0);
  const [mounted, setMounted] = React.useState(false);
  const listRef = React.useRef<FlatList | null>(null);

  React.useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // ilerleme yüzdesi
  const progress = STEPS.length > 1 ? index / (STEPS.length - 1) : 1;

  const onSkip = React.useCallback(async () => {
    console.log('[Guide] Skipping guide, navigating to tabs');
    await AsyncStorage.setItem('onboardingSeen', '1');
    router.replace('/(tabs)');
  }, [router]);

  const onNext = React.useCallback(async () => {
    if (index < STEPS.length - 1) {
      const next = index + 1;
      console.log('[Guide] Moving to step:', next);
      listRef.current?.scrollToIndex({ index: next, animated: true });
      setIndex(next);
    } else {
      console.log('[Guide] Guide completed, navigating to tabs');
      await AsyncStorage.setItem('onboardingSeen', '1');
      router.replace('/(tabs)');
    }
  }, [index, router]);

  // FlatList render
  const renderItem = React.useCallback(({ item, index: i }: ListRenderItemInfo<Step>) => {
    // anims: scale + elevation via interpolation
    const inputRange = [(i - 1) * CARD_WIDTH, i * CARD_WIDTH, (i + 1) * CARD_WIDTH];
    const scale = scrollX.interpolate({ inputRange, outputRange: [0.94, 1, 0.94], extrapolate: 'clamp' });
    const opacity = scrollX.interpolate({ inputRange, outputRange: [0.6, 1, 0.6], extrapolate: 'clamp' });

    return (
      <Animated.View style={[styles.card, { width: CARD_WIDTH, transform: [{ scale }], opacity }]}>
        <View style={[styles.cardHeader]}>
          <View style={[styles.iconBox, { backgroundColor: `${item.color}15`, borderColor: `${item.color}33` }]}>
            <Ionicons name={item.icon as any} size={28} color={item.color} />
          </View>
          <Text style={styles.cardTitle}>{item.title}</Text>
        </View>
        <Text style={styles.cardDesc}>{item.desc}</Text>

        <View style={styles.cardFooter}>
          <Pressable
            onPress={() => router.push('/guide')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.moreBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.moreBtnText}>Detaylı Bilgi</Text>
            <Ionicons name="chevron-forward" size={16} color="#06b6d4" />
          </Pressable>
        </View>
      </Animated.View>
    );
  }, [router, scrollX]);

  const onMomentumScrollEnd = (ev: any) => {
    const offsetX = ev.nativeEvent.contentOffset.x;
    const idx = Math.round(offsetX / CARD_WIDTH);
    setIndex(idx);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={['#0f172a', '#0b1220']} start={[0, 0]} end={[1, 1]} style={styles.header}>
        <View style={styles.topRow}>
          <View style={styles.brandRow}>
            <View style={styles.brandCircle}><Ionicons name="navigate-circle-outline" size={22} color="#fff" /></View>
            <View style={{ marginLeft: 10 }}>
              <Text style={styles.brandTitle}>Hızlı Rehber</Text>
              <Text style={styles.brandSub}>{index === 0 ? 'Kısa tur: uygulamayı tanıyın' : `${index + 1}/${STEPS.length} Adım`}</Text>
            </View>
          </View>

          <Pressable onPress={onSkip} style={styles.skipBtn} accessibilityRole="button" accessibilityLabel="Rehberi geç">
            <Text style={styles.skipText}>Geç</Text>
          </Pressable>
        </View>

        <View style={styles.progressTrack} accessibilityLabel={`İlerleme ${Math.round(progress * 100)} yüzde`}>
          <Animated.View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
      </LinearGradient>

      <View style={styles.body}>
        <Animated.FlatList
          ref={listRef}
          data={STEPS}
          keyExtractor={(i) => i.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: (WINDOW_WIDTH - CARD_WIDTH) / 2 }}
          snapToInterval={CARD_WIDTH}
          decelerationRate="fast"
          renderItem={renderItem}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
          onMomentumScrollEnd={onMomentumScrollEnd}
        />

        {/* dots */}
        <View style={styles.dotsWrap}>
          {STEPS.map((_, i) => {
            const inputRange = [(i - 1) * CARD_WIDTH, i * CARD_WIDTH, (i + 1) * CARD_WIDTH];
            const scale = scrollX.interpolate({ inputRange, outputRange: [0.7, 1.2, 0.7], extrapolate: 'clamp' });
            const opacity = scrollX.interpolate({ inputRange, outputRange: [0.4, 1, 0.4], extrapolate: 'clamp' });
            return (
              <Animated.View
                key={i}
                style={[styles.dot, { transform: [{ scale }], opacity }]}
                accessible
                accessibilityLabel={`Slayt ${i + 1}`}
              />
            );
          })}
        </View>

        {/* footer + actions */}
        <View style={styles.footer}>
          <Pressable onPress={onNext} style={styles.nextButton} accessibilityRole="button" accessibilityLabel={index < STEPS.length - 1 ? 'İleri' : 'Tamamla'}>
            <Text style={styles.nextText}>{index < STEPS.length - 1 ? 'Devam' : 'Takip Ekranına Git'}</Text>
            <Ionicons name={index < STEPS.length - 1 ? 'arrow-forward' : 'navigate'} size={16} color="#062d37" />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#071122' },
  header: {
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 20 : 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  brandCircle: { 
    width: 48, 
    height: 48, 
    borderRadius: 14, 
    backgroundColor: 'rgba(255,255,255,0.1)', 
    alignItems: 'center', 
    justifyContent: 'center',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  brandTitle: { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 0.5 },
  brandSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600', marginTop: 2 },
  skipBtn: { 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    borderRadius: 12, 
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  skipText: { color: '#d1faff', fontWeight: '900', fontSize: 14 },

  progressTrack: { 
    height: 8, 
    backgroundColor: 'rgba(255,255,255,0.06)', 
    borderRadius: 8, 
    marginTop: 14, 
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  progressFill: { 
    height: '100%', 
    backgroundColor: '#06b6d4',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },

  body: { flex: 1, paddingTop: 22 },
  card: {
    backgroundColor: '#0f1f35',
    borderRadius: 20,
    padding: 24,
    marginHorizontal: CARD_GAP / 2,
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.15)',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  iconBox: { 
    width: 64, 
    height: 64, 
    borderRadius: 16, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: 14, 
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  cardTitle: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: 0.5 },
  cardDesc: { color: '#9aa7b7', marginTop: 10, lineHeight: 22, fontSize: 15, fontWeight: '500' },

  cardFooter: { marginTop: 14, flexDirection: 'row', justifyContent: 'flex-end' },
  moreBtn: { flexDirection: 'row', alignItems: 'center' },
  moreBtnText: { color: '#06b6d4', fontWeight: '900', marginRight: 6, fontSize: 15 },

  dotsWrap: { flexDirection: 'row', justifyContent: 'center', marginTop: 14, marginBottom: 8 },
  dot: { 
    width: 10, 
    height: 10, 
    borderRadius: 10, 
    backgroundColor: '#06b6d4', 
    marginHorizontal: 6,
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },

  footer: { paddingHorizontal: 28, paddingTop: 6, paddingBottom: 22 },
  nextButton: { 
    backgroundColor: '#d1faff', 
    height: 54, 
    borderRadius: 16, 
    alignItems: 'center', 
    justifyContent: 'center', 
    flexDirection: 'row', 
    gap: 8,
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  nextText: { color: '#062d37', fontWeight: '900', fontSize: 16, letterSpacing: 0.3 },
});
