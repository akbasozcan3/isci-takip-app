import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import {
  Animated,
  DeviceEventEmitter,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  View,
  Easing
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { io, Socket } from 'socket.io-client';
import { AnalyticsCard } from '../../components/AnalyticsCard';
import { NetworkStatusIcon } from '../../components/NetworkStatusIcon';
import { UnifiedHeader } from '../../components/UnifiedHeader';
import { OnboardingModal } from '../../components/OnboardingModal';
import { Toast, useToast } from '../../components/Toast';
import { LoadingState } from '../../components/ui/LoadingState';
import { getApiBase } from '../../utils/api';
import { authFetch, getToken } from '../../utils/auth';
import { shareCurrentLocation } from '../../utils/locationShare';
import { useProfile } from '../../contexts/ProfileContext';

const { width } = Dimensions.get('window');

const API_BASE = getApiBase();

// --- Types ---
interface DashboardStats {
  activeWorkers: number;
  totalGroups: number;
  todayDistance: number; // km
  activeAlerts: number;
}

interface RecentActivity {
  id: string;
  type: 'location' | 'join' | 'alert' | 'system';
  message: string;
  timestamp: number;
  userId?: string;
}

interface Slide {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
}

interface Article {
  id: string;
  title: string;
  excerpt: string;
  icon?: string;
  readTime: string;
  category?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

// --- Static content (you can fetch these from API if desired) ---
const SLIDES: Slide[] = [
  {
    id: '1',
    title: 'Gerçek Zamanlı Takip',
    description: 'Ekibinizin konumunu anlık olarak güvenli şekilde takip edin; düşük gecikme, yüksek doğruluk.',
    icon: 'location',
    color: '#06b6d4',
  },
  {
    id: '2',
    title: 'Bavaxe Raporlama',
    description: 'Günlük mesafe, rota ve etkinlik raporlarını kolayca görüntüleyin ve dışa aktarın.',
    icon: 'stats-chart',
    color: '#10b981',
  },
  {
    id: '3',
    title: 'Güvenlik ve Gizlilik',
    description: 'Verileriniz şifreli, erişim kontrolleri güçlü. KVKK ve veri koruma uyumlu.',
    icon: 'shield-checkmark',
    color: '#f59e0b',
  },
];

// Articles will be fetched from backend

const QUICK_ACTIONS = [
  { id: 'track', title: 'Canlı Takip', icon: 'navigate-circle', route: '/(tabs)/track', color: '#06b6d4' },
  { id: 'groups', title: 'Gruplarım', icon: 'people-circle', route: '/(tabs)/groups', color: '#7c3aed' },
  { id: 'location-features', title: 'Konum Özellikleri', icon: 'location', route: '/(tabs)/location-features', color: '#10b981' },
  { id: 'analytics', title: 'Analitik', icon: 'stats-chart', route: '/(tabs)/analytics', color: '#8b5cf6' },
  { id: 'admin', title: 'Yönetim', icon: 'shield-checkmark-outline', route: '/(tabs)/admin', color: '#f59e0b' },
  { id: 'settings', title: 'Ayarlar', icon: 'person-outline', route: '/(tabs)/profile', color: '#64748b' },
];
export default function HomeScreen(): React.JSX.Element {
  const router = useRouter();
  const { toast, showError, showSuccess, showWarning, showInfo, hideToast } = useToast();
  const { avatarUrl } = useProfile();

  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [userName, setUserName] = React.useState('Ekip Üyesi');
  const [userId, setUserId] = React.useState('');
  const [stats, setStats] = React.useState<DashboardStats>({ activeWorkers: 0, totalGroups: 0, todayDistance: 0, activeAlerts: 0 });
  const [stepData, setStepData] = React.useState({ steps: 0, goal: null as number | null, progress: 0 });
  const [hasLocationPermission, setHasLocationPermission] = React.useState(false);
  const [hidePermissionBanner, setHidePermissionBanner] = React.useState(true);
  const [permissionChecked, setPermissionChecked] = React.useState(false);
  const [currentSlide, setCurrentSlide] = React.useState(0);
  const [showLightbox, setShowLightbox] = React.useState(false);
  const [lightboxImage, setLightboxImage] = React.useState<string | null>(null);
  const [articles, setArticles] = React.useState<Article[]>([]);
  const [showOnboarding, setShowOnboarding] = React.useState(false);
  const [plans, setPlans] = React.useState<any[]>([
    {
      id: 'plus',
      title: 'Plus',
      priceLabel: '$20 / ay',
      monthlyPrice: 20,
      monthlyPriceTRY: 600,
      currency: 'USD',
      badge: 'Popüler',
      recommended: false,
      description: 'Profesyoneller için gelişmiş özellikler',
      features: [
        'Öncelikli destek',
        '5 çalışma alanı',
        'Gerçek zamanlı takip',
        'Gelişmiş raporlama',
        '90 günlük veri saklama',
        '200 istek/dakika',
        '50 aktivite limiti',
        '2000 konum geçmişi'
      ]
    },
    {
      id: 'business',
      title: 'Business',
      priceLabel: '$50 / ay',
      monthlyPrice: 50,
      monthlyPriceTRY: 1500,
      currency: 'USD',
      badge: 'Önerilen',
      recommended: true,
      description: 'Kurumsal düzey güvenlik ve yönetim',
      features: [
        'Sınırsız çalışma alanı',
        'Takım rol yönetimi',
        'Kurumsal güvenlik raporları',
        'Özel müşteri yöneticisi',
        'API erişimi',
        'Sınırsız veri saklama',
        '500 istek/dakika',
        '200 aktivite limiti',
        '10000 konum geçmişi',
        'Sınırsız export'
      ]
    }
  ]);
  const [currentPlanId, setCurrentPlanId] = React.useState<string>('free');
  const socketRef = React.useRef<Socket | null>(null);

  // Animations
  const scrollY = React.useRef(new Animated.Value(0)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideX = React.useRef(new Animated.Value(0)).current;
  const cardScale = React.useRef(new Animated.Value(1)).current;
  const lightboxScale = React.useRef(new Animated.Value(0)).current;
  const statsAnimRef = React.useRef(Array(4).fill(0).map(() => new Animated.Value(0)));
  const headerScale = React.useRef(new Animated.Value(0.95)).current;

  // Scroll to top
  const [showScrollTop, setShowScrollTop] = React.useState(false);
  const scrollViewRef = React.useRef<any>(null);
  const scrollTopAnim = React.useRef(new Animated.Value(0)).current;
  const waveAnim = React.useRef(new Animated.Value(0)).current; // Su dalgası animasyonu

  // Wave Animation Loop
  React.useEffect(() => {
    if (showScrollTop) {
      Animated.loop(
        Animated.timing(waveAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      waveAnim.setValue(0);
    }
  }, [showScrollTop]);

  // Slider auto-play
  const sliderRef = React.useRef<FlatList>(null);
  const autoPlayRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // TÜM HOOKS'LAR ERKEN RETURN'DEN ÖNCE - Fonksiyonlar useCallback ile sarmalanmalı
  // loadDashboardData önce tanımlanmalı çünkü checkAuth tarafından kullanılıyor
  const loadDashboardData = React.useCallback(async (workerIdParam?: string) => {
    try {
      const worker = workerIdParam || userId;
      if (!worker) {
        setLoading(false);
        return;
      }

      // Token al
      let authHeaders: Record<string, string> = {};
      try {
        const t = await getToken();
        if (t) authHeaders['Authorization'] = `Bearer ${t}`;
      } catch (e) {
        console.warn('Token error:', e);
      }

      // Abonelik durumunu kontrol et (plan bazlı limitler için)
      let subscriptionPlan = 'free';
      let activitiesLimit = 10;
      try {
        const subRes = await authFetch('/me/subscription');
        if (subRes.ok) {
          const subData = await subRes.json();
          subscriptionPlan = subData.subscription?.planId || 'free';
          activitiesLimit = subscriptionPlan === 'business' ? 200 : (subscriptionPlan === 'plus' ? 50 : 10);
        }
      } catch (e) {
        console.warn('Subscription check error:', e);
      }

      // Backend'den gerçek veri çek (timeout plan bazlı)
      const timeoutMs = subscriptionPlan === 'business' ? 15000 : (subscriptionPlan === 'plus' ? 12000 : 10000);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const [statsRes, activitiesRes, stepsRes] = await Promise.all([
          authFetch(`/dashboard/${worker}`, {
            signal: controller.signal
          }).catch(() => ({ ok: false, status: 404, json: async () => ({}) } as Response)),
          authFetch(`/activities?limit=${activitiesLimit}`, {
            signal: controller.signal
          }).catch(() => ({ ok: false, status: 404, json: async () => ({ data: { activities: [] } }) } as Response)),
          authFetch(`/steps/today`, {
            signal: controller.signal
          }).catch(() => ({ ok: false, status: 404, json: async () => ({ success: false, data: {} }) } as Response)),
        ]);

        clearTimeout(timeoutId);

        // Stats güncelle
        if (statsRes.ok) {
          const response = await statsRes.json();
          // Backend ResponseFormatter kullanıyor: { success: true, data: {...} }
          const data = response.success && response.data ? response.data : response;
          setStats({
            activeWorkers: data.activeWorkers || 0,
            totalGroups: data.totalGroups || 0,
            todayDistance: data.todayDistance || 0,
            activeAlerts: data.activeAlerts || 0,
          });
          console.log('Dashboard stats loaded:', data);
          if (data.cached) {
            console.log('[Performance] Using cached dashboard data');
          }
        } else {
          if (statsRes.status !== 429) {
            console.warn('Stats fetch failed:', statsRes.status);
          }
          setStats({ activeWorkers: 0, totalGroups: 0, todayDistance: 0, activeAlerts: 0 });
        }

        // Activities removed for cleaner UI

        // Steps güncelle
        if (stepsRes.ok) {
          const stepsData = await stepsRes.json();
          if (stepsData.success && stepsData.data) {
            const steps = stepsData.data.steps || 0;
            const goal = stepsData.data.goal || null;
            const progress = goal && goal > 0 ? Math.min(steps / goal, 1) : 0;
            setStepData({ steps, goal, progress });
          }
        }
      } catch (e: unknown) {
        clearTimeout(timeoutId);
        if (e instanceof Error && e.name !== 'AbortError') {
          console.error('Dashboard load error:', e);
        }
        // Fallback - backend yoksa bile çalışsın
        setStats({ activeWorkers: 0, totalGroups: 0, todayDistance: 0, activeAlerts: 0 });
      } finally {
        setLoading(false);
      }
    } catch (e) {
      console.error('Dashboard outer error:', e);
      setStats({ activeWorkers: 0, totalGroups: 0, todayDistance: 0, activeAlerts: 0 });
      setLoading(false);
    }
  }, [userId]);

  // checkAuth loadDashboardData'yı kullandığı için loadDashboardData'dan sonra tanımlanmalı
  const checkAuth = React.useCallback(async () => {
    try {
      setLoading(true);
      const workerId = await SecureStore.getItemAsync('workerId');
      const displayName = await SecureStore.getItemAsync('displayName');

      if (workerId) {
        setIsAuthenticated(true);
        setUserId(workerId);
        if (displayName) setUserName(displayName);

        await loadDashboardData(workerId);

        try {
          const { status } = await Location.getForegroundPermissionsAsync();
          const granted = status === 'granted';
          setHasLocationPermission(granted);
          if (granted) {
            setHidePermissionBanner(true);
            try { await AsyncStorage.setItem('hide_permission_banner', '1'); } catch { }
          } else {
            const hidden = await AsyncStorage.getItem('hide_permission_banner');
            setHidePermissionBanner(hidden === '1');
          }
          setPermissionChecked(true);
        } catch (e) {
          console.warn('Location permission check failed:', e);
          setHasLocationPermission(false);
          setPermissionChecked(true);
        }
      } else {
        setIsAuthenticated(false);
        setLoading(false);
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      setIsAuthenticated(false);
      setLoading(false);
    }
  }, [loadDashboardData]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await loadDashboardData(userId);
    setRefreshing(false);
  }, [userId, loadDashboardData]);

  // Fetch articles from backend
  React.useEffect(() => {
    const fetchArticles = async () => {
      if (!isAuthenticated) {
        setArticles([]);
        return;
      }
      try {
        const response = await authFetch('/api/articles?limit=3');
        if (response.ok) {
          const data = await response.json();
          console.log('[Home] Articles response:', data);

          // Handle different response formats
          let articlesArray = [];
          if (data.success && data.data && Array.isArray(data.data.articles)) {
            articlesArray = data.data.articles;
          } else if (Array.isArray(data.articles)) {
            articlesArray = data.articles;
          } else if (Array.isArray(data)) {
            articlesArray = data;
          }

          setArticles(articlesArray.slice(0, 3));
          console.log('[Home] Articles loaded:', articlesArray.length);
        } else {
          if (response.status !== 429) {
            console.warn('Articles fetch failed:', response.status);
          }
          setArticles([]);
        }
      } catch (error) {
        console.error('Error fetching articles:', error);
        setArticles([]);
      }
    };
    if (isAuthenticated) {
      fetchArticles();
    }
  }, [isAuthenticated]);

  // Fetch plans from backend
  React.useEffect(() => {
    const fetchPlans = async () => {
      if (!isAuthenticated) {
        setPlans([]);
        return;
      }
      try {
        try {
          const plansRes = await authFetch('/plans');

          if (plansRes.ok) {
            const plansData = await plansRes.json();
            console.log('[Home] Plans response:', plansData);

            if (plansData.success && Array.isArray(plansData.plans) && plansData.plans.length > 0) {
              setPlans(plansData.plans);
              setCurrentPlanId(plansData.currentPlan || 'free');
            } else if (Array.isArray(plansData.plans) && plansData.plans.length > 0) {
              setPlans(plansData.plans);
              setCurrentPlanId(plansData.currentPlan || 'free');
            } else {
              console.warn('[Home] Plans array empty or invalid');
            }
          } else {
            if (plansRes.status !== 429) {
              console.warn('[Home] Plans fetch failed:', plansRes.status);
              const errorText = await plansRes.text();
              console.warn('[Home] Error response:', errorText);
            }
          }
        } catch (fetchError) {
          console.error('[Home] Plans fetch error:', fetchError);
        }

        try {
          const subscriptionRes = await authFetch('/me/subscription');
          if (subscriptionRes.ok) {
            const subData = await subscriptionRes.json();
            if (subData?.subscription?.planId) {
              setCurrentPlanId(subData.subscription.planId);
            }
          }
        } catch (subError) {
          console.warn('[Home] Subscription fetch error:', subError);
        }
      } catch (error) {
        console.error('[Home] Error fetching plans:', error);
      }
    };
    fetchPlans();
  }, [isAuthenticated]);

  // Scroll to top handlers
  const handleScroll = React.useCallback((event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;

    if (offsetY > 200 && !showScrollTop) {
      setShowScrollTop(true);
      Animated.spring(scrollTopAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    } else if (offsetY <= 200 && showScrollTop) {
      Animated.spring(scrollTopAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start(() => {
        setShowScrollTop(false);
      });
    }
  }, [showScrollTop, scrollTopAnim]);

  const scrollToTop = React.useCallback(() => {
    scrollViewRef.current?.scrollTo({
      y: 0,
      animated: true,
    });
  }, []);


  React.useEffect(() => {
    if (plans.length > 0) {
      setTimeout(() => {
        Animated.stagger(150, statsAnimRef.current.map((anim: Animated.Value) =>
          Animated.spring(anim, { toValue: 1, tension: 50, friction: 8, useNativeDriver: true })
        )).start();
      }, 200);
    }
  }, [plans.length]);

  const resetAnimations = React.useCallback(() => {
    // Blur sorununu önlemek için fadeAnim'i direkt 1'e set et, animasyon yapma
    fadeAnim.setValue(1);
    headerScale.setValue(1);
    statsAnimRef.current.forEach(anim => anim.setValue(1));

    // Sadece hafif bir spring animasyonu yap, opacity değiştirme
    Animated.parallel([
      Animated.spring(headerScale, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
      Animated.stagger(80, statsAnimRef.current.map((anim: Animated.Value) =>
        Animated.spring(anim, { toValue: 1, tension: 50, friction: 8, useNativeDriver: true })
      ))
    ]).start();
  }, [fadeAnim, headerScale]);

  React.useEffect(() => {
    const init = async () => {
      try {
        await checkAuth();

        // İlk yüklemede fadeAnim'i 1'e set et - blur sorununu önlemek için
        fadeAnim.setValue(1);
        resetAnimations();

        setTimeout(() => {
          if (plans.length > 0) {
            Animated.stagger(150, statsAnimRef.current.map((anim: Animated.Value) =>
              Animated.spring(anim, { toValue: 1, tension: 50, friction: 8, useNativeDriver: true })
            )).start();
          }
        }, 300);
      } catch (e) {
        console.error('Init error:', e);
      }
    };

    init();

    return () => {
    };
  }, [checkAuth, resetAnimations]);

  useFocusEffect(
    React.useCallback(() => {
      fadeAnim.setValue(1);
      resetAnimations();
      if (userId) {
        loadDashboardData(userId).catch(e => console.error('Dashboard refresh failed:', e));
      }
      (async () => {
        try {
          const { status } = await Location.getForegroundPermissionsAsync();
          const granted = status === 'granted';
          setHasLocationPermission(granted);
          if (granted) {
            setHidePermissionBanner(true);
            await AsyncStorage.setItem('hide_permission_banner', '1');
          } else {
            const hidden = await AsyncStorage.getItem('hide_permission_banner');
            setHidePermissionBanner(hidden === '1');
          }
        } catch { }
      })();
      return () => { };
    }, [resetAnimations, fadeAnim, userId, loadDashboardData])
  );


  // Auto-play slider
  React.useEffect(() => {
    if (!isAuthenticated && Platform.OS === 'ios') {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
      autoPlayRef.current = setInterval(() => {
        setCurrentSlide((prev) => {
          const next = (prev + 1) % SLIDES.length;
          sliderRef.current?.scrollToIndex({ index: next, animated: true });
          return next;
        });
      }, 4000);
    }
    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    };
  }, [isAuthenticated]);

  // Load permission banner preference - sadece bir kez
  React.useEffect(() => {
    if (!permissionChecked) return;
    (async () => {
      try {
        const v = await AsyncStorage.getItem('hide_permission_banner');
        if (v === '1') {
          setHidePermissionBanner(true);
        } else if (!hasLocationPermission) {
          setHidePermissionBanner(false);
        }
      } catch { }
    })();
  }, [permissionChecked, hasLocationPermission]);

  // Check if onboarding should be shown
  React.useEffect(() => {
    (async () => {
      try {
        const seen = await AsyncStorage.getItem('onboardingSeen');
        if (!seen && isAuthenticated) {
          setTimeout(() => {
            setShowOnboarding(true);
          }, 1000);
        }
      } catch { }
    })();
  }, [isAuthenticated]);

  const handleOnboardingClose = React.useCallback(async () => {
    try {
      await AsyncStorage.setItem('onboardingSeen', 'true');
      setShowOnboarding(false);
    } catch { }
  }, []);

  // Global app data clear handler
  React.useEffect(() => {
    const sub = DeviceEventEmitter.addListener('app:dataCleared', () => {
      try {
        // Reset UI/auth state
        setIsAuthenticated(false);
        setUserId('');
        setUserName('Ekip Üyesi');
        setStats({ activeWorkers: 0, totalGroups: 0, todayDistance: 0, activeAlerts: 0 });
        setActivities([]);
        // Cleanup socket
        if (socketRef.current) {
          try { socketRef.current.off(); socketRef.current.disconnect(); } catch { }
          socketRef.current = null;
        }
      } catch { }
    });
    return () => { sub.remove?.(); };
  }, []);

  // Realtime: listen for group deletion and refresh dashboard
  React.useEffect(() => {
    // Cleanup function - her zaman tanımlanmalı
    const cleanup = () => {
      if (socketRef.current) {
        try { socketRef.current.off(); socketRef.current.disconnect(); } catch { }
        socketRef.current = null;
      }
    };

    if (!isAuthenticated || !userId) {
      // cleanup existing socket if auth lost
      if (socketRef.current) {
        try { socketRef.current.off(); socketRef.current.disconnect(); } catch { }
        socketRef.current = null;
      }
      return cleanup;
    }

    const setup = async () => {
      try {
        // fetch active groups to know which rooms to join
        const res = await authFetch(`/groups/user/${userId}/active`);
        const groups = res.ok ? await res.json() : [];
        interface Group {
          id: string;
        }
        const groupIds: string[] = (groups || []).map((g: Group) => g.id);

        // Get token for Socket.IO authentication
        const token = await getToken();
        const s = io(API_BASE, {
          transports: ['websocket'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          auth: token ? { token } : undefined,
          extraHeaders: token ? { Authorization: `Bearer ${token}` } : undefined
        });
        socketRef.current = s;

        const joinAll = () => {
          try { groupIds.forEach(id => s.emit('join_group', id)); } catch { }
        };

        s.on('connect', joinAll);
        s.on('reconnect', joinAll);
        s.on('group_deleted', (ev: { groupId: string }) => {
          try {
            if (!ev || !ev.groupId) return;
            // Refresh stats
            onRefresh();
            showWarning('Bir grup silindi. Gösterge paneli güncellendi.');
          } catch { }
        });

        s.on('connect_error', () => {/* ignore */ });
      } catch (e) {
        // ignore
      }
    };

    setup();

    return cleanup;
  }, [isAuthenticated, userId, onRefresh, showWarning]);

  const handleQuickAction = (route: string) => {
    Animated.sequence([
      Animated.timing(cardScale, { toValue: 0.96, duration: 90, useNativeDriver: true }),
      Animated.timing(cardScale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    router.push(route as any);
  };

  const closeLightbox = () => {
    Animated.timing(lightboxScale, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setShowLightbox(false);
      setLightboxImage(null);
    });
  };

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === 'granted';
      setHasLocationPermission(granted);
      if (granted) {
        showSuccess('Konum izni verildi');
        setHidePermissionBanner(true);
        setPermissionChecked(true);
        try {
          await AsyncStorage.setItem('hide_permission_banner', '1');
          await AsyncStorage.setItem('location_permission_granted', '1');
        } catch { }
      } else {
        showError('Konum izni verilmedi');
      }
    } catch (e) {
      console.error('Request location permission error:', e);
      showError('Konum izni alınamadı');
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    const s = Math.floor((Date.now() - timestamp) / 1000);
    if (s < 60) return `${s} saniye önce`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} dakika önce`;
    const h = Math.floor(m / 60);
    return `${h} saat önce`;
  };

  // --- slider render ---
  const renderSlide = ({ item, index }: { item: Slide; index: number }) => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
    const scale = slideX.interpolate({ inputRange, outputRange: [0.9, 1, 0.9], extrapolate: 'clamp' });
    const opacity = slideX.interpolate({ inputRange, outputRange: [0.6, 1, 0.6], extrapolate: 'clamp' });

    return (
      <Animated.View style={[styles.slideCard, { width, transform: [{ scale }], opacity }]}>
        <View style={[styles.slideBadge, { backgroundColor: `${item.color}15` }]}>
          <Ionicons name={item.icon as any} size={36} color={item.color} />
        </View>
        <Text style={styles.slideTitle}>{item.title}</Text>
        <Text style={styles.slideDesc}>{item.description}</Text>
        <Pressable style={[styles.slideCTA]} onPress={() => router.push('/help' as any)} android_ripple={{ color: 'rgba(255,255,255,0.25)' }}>
          <Text style={styles.slideCTAText}>Kısa Tur</Text>
          <Ionicons name="play" size={16} color="#06b6d4" />
        </Pressable>
      </Animated.View>
    );
  };



  // --- Loading State ---
  if (loading && !isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="light-content" />
        <LoadingState fullScreen message="Yükleniyor..." />
      </SafeAreaView>
    );
  }

  // --- Authenticated UI ---
  // --- Authenticated UI ---
  // Note: UnifiedHeader is being used which handles safe area internally or by parent.
  // We switch to View container to control layout better.
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <UnifiedHeader
        title="BAVAXE"
        subtitle={`Hoş Geldin, ${userName}`}
        brandLabel="DASHBOARD"
        gradientColors={['#0369a1', '#0c4a6e']}
        showProfile={true}
        showNetwork={true}
        showBack={false}
        profileName={userName}
        avatarUrl={avatarUrl}
        onProfilePress={() => router.push('/(tabs)/profile')}
        actions={
          <Pressable
            onPress={() => router.push('/blog')}
            style={({ pressed }) => [
              styles.headerIconButton,
              pressed && styles.headerIconButtonPressed
            ]}
          >
            <Ionicons name="book-outline" size={20} color="#fff" />
          </Pressable>
        }
      />


      <Animated.ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent}
        style={{ opacity: fadeAnim }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#06b6d4"
            colors={['#06b6d4']}
          />
        }
      >
        {/* Hero Video - Temporarily disabled until expo-av is properly configured */}
        {/* <HeroVideo
          videoSource={require('../../Adsız (1920 x 400 piksel).mp4')}
          height={200}
          showOverlay={false}
        /> */}

        {/* Slider at top */}
        <View style={styles.topSlider}>
          <Animated.FlatList
            ref={sliderRef}
            data={SLIDES}
            horizontal
            keyExtractor={(i) => i.id}
            pagingEnabled
            snapToInterval={width}
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: slideX } } }], { useNativeDriver: false })}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / width);
              setCurrentSlide(idx);
            }}
            renderItem={renderSlide}
          />
          <View style={styles.dotsRow}>
            {SLIDES.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.pillIndicator,
                  currentSlide === i && styles.pillIndicatorActive
                ]}
              />
            ))}
          </View>
        </View>

        {/* Permission banner */}
        {!hasLocationPermission && !hidePermissionBanner && permissionChecked && (
          <View style={styles.permissionBanner}>
            <Ionicons name="location-outline" size={24} color="#f59e0b" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.permissionTitle}>Konum İzni Gerekli</Text>
              <Text style={styles.permissionText}>Takip özelliğini kullanmak için konum izni verin</Text>
            </View>
            <Pressable onPress={requestLocationPermission} style={styles.permissionButton} android_ripple={{ color: 'rgba(6,182,212,0.25)' }}><Text style={styles.permissionButtonText}>İzin Ver</Text></Pressable>
            <Pressable
              onPress={async () => {
                try {
                  await AsyncStorage.setItem('hide_permission_banner', '1');
                  setHidePermissionBanner(true);
                } catch { }
              }}
              style={{ marginLeft: 8, paddingHorizontal: 10, paddingVertical: 6 }}
              android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
            >
              <Text style={{ color: '#64748b', fontWeight: '700' }}>Gizle</Text>
            </Pressable>
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statsGrid}>
            {[
              { icon: 'footsteps', value: stepData.steps.toLocaleString(), label: 'Adım', color: '#14b8a6', gradient: ['#14b8a6', '#0d9488'] as [string, string], route: '/(tabs)/steps', hasProgress: true, progress: stepData.progress, goal: stepData.goal },
              { icon: 'people', value: stats.activeWorkers, label: 'Aktif İşçi', color: '#06b6d4', gradient: ['#06b6d4', '#0891b2'] as [string, string] },
              { icon: 'albums', value: stats.totalGroups, label: 'Toplam Grup', color: '#7c3aed', gradient: ['#7c3aed', '#6d28d9'] as [string, string] },
              { icon: 'navigate', value: `${stats.todayDistance.toFixed(1)} km`, label: 'Bugün', color: '#10b981', gradient: ['#10b981', '#059669'] as [string, string] }
            ].map((stat, idx) => (
              <Pressable
                key={idx}
                onPress={() => {
                  if ((stat as any).route) {
                    router.push((stat as any).route as any);
                  }
                }}
                style={({ pressed }) => [
                  { opacity: pressed ? 0.9 : 1 }
                ]}
              >
                <Animated.View
                  style={[
                    styles.statCard,
                    {
                      opacity: statsAnimRef.current[idx] || new Animated.Value(0),
                      transform: [
                        {
                          scale: (statsAnimRef.current[idx] || new Animated.Value(0)).interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.85, 1]
                          })
                        },
                        {
                          translateY: (statsAnimRef.current[idx] || new Animated.Value(0)).interpolate({
                            inputRange: [0, 1],
                            outputRange: [25, 0]
                          })
                        }
                      ]
                    }
                  ]}
                >
                  <LinearGradient
                    colors={stat.gradient}
                    start={[0, 0]}
                    end={[1, 1]}
                    style={styles.statIconWrapper}
                  >
                    <Ionicons name={stat.icon as any} size={24} color="#fff" />
                  </LinearGradient>
                  <Text style={styles.statValue} numberOfLines={1}>{stat.value}</Text>
                  <Text style={styles.statLabel} numberOfLines={1}>{stat.label}</Text>
                  {(stat as any).hasProgress && (stat as any).goal && (
                    <View style={styles.statProgressContainer}>
                      <View style={styles.statProgressBar}>
                        <View
                          style={[
                            styles.statProgressFill,
                            {
                              width: `${((stat as any).progress * 100)}%`
                            }
                          ]}
                        />
                      </View>
                      <Text style={styles.statProgressText} numberOfLines={1}>
                        {Math.round((stat as any).progress * 100)}%
                      </Text>
                    </View>
                  )}
                </Animated.View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Advanced Analytics */}
        {isAuthenticated && userId && (
          <View style={styles.section}>
            <AnalyticsCard userId={userId} dateRange="7d" />
          </View>
        )}


        {/* Quick actions - Professional Grid */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Hızlı Erişim</Text>
            <View style={styles.sectionBadge}>
              <Ionicons name="flash" size={14} color="#06b6d4" />
              <Text style={styles.sectionBadgeText}>4</Text>
            </View>
          </View>
          <View style={styles.quickGrid}>
            {QUICK_ACTIONS.map((q, idx) => {
              const animValue = statsAnimRef.current[idx % 4] || new Animated.Value(0);

              return (
                <Animated.View
                  key={q.id}
                  style={{
                    opacity: animValue,
                    transform: [
                      {
                        translateY: animValue.interpolate({
                          inputRange: [0, 1],
                          outputRange: [30, 0]
                        })
                      },
                      {
                        scale: animValue.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.9, 1]
                        })
                      }
                    ]
                  }}
                >
                  <Pressable
                    onPress={() => handleQuickAction(q.route)}
                    style={({ pressed }) => [
                      styles.quickActionCard,
                      pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }
                    ]}
                    android_ripple={{ color: `${q.color}22` }}
                  >
                    <View style={[styles.quickActionIconWrapper, { backgroundColor: `${q.color}15` }]}>
                      <LinearGradient
                        colors={[q.color, q.color + 'DD']}
                        style={styles.quickActionIcon}
                        start={[0, 0]}
                        end={[1, 1]}
                      >
                        <Ionicons name={q.icon as any} size={26} color="#fff" />
                      </LinearGradient>
                    </View>
                    <View style={styles.quickActionContent}>
                      <Text style={styles.quickActionTitle}>{q.title}</Text>
                      <View style={styles.quickActionArrow}>
                        <Ionicons name="arrow-forward" size={16} color="#64748b" />
                      </View>
                    </View>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        </View>

        {/* Premium Plans Section - Professional Design */}
        {isAuthenticated && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <LinearGradient
                  colors={['#7c3aed', '#a855f7']}
                  style={styles.plansIconWrapper}
                >
                  <Ionicons name="rocket" size={22} color="#fff" />
                </LinearGradient>
                <View>
                  <Text style={styles.sectionTitle}>Premium Planlar</Text>
                  <Text style={styles.sectionSubtitle}>Ekibinizi profesyonelce yönetin</Text>
                </View>
              </View>
              <Pressable
                onPress={() => router.push('/UpgradeScreen' as any)}
                style={styles.viewAllButton}
                android_ripple={{ color: 'rgba(124,58,237,0.2)' }}
              >
                <Text style={styles.viewAllText}>Tümünü Gör</Text>
                <Ionicons name="arrow-forward" size={16} color="#7c3aed" />
              </Pressable>
            </View>

            {plans.length > 0 ? (
              <View style={styles.plansContainer}>
                {plans.filter(p => p.id !== 'free').slice(0, 2).map((plan, idx) => {
                  const isCurrent = currentPlanId === plan.id;
                  const isRecommended = plan.recommended || plan.badge === 'Önerilen';
                  const planAnim = statsAnimRef.current[idx % 4] || new Animated.Value(0);

                  return (
                    <Animated.View
                      key={plan.id}
                      style={[
                        styles.planCard,
                        isRecommended && styles.planCardRecommended,
                        isCurrent && styles.planCardCurrent,
                        {
                          opacity: planAnim,
                          transform: [
                            {
                              translateY: planAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [30, 0]
                              })
                            },
                            {
                              scale: planAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.95, 1]
                              })
                            }
                          ]
                        }
                      ]}
                    >
                      {isRecommended && (
                        <View style={styles.planRecommendedBadge}>
                          <Ionicons name="star" size={12} color="#fff" />
                          <Text style={styles.planRecommendedText}>ÖNERİLEN</Text>
                        </View>
                      )}

                      {isCurrent && (
                        <View style={styles.planCurrentBadge}>
                          <Ionicons name="checkmark-circle" size={14} color="#10b981" />
                          <Text style={styles.planCurrentText}>Mevcut Plan</Text>
                        </View>
                      )}

                      <View style={styles.planHeader}>
                        <View style={styles.planTitleRow}>
                          <Text style={[styles.planTitle, isRecommended && styles.planTitleRecommended]}>
                            {plan.title}
                          </Text>
                          {plan.badge && !isRecommended && (
                            <View style={styles.planBadge}>
                              <Text style={styles.planBadgeText}>{plan.badge}</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.planPriceRow}>
                          <Text style={[styles.planPrice, isRecommended && styles.planPriceRecommended]}>
                            {plan.priceLabel}
                          </Text>
                          {plan.monthlyPriceTRY && plan.monthlyPriceTRY > 0 && (
                            <Text style={styles.planPriceTRY}>
                              {plan.monthlyPriceTRY} ₺ / ay
                            </Text>
                          )}
                        </View>
                      </View>

                      {plan.description && (
                        <Text style={[styles.planDescription, isRecommended && styles.planDescriptionRecommended]}>
                          {plan.description}
                        </Text>
                      )}

                      <View style={styles.planFeatures}>
                        {plan.features.slice(0, 3).map((feature: string, fIdx: number) => (
                          <View key={fIdx} style={styles.planFeatureRow}>
                            <Ionicons
                              name="checkmark-circle"
                              size={16}
                              color={isRecommended ? '#fff' : '#10b981'}
                            />
                            <Text style={[styles.planFeatureText, isRecommended && styles.planFeatureTextRecommended]}>
                              {feature}
                            </Text>
                          </View>
                        ))}
                        {plan.features.length > 3 && (
                          <Pressable
                            onPress={() => {
                              router.push({
                                pathname: '/UpgradeScreen' as any,
                                params: { planId: plan.id }
                              } as any);
                            }}
                            style={styles.planMoreButton}
                          >
                            <Text style={[styles.planMoreFeatures, isRecommended && styles.planMoreFeaturesRecommended]}>
                              +{plan.features.length - 3} özellik daha
                            </Text>
                            <Ionicons name="chevron-forward" size={14} color={isRecommended ? 'rgba(255,255,255,0.7)' : '#64748b'} />
                          </Pressable>
                        )}
                      </View>

                      {isCurrent ? (
                        <View style={styles.planCurrentButton}>
                          <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                          <Text style={styles.planCurrentButtonText}>Aktif Plan</Text>
                        </View>
                      ) : (
                        <Pressable
                          style={[
                            styles.planUpgradeButton,
                            isRecommended && styles.planUpgradeButtonRecommended
                          ]}
                          onPress={() => {
                            router.push({
                              pathname: '/UpgradeScreen' as any,
                              params: { planId: plan.id }
                            } as any);
                          }}
                          android_ripple={{ color: isRecommended ? 'rgba(255,255,255,0.3)' : 'rgba(124,58,237,0.3)' }}
                        >
                          <Text style={[
                            styles.planUpgradeButtonText,
                            isRecommended && styles.planUpgradeButtonTextRecommended
                          ]}>
                            Ödeme Yap
                          </Text>
                          <Ionicons
                            name="card"
                            size={16}
                            color={isRecommended ? '#7c3aed' : '#fff'}
                          />
                        </Pressable>
                      )}
                    </Animated.View>
                  );
                })}

                {plans.filter(p => p.id !== 'free').length > 2 && (
                  <Pressable
                    style={styles.planViewAllCard}
                    onPress={() => router.push('/UpgradeScreen' as any)}
                    android_ripple={{ color: 'rgba(124,58,237,0.2)' }}
                  >
                    <LinearGradient
                      colors={['rgba(124,58,237,0.1)', 'rgba(168,85,247,0.1)']}
                      style={styles.planViewAllGradient}
                    >
                      <Ionicons name="grid-outline" size={24} color="#a855f7" />
                      <Text style={styles.planViewAllText}>Tüm Planları Gör</Text>
                      <Ionicons name="arrow-forward" size={18} color="#a855f7" />
                    </LinearGradient>
                  </Pressable>
                )}
              </View>
            ) : null}
          </View>
        )}



        {/* Blog Layout */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="book" size={22} color="#06b6d4" />
              <Text style={styles.sectionTitle}>Blog & Rehberler</Text>
            </View>
            <Pressable onPress={() => router.push('/blog' as any)} android_ripple={{ color: 'rgba(255,255,255,0.15)' }}>
              <Text style={styles.seeAllText}>Tümünü Gör →</Text>
            </Pressable>
          </View>
          {/* Show articles from backend */}
          {articles.length > 0 ? (
            articles.map((art, idx) => {
              const getCategoryIcon = (category?: string) => {
                const icons: Record<string, string> = {
                  'Genel': 'document-text',
                  'Teknoloji': 'hardware-chip',
                  'İş Dünyası': 'business',
                  'Güvenlik': 'shield-checkmark',
                  'Verimlilik': 'speedometer',
                  'Gizlilik': 'lock-closed',
                  'Yönetim': 'people',
                  'Analiz': 'analytics',
                  'Kullanım': 'phone-portrait',
                  'Hizmet': 'headset',
                  'Sektör': 'grid',
                };
                return icons[category || ''] || 'document';
              };
              const getCategoryColor = (category?: string) => {
                const colors: Record<string, string> = {
                  'Genel': '#06b6d4',
                  'Teknoloji': '#7c3aed',
                  'İş Dünyası': '#10b981',
                  'Güvenlik': '#ef4444',
                  'Verimlilik': '#f59e0b',
                  'Gizlilik': '#3b82f6',
                  'Yönetim': '#8b5cf6',
                  'Analiz': '#ec4899',
                  'Kullanım': '#14b8a6',
                  'Hizmet': '#f97316',
                  'Sektör': '#6366f1',
                };
                return colors[category || ''] || '#64748b';
              };
              const categoryColor = getCategoryColor((art as any).category);
              return (
                <Pressable
                  key={`${art.id}-${idx}`}
                  style={styles.blogCard}
                  onPress={() => router.push(`/blog?id=${String(art.id)}` as any)}
                  android_ripple={{ color: 'rgba(255,255,255,0.12)' }}
                >
                  <View style={styles.blogImageContainer}>
                    <LinearGradient colors={[categoryColor, `${categoryColor}CC`]} style={styles.blogImagePlaceholder}>
                      <Ionicons name={getCategoryIcon((art as any).category) as any} size={32} color="#fff" />
                    </LinearGradient>
                    {(art as any).category && (
                      <View style={[styles.blogBadge, { backgroundColor: `${categoryColor}20` }]}>
                        <Text style={[styles.blogBadgeText, { color: categoryColor }]}>{(art as any).category.toUpperCase()}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.blogContent}>
                    <Text style={styles.blogTitle}>{art.title}</Text>
                    <Text style={styles.blogExcerpt} numberOfLines={2}>{art.excerpt}</Text>
                    <View style={styles.blogMeta}>
                      <View style={styles.blogAuthor}>
                        <View style={styles.authorAvatar}>
                          <Ionicons name="person" size={12} color="#06b6d4" />
                        </View>
                        <Text style={styles.authorName}>Bavaxe</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="time-outline" size={14} color="#64748b" />
                        <Text style={styles.blogReadTime}>{art.readTime || '5 dk'}</Text>
                      </View>
                    </View>
                  </View>
                </Pressable>
              );
            })
          ) : (
            <View style={styles.emptyArticles}>
              <Ionicons name="document-text-outline" size={48} color="#64748b" />
              <Text style={styles.emptyArticlesText}>Makaleler yükleniyor...</Text>
            </View>
          )}
        </View>

        {/* Hakkımızda */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Ionicons name="information-circle" size={22} color="#06b6d4" />
            <Text style={styles.sectionTitle}>Hakkımızda</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              İşçi Takip Paneli, modern işletmelerin saha çalışanlarını güvenli ve verimli
              şekilde yönetmesini sağlayan bir teknoloji çözümüdür. 2024'ten beri binlerce
              işletmeye hizmet veriyoruz.
            </Text>
          </View>
        </View>

        {/* Hizmetler */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Ionicons name="rocket" size={22} color="#06b6d4" />
            <Text style={styles.sectionTitle}>Hizmetlerimiz</Text>
          </View>
          <View style={styles.servicesGrid}>
            <View style={styles.serviceCard}>
              <LinearGradient
                colors={['#06b6d4', '#0891b2']}
                style={styles.serviceIconWrapper}
              >
                <Ionicons name="location" size={28} color="#fff" />
              </LinearGradient>
              <View style={styles.serviceContent}>
                <Text style={styles.serviceTitle}>Canlı Takip</Text>
                <Text style={styles.serviceDesc}>Gerçek zamanlı konum</Text>
              </View>
            </View>
            <View style={styles.serviceCard}>
              <LinearGradient
                colors={['#7c3aed', '#6d28d9']}
                style={styles.serviceIconWrapper}
              >
                <Ionicons name="stats-chart" size={28} color="#fff" />
              </LinearGradient>
              <View style={styles.serviceContent}>
                <Text style={styles.serviceTitle}>Raporlama</Text>
                <Text style={styles.serviceDesc}>Detaylı analizler</Text>
              </View>
            </View>
            <View style={styles.serviceCard}>
              <LinearGradient
                colors={['#10b981', '#059669']}
                style={styles.serviceIconWrapper}
              >
                <Ionicons name="people" size={28} color="#fff" />
              </LinearGradient>
              <View style={styles.serviceContent}>
                <Text style={styles.serviceTitle}>Grup Yönetimi</Text>
                <Text style={styles.serviceDesc}>Ekip organizasyonu</Text>
              </View>
            </View>
            <View style={styles.serviceCard}>
              <LinearGradient
                colors={['#f59e0b', '#d97706']}
                style={styles.serviceIconWrapper}
              >
                <Ionicons name="shield-checkmark" size={28} color="#fff" />
              </LinearGradient>
              <View style={styles.serviceContent}>
                <Text style={styles.serviceTitle}>Güvenlik</Text>
                <Text style={styles.serviceDesc}>KVKK uyumlu</Text>
              </View>
            </View>
          </View>
        </View>

        {/* İletişim - Modern */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Ionicons name="chatbubbles" size={22} color="#06b6d4" />
            <Text style={styles.sectionTitle}>İletişim</Text>
          </View>

          <Pressable style={styles.modernContactCard} onPress={() => Linking.openURL('mailto:ozcanakbas38@gmail.com')} android_ripple={{ color: 'rgba(6,182,212,0.15)' }}>
            <LinearGradient
              colors={['#06b6d4', '#0891b2']}
              start={[0, 0]}
              end={[1, 1]}
              style={styles.modernContactIconWrapper}
            >
              <Ionicons name="mail" size={24} color="#fff" />
            </LinearGradient>
            <View style={styles.modernContactContent}>
              <Text style={styles.modernContactLabel}>E-posta</Text>
              <Text style={styles.modernContactValue}>ozcanakbas38@gmail.com</Text>
            </View>
            <View style={styles.modernContactArrow}>
              <Ionicons name="arrow-forward" size={18} color="#06b6d4" />
            </View>
          </Pressable>

          <Pressable style={styles.modernContactCard} onPress={() => Linking.openURL('https://wa.me/905327104355')} android_ripple={{ color: 'rgba(37,211,102,0.15)' }}>
            <LinearGradient
              colors={['#25D366', '#20BA5A']}
              start={[0, 0]}
              end={[1, 1]}
              style={styles.modernContactIconWrapper}
            >
              <Ionicons name="logo-whatsapp" size={24} color="#fff" />
            </LinearGradient>
            <View style={styles.modernContactContent}>
              <Text style={styles.modernContactLabel}>WhatsApp</Text>
              <Text style={styles.modernContactValue}>Hızlı Destek</Text>
            </View>
            <View style={styles.modernContactArrow}>
              <Ionicons name="arrow-forward" size={18} color="#25D366" />
            </View>
          </Pressable>
        </View>

        <View style={{ height: 140 }} />
      </Animated.ScrollView>

      {/* Lightbox Modal */}
      <Modal visible={showLightbox} transparent animationType="fade" onRequestClose={closeLightbox}>
        <Pressable style={styles.lightboxOverlay} onPress={closeLightbox}>
          <Animated.View style={[styles.lightboxContent, { transform: [{ scale: lightboxScale }] }]}>
            {lightboxImage && (
              <Image source={{ uri: lightboxImage }} style={styles.lightboxImage} resizeMode="contain" />
            )}
            <Pressable style={styles.lightboxClose} onPress={closeLightbox}>
              <Ionicons name="close-circle" size={40} color="#fff" />
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onHide={hideToast}
      />

      {/* Scroll to Top Button with Liquid Wave Effect */}
      {
        showScrollTop && (
          <Animated.View
            style={[
              styles.scrollToTopButton,
              {
                opacity: scrollTopAnim,
                transform: [
                  { scale: scrollTopAnim },
                  { translateY: scrollTopAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }
                ],
              },
            ]}
          >
            <Pressable
              onPress={scrollToTop}
              style={styles.scrollToTopPressable}
              android_ripple={{ color: 'rgba(6, 182, 212, 0.3)', radius: 30 }}
            >
              {/* Liquid Wave Animation - Double Layer */}
              <View style={styles.liquidContainer}>
                {/* Back Wave (Slower, Reverse) */}
                <Animated.View
                  style={[
                    styles.liquidWave,
                    styles.liquidWaveBack,
                    {
                      transform: [{
                        rotate: waveAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['360deg', '0deg'] // Reverse rotation
                        })
                      }]
                    }
                  ]}
                />

                {/* Front Wave (Normal) */}
                <Animated.View
                  style={[
                    styles.liquidWave,
                    {
                      transform: [{
                        rotate: waveAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '360deg']
                        })
                      }]
                    }
                  ]}
                >
                  <LinearGradient
                    colors={['rgba(6,182,212,0.8)', 'rgba(59,130,246,0.9)']} // Slightly transparent for glass effect
                    style={{ flex: 1 }}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                </Animated.View>
              </View>

              {/* Icon Layer */}
              <View style={styles.liquidIconContainer}>
                <Ionicons name="arrow-up" size={26} color="#fff" />
              </View>
            </Pressable>
          </Animated.View>
        )
      }

      <OnboardingModal visible={showOnboarding} onClose={handleOnboardingClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
  loadingText: { marginTop: 12, color: '#94a3b8' },

  // Header
  header: {
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 20 : 20,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  headerTextBlock: { flex: 1 },
  brandLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontFamily: 'Poppins-SemiBold',
  },
  headerLogoContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    backgroundColor: 'rgba(255,255,255,0.95)',
    overflow: 'hidden',
  },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: 0.5, fontFamily: 'Poppins-Bold' },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 3, fontWeight: '600', fontFamily: 'Poppins-SemiBold' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  headerIconButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    marginLeft: 8,
  },
  headerIconButtonPressed: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    transform: [{ scale: 0.95 }],
  },
  headerIconButtonDisabled: {
    opacity: 0.5,
  },
  headerIconButtonSettings: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderColor: 'rgba(255,255,255,0.4)',
  },
  headerAvatarContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.4)',
    shadowColor: '#0369a1',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 5,
  },
  headerAvatar: {
    width: '100%',
    height: '100%',
  },
  headerAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Scroll
  scrollContent: { paddingBottom: 32 },

  // Top Slider
  topSlider: { marginBottom: 28 },

  // Auth header
  authHeader: { alignItems: 'center', paddingTop: 60, paddingBottom: 36, paddingHorizontal: 20, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoTextBig: {
    fontSize: 28,
    fontWeight: '900',
    color: '#7c3aed',
    letterSpacing: 1,
  },
  authTitle: { fontSize: 26, color: '#fff', fontWeight: '900' },
  authSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 6 },
  authScrollView: { flex: 1 },

  // Slider
  sliderWrapper: { marginTop: 18, marginBottom: 16 },
  slideCard: { backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', marginHorizontal: 0, borderRadius: 24, padding: 28, alignItems: 'flex-start', justifyContent: 'center' },
  slideBadge: { width: 88, height: 88, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  slideTitle: { fontSize: 24, fontWeight: '900', color: '#fff', marginBottom: 12, letterSpacing: 0.5, fontFamily: 'Poppins-Bold' },
  slideDesc: { color: 'rgba(255,255,255,0.9)', fontSize: 16, lineHeight: 24, fontFamily: 'Poppins-Regular' },
  slideCTA: { marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14 },
  slideCTAText: { color: '#fff', fontWeight: '900', marginRight: 8, fontFamily: 'Poppins-Bold' },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20, paddingHorizontal: 20 },
  pillIndicator: {
    height: 4,
    width: 24,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginHorizontal: 4,
    transition: 'all 0.3s ease'
  },
  pillIndicatorActive: {
    width: 32,
    backgroundColor: '#0369a1'
  },

  // About
  aboutCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginTop: 8, marginBottom: 14 },
  aboutTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  aboutText: { color: '#64748b', marginTop: 8, lineHeight: 20 },
  authBtnRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
  primaryBtn: { flex: 1, backgroundColor: '#06b6d4', paddingVertical: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryBtnText: { color: '#fff', fontWeight: '800' },
  ghostBtn: { flex: 1, borderWidth: 1, borderColor: '#06b6d4', paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  ghostBtnText: { color: '#06b6d4', fontWeight: '800' },

  // Articles
  articlesSection: { marginTop: 6, marginBottom: 18 },
  articleRow: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 12, alignItems: 'center' },
  articleLeft: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#e7f9ff', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  articleTitle: { fontWeight: '800', color: '#0f172a' },
  articleExcerpt: { color: '#64748b', marginTop: 6 },
  articleMeta: { fontSize: 12, color: '#94a3b8', marginTop: 6 },
  // Stats
  statsContainer: { marginBottom: 32, paddingHorizontal: 20 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    width: (width - 40 - 12) / 2,
    backgroundColor: '#1e293b',
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  statIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '900',
    color: '#fff',
    marginTop: 10,
    letterSpacing: 0.3,
    fontFamily: 'Poppins-Bold',
    textAlign: 'center',
  },
  statLabel: {
    color: '#94a3b8',
    marginTop: 8,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Poppins-SemiBold',
    textAlign: 'center',
  },
  statCardWithProgress: { paddingBottom: 16 },
  statProgressContainer: { marginTop: 10, width: '100%', alignItems: 'center' },
  statProgressBar: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden', marginBottom: 4, width: '100%' },
  statProgressFill: { height: '100%', backgroundColor: '#fff', borderRadius: 2 },
  statProgressText: { fontSize: 9, color: 'rgba(255,255,255,0.8)', fontWeight: '700', fontFamily: 'Poppins-Bold' },

  // Quick Actions - Professional
  section: { marginBottom: 32, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 24, fontWeight: '900', color: '#fff', letterSpacing: 0.5, fontFamily: 'Poppins-Bold' },
  sectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(3,105,161,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(3,105,161,0.2)',
  },
  sectionBadgeText: { fontSize: 12, fontWeight: '800', color: '#0369a1', fontFamily: 'Poppins-ExtraBold' },
  quickGrid: { gap: 14 },
  quickActionCard: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 0,
  },
  quickActionIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 18,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quickActionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.3,
    fontFamily: 'Poppins-Bold',
  },
  quickActionArrow: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Activities
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#1e293b',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155',
  },
  activityCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginRight: 18 },
  activityMsg: { fontWeight: '900', color: '#fff', fontSize: 16, fontFamily: 'Poppins-Bold' },
  activityTime: { color: '#64748b', marginTop: 8, fontSize: 13, fontWeight: '600', fontFamily: 'Poppins-SemiBold' },

  emptyState: { alignItems: 'center', padding: 48, backgroundColor: '#1e293b', borderRadius: 20, borderWidth: 1, borderColor: '#334155' },
  emptyText: { color: '#64748b', marginTop: 16, fontSize: 15, fontFamily: 'Poppins-Regular' },

  // Error Banner
  errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 20, padding: 20, marginBottom: 24, marginHorizontal: 20, borderWidth: 1, borderColor: '#ef4444' },
  errorTitle: { fontSize: 15, fontWeight: '900', color: '#fff', marginBottom: 6, fontFamily: 'Poppins-Bold' },
  errorText: { fontSize: 13, color: '#fca5a5', fontFamily: 'Poppins-Regular' },

  // Permission
  permissionBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 20, padding: 20, marginBottom: 24, marginHorizontal: 20, borderWidth: 1, borderColor: '#f59e0b' },
  permissionTitle: { fontSize: 15, fontWeight: '900', color: '#fff', marginBottom: 6, fontFamily: 'Poppins-Bold' },
  permissionText: { fontSize: 13, color: '#94a3b8', fontFamily: 'Poppins-Regular' },
  permissionButton: { backgroundColor: '#f59e0b', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  permissionButtonText: { fontSize: 13, fontWeight: '900', color: '#fff', fontFamily: 'Poppins-Bold' },

  // Article Card (authenticated)
  articleCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, alignItems: 'center' },

  // Blog Layout
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  seeAllText: { color: '#0369a1', fontWeight: '900', fontSize: 15, fontFamily: 'Poppins-Bold' },
  blogCard: {
    backgroundColor: '#1e293b',
    borderRadius: 24,
    marginBottom: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  blogImageContainer: { position: 'relative', height: 200 },
  blogImagePlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  blogBadge: { position: 'absolute', top: 16, right: 16, backgroundColor: '#10b981', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  blogBadgeText: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  blogContent: { padding: 24 },
  blogTitle: { fontSize: 21, fontWeight: '900', color: '#fff', marginBottom: 12, letterSpacing: 0.3, fontFamily: 'Poppins-Bold' },
  blogExcerpt: { fontSize: 15, color: '#94a3b8', lineHeight: 24, marginBottom: 16, fontFamily: 'Poppins-Regular' },
  blogMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  blogAuthor: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  authorAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center' },
  authorName: { fontSize: 13, fontWeight: '800', color: '#94a3b8', fontFamily: 'Poppins-ExtraBold' },
  blogReadTime: { fontSize: 13, color: '#64748b', fontFamily: 'Poppins-Regular' },
  emptyArticles: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyArticlesText: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 12,
    fontFamily: 'Poppins-Regular',
  },

  // Lightbox
  lightboxOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' },
  lightboxContent: { width: '90%', height: '70%', backgroundColor: '#000', borderRadius: 20, overflow: 'hidden', position: 'relative' },
  lightboxImage: { width: '100%', height: '100%' },
  lightboxClose: { position: 'absolute', top: 10, right: 10, zIndex: 10 },

  // Info sections
  infoSection: {
    marginHorizontal: 20,
    marginBottom: 32,
    backgroundColor: '#1e293b',
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: '#334155',
  },
  infoTitle: { fontSize: 24, fontWeight: '900', color: '#fff', marginBottom: 20, letterSpacing: 0.5 },
  infoCard: { backgroundColor: '#1e293b', borderRadius: 20, padding: 24, marginBottom: 0, borderWidth: 1, borderColor: '#334155' },
  infoText: { fontSize: 16, color: '#94a3b8', lineHeight: 26, fontFamily: 'Poppins-Regular' },

  // Services
  servicesSection: { marginHorizontal: 20, marginBottom: 32 },
  servicesGrid: { flexDirection: 'column', gap: 14 },
  serviceCard: {
    width: '100%',
    backgroundColor: '#1e293b',
    borderRadius: 24,
    padding: 24,
    marginBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  serviceIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 18,
  },
  serviceContent: {
    flex: 1,
  },
  serviceTitle: { fontSize: 18, fontWeight: '900', color: '#fff', textAlign: 'left', letterSpacing: 0.3, fontFamily: 'Poppins-Bold' },
  serviceDesc: { fontSize: 14, color: '#94a3b8', marginTop: 6, textAlign: 'left', fontFamily: 'Poppins-Regular' },

  // Contact - Modern Design
  contactSection: { marginHorizontal: 20, marginBottom: 30 },
  contactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  contactHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contactHeaderIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  contactHeaderTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.5,
  },
  contactHeaderSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '600',
  },
  modernContactCard: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  modernContactIconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 18,
  },
  modernContactContent: {
    flex: 1,
  },
  modernContactLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    fontFamily: 'Poppins-SemiBold',
  },
  modernContactValue: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '800',
    fontFamily: 'Poppins-ExtraBold',
  },
  modernContactArrow: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernContactBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  modernContactBadgeText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // Bionluk Card
  bionlukCard: {
    marginTop: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  bionlukGradient: {
    padding: 24,
  },
  bionlukHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  bionlukIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bionlukBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  bionlukBadgeText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0284c7',
    letterSpacing: 0.5,
  },
  bionlukTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0c4a6e',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  bionlukDesc: {
    fontSize: 14,
    color: '#0369a1',
    lineHeight: 22,
    marginBottom: 16,
    fontWeight: '600',
  },
  bionlukFeatures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  bionlukFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  bionlukFeatureText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0c4a6e',
  },

  // Premium Plans Styles
  plansIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    fontFamily: 'Poppins-Regular',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(124,58,237,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.2)',
  },
  viewAllText: {
    color: '#7c3aed',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: 'Poppins-Bold',
  },
  plansLoadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  plansLoadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
  },
  plansContainer: {
    gap: 16,
  },
  planCard: {
    backgroundColor: '#1e293b',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
    position: 'relative',
  },
  planCardRecommended: {
    backgroundColor: '#7c3aed',
    borderColor: '#8b5cf6',
  },
  planCardCurrent: {
    borderColor: '#10b981',
    borderWidth: 2,
  },
  planRecommendedBadge: {
    position: 'absolute',
    top: -10,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  planRecommendedText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
    fontFamily: 'Poppins-ExtraBold',
  },
  planCurrentBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16,185,129,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  planCurrentText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'Poppins-Bold',
  },
  planHeader: {
    marginBottom: 12,
    marginTop: 8,
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  planTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.3,
    fontFamily: 'Poppins-Bold',
  },
  planTitleRecommended: {
    color: '#fff',
  },
  planBadge: {
    backgroundColor: 'rgba(124,58,237,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.3)',
  },
  planBadgeText: {
    color: '#a855f7',
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'Poppins-Bold',
  },
  planPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  planPrice: {
    fontSize: 32,
    fontWeight: '900',
    color: '#a855f7',
    letterSpacing: 0.5,
    fontFamily: 'Poppins-ExtraBold',
  },
  planPriceRecommended: {
    color: '#fff',
  },
  planPriceTRY: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
  },
  planDescription: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
    marginBottom: 16,
    fontFamily: 'Poppins-Regular',
  },
  planDescriptionRecommended: {
    color: 'rgba(255,255,255,0.85)',
  },
  planFeatures: {
    gap: 10,
    marginBottom: 20,
  },
  planFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  planFeatureText: {
    color: '#e2e8f0',
    fontSize: 14,
    flex: 1,
    fontFamily: 'Poppins-Regular',
  },
  planFeatureTextRecommended: {
    color: 'rgba(255,255,255,0.9)',
  },
  planMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(124,58,237,0.1)',
  },
  planMoreFeatures: {
    color: '#a855f7',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Poppins-Bold',
  },
  planMoreFeaturesRecommended: {
    color: 'rgba(255,255,255,0.9)',
  },
  planViewAllCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  planViewAllGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 20,
  },
  planViewAllText: {
    color: '#a855f7',
    fontSize: 16,
    fontWeight: '900',
    fontFamily: 'Poppins-ExtraBold',
  },
  planCurrentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  planCurrentButtonText: {
    color: '#10b981',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: 'Poppins-Bold',
  },
  planUpgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: '#7c3aed',
    borderRadius: 12,
  },
  planUpgradeButtonRecommended: {
    backgroundColor: '#fff',
  },
  planUpgradeButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3,
    fontFamily: 'Poppins-ExtraBold',
  },
  planUpgradeButtonTextRecommended: {
    color: '#7c3aed',
  },
  plansEmptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 12,
  },
  plansEmptyText: {
    color: '#94a3b8',
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
  },
  plansRetryButton: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#7c3aed',
    borderRadius: 10,
  },
  plansRetryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    fontFamily: 'Poppins-Bold',
  },

  // Plan Modal Styles
  planModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  planModalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '90%',
  },
  planModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  planModalIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planModalClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planModalBody: {
    gap: 20,
  },
  planModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planModalTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    fontFamily: 'Poppins-Bold',
  },
  planModalRecommendedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  planModalRecommendedText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
    fontFamily: 'Poppins-ExtraBold',
  },
  planModalPriceSection: {
    gap: 8,
  },
  planModalPrice: {
    fontSize: 36,
    fontWeight: '900',
    color: '#a855f7',
    fontFamily: 'Poppins-ExtraBold',
  },
  planModalPriceTRY: {
    fontSize: 16,
    color: '#94a3b8',
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
  },
  planModalDescription: {
    fontSize: 15,
    color: '#94a3b8',
    lineHeight: 22,
    fontFamily: 'Poppins-Regular',
  },
  planModalFeaturesSection: {
    gap: 12,
  },
  planModalFeaturesTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
    fontFamily: 'Poppins-Bold',
  },
  planModalFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  planModalFeatureText: {
    fontSize: 15,
    color: '#e2e8f0',
    flex: 1,
    fontFamily: 'Poppins-Regular',
  },
  planModalFeatureTextRecommended: {
    color: 'rgba(255,255,255,0.9)',
  },
  planModalCurrentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#10b981',
    marginTop: 8,
  },
  planModalCurrentButtonText: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'Poppins-Bold',
  },
  planModalUpgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    backgroundColor: '#7c3aed',
    borderRadius: 14,
    marginTop: 8,
  },
  planModalUpgradeButtonRecommended: {
    backgroundColor: '#fff',
  },
  planModalUpgradeButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '900',
    fontFamily: 'Poppins-ExtraBold',
  },
  planModalUpgradeButtonTextRecommended: {
    color: '#7c3aed',
  },

  // Scroll to Top Button
  scrollToTopButton: {
    position: 'absolute',
    bottom: 130, // User preference
    right: 20,
    zIndex: 9999,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(15, 23, 42, 0.65)', // Semi-transparent dark bg
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden', // Ensure water stays inside circle from outside perspective
  },
  scrollToTopPressable: {
    flex: 1,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    // Removed overflow:hidden here since container has it, but safe to keep or remove.
  },
  liquidContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
    overflow: 'hidden', // Critical for masking the square waves into a circle
  },
  liquidWave: {
    width: 150, // Much larger for smoother wave
    height: 150,
    borderRadius: 60, // 40% radius for good squircle shape
    position: 'absolute',
    top: -5, // Adjust water level (higher top = lower water)
    left: -45, // Center horizontally relative to button center (60/2 - 150/2 = -45)
    // backgroundColor handled by gradient or style
  },
  liquidWaveBack: {
    backgroundColor: 'rgba(6, 182, 212, 0.4)', // Lighter, transparent teal
    width: 160, // Slightly simpler/different size for variation
    height: 160,
    borderRadius: 65,
    top: -10,
    left: -50,
  },
  liquidIconContainer: {
    zIndex: 10,
    shadowColor: 'rgba(0,0,0,0.3)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  // Legacy styles removed
  scrollToTopGradient: {},
  scrollToTopGlow: {},

});
