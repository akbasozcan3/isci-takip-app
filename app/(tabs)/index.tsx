import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import {
  ActivityIndicator,
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
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { io, Socket } from 'socket.io-client';
import { Toast, useToast } from '../../components/Toast';
import { getApiBase } from '../../utils/api';
import { getToken } from '../../utils/auth';

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
  { id: 'admin', title: 'Yönetim', icon: 'shield-checkmark-outline', route: '/(tabs)/admin', color: '#f59e0b' },
  { id: 'settings', title: 'Ayarlar', icon: 'settings-outline', route: '/(tabs)/settings', color: '#64748b' },
];
export default function HomeScreen(): React.JSX.Element {
  const router = useRouter();
  const { toast, showError, showSuccess, showWarning, showInfo, hideToast } = useToast();

  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [userName, setUserName] = React.useState('Ekip Üyesi');
  const [userId, setUserId] = React.useState('');
  const [stats, setStats] = React.useState<DashboardStats>({ activeWorkers: 0, totalGroups: 0, todayDistance: 0, activeAlerts: 0 });
  const [activities, setActivities] = React.useState<RecentActivity[]>([]);
  const [hasLocationPermission, setHasLocationPermission] = React.useState(false);
  const [hidePermissionBanner, setHidePermissionBanner] = React.useState(false);
  const [currentSlide, setCurrentSlide] = React.useState(0);
  const [showLightbox, setShowLightbox] = React.useState(false);
  const [lightboxImage, setLightboxImage] = React.useState<string | null>(null);
  const [articles, setArticles] = React.useState<Article[]>([]);
  const socketRef = React.useRef<Socket | null>(null);

  // Animations
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideX = React.useRef(new Animated.Value(0)).current;
  const cardScale = React.useRef(new Animated.Value(1)).current;
  const lightboxScale = React.useRef(new Animated.Value(0)).current;

  // Slider auto-play
  const sliderRef = React.useRef<FlatList>(null);
  const autoPlayRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Fetch articles from backend
  React.useEffect(() => {
    const fetchArticles = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/articles`);
        const data = await response.json();
        if (Array.isArray(data)) {
          setArticles(data.slice(0, 3)); // Only show top 3 on home
        }
      } catch (error) {
        console.error('Error fetching articles:', error);
      }
    };
    fetchArticles();
  }, []);

  React.useEffect(() => {
    let mounted = true;
    
    const init = async () => {
      try {
        await checkAuth();
        
        if (mounted) {
          Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }).start();
        }
      } catch (e) {
        console.error('Init error:', e);
        if (mounted) {
          setLoading(false);
        }
      }
    };
    
    init();

    // Listen for settings -> clear data to clear recent activities immediately
    const sub = DeviceEventEmitter.addListener('clearRecentActivities', () => {
      setActivities([]);
    });
    
    return () => {
      mounted = false;
      sub.remove?.();
    }; 
  }, []);
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

  // Load permission banner preference
  React.useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem('hide_permission_banner');
        if (v === '1') setHidePermissionBanner(true);
      } catch {}
    })();
  }, []);

  // Realtime: listen for group deletion and refresh dashboard
  React.useEffect(() => {
    let mounted = true;
    if (!isAuthenticated || !userId) {
      // cleanup existing socket if auth lost
      if (socketRef.current) {
        try { socketRef.current.off(); socketRef.current.disconnect(); } catch {}
        socketRef.current = null;
      }
      return;
    }

    const setup = async () => {
      try {
        // fetch active groups to know which rooms to join
        const res = await fetch(`${API_BASE}/api/groups/user/${userId}/active`);
        const groups = res.ok ? await res.json() : [];
        const groupIds: string[] = (groups || []).map((g: any) => g.id);

        const s = io(API_BASE, {
          transports: ['websocket'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
        });
        socketRef.current = s;

        const joinAll = () => {
          try { groupIds.forEach(id => s.emit('join_group', id)); } catch {}
        };

        s.on('connect', joinAll);
        s.on('reconnect', joinAll);
        s.on('group_deleted', (ev: { groupId: string }) => {
          try {
            if (!ev || !ev.groupId) return;
            // Clear activities and refresh stats
            setActivities([]);
            onRefresh();
            showWarning?.('Bir grup silindi. Gösterge paneli güncellendi.');
          } catch {}
        });

        s.on('connect_error', () => {/* ignore */});
      } catch (e) {
        // ignore
      }
    };

    setup();

    return () => {
      mounted = false;
      if (socketRef.current) {
        try { socketRef.current.off(); socketRef.current.disconnect(); } catch {}
        socketRef.current = null;
      }
    };
  }, [isAuthenticated, userId]);

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
          try { socketRef.current.off(); socketRef.current.disconnect(); } catch {}
          socketRef.current = null;
        }
      } catch {}
    });
    return () => { sub.remove?.(); };
  }, []);

  const checkAuth = async () => {
    try {
      setLoading(true);
      
      const workerId = await SecureStore.getItemAsync('workerId');
      const displayName = await SecureStore.getItemAsync('displayName');

      if (workerId) {
        setIsAuthenticated(true);
        setUserId(workerId);
        if (displayName) setUserName(displayName);
        
        loadDashboardData(workerId).catch(e => console.error('Dashboard load failed:', e));

        try {
          const { status } = await Location.getForegroundPermissionsAsync();
          setHasLocationPermission(status === 'granted');
        } catch (e) {
          console.warn('Location permission check failed:', e);
          setHasLocationPermission(false);
        }
      } else {
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardData = async (workerIdParam?: string) => {
    try {
      const worker = workerIdParam || userId;
      if (!worker) return;

      // Token al
      let authHeaders: Record<string, string> = {};
      try {
        const t = await getToken();
        if (t) authHeaders['Authorization'] = `Bearer ${t}`;
      } catch (e) {
        console.warn('Token error:', e);
      }

      // Backend'den gerçek veri çek (timeout ile)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 saniye timeout

      try {
        const [statsRes, activitiesRes] = await Promise.all([
          fetch(`${API_BASE}/api/dashboard/${worker}`, { 
            headers: authHeaders,
            signal: controller.signal 
          }).catch(() => ({ ok: false, status: 404, json: async () => ({}) } as Response)),
          fetch(`${API_BASE}/api/activities?limit=10`, { 
            headers: authHeaders,
            signal: controller.signal 
          }).catch(() => ({ ok: false, status: 404, json: async () => ([]) } as Response)),
        ]);

        clearTimeout(timeoutId);

        // Stats güncelle
        if (statsRes.ok) {
          const data = await statsRes.json();
          setStats({
            activeWorkers: data.activeWorkers || 0,
            totalGroups: data.totalGroups || 0,
            todayDistance: data.todayDistance || 0,
            activeAlerts: data.activeAlerts || 0,
          });
          console.log('Dashboard stats loaded:', data);
        } else {
          console.warn('Stats fetch failed:', statsRes.status);
          setStats({ activeWorkers: 0, totalGroups: 0, todayDistance: 0, activeAlerts: 0 });
        }

        // Activities güncelle
        if (activitiesRes.ok) {
          const data = await activitiesRes.json();
          setActivities(data);
          console.log('Activities loaded:', data.length);
        } else {
          console.warn('Activities fetch failed:', activitiesRes.status);
          setActivities([]);
        }
      } catch (e: any) {
        clearTimeout(timeoutId);
        // AbortError'u sessizce handle et
        if (e.name !== 'AbortError') {
          console.error('Dashboard load error:', e);
        }
        // Fallback - backend yoksa bile çalışsın
        setStats({ activeWorkers: 0, totalGroups: 0, todayDistance: 0, activeAlerts: 0 });
        setActivities([]);
      }
    } catch (e) {
      console.error('Dashboard outer error:', e);
      setStats({ activeWorkers: 0, totalGroups: 0, todayDistance: 0, activeAlerts: 0 });
      setActivities([]);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData(userId);
    setRefreshing(false);
  };

  const handleLogin = () => router.push('/auth/login');
  const  handleRegister = () => router.push('/auth/register');

  const handleQuickAction = (route: string) => {
    Animated.sequence([
      Animated.timing(cardScale, { toValue: 0.96, duration: 90, useNativeDriver: true }),
      Animated.timing(cardScale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    router.push(route as any);
  };

  const openLightbox = (imageUrl: string) => {
    setLightboxImage(imageUrl);
    setShowLightbox(true);
    Animated.spring(lightboxScale, { toValue: 1, useNativeDriver: true, tension: 50 }).start();
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
      setHasLocationPermission(status === 'granted');
      if (status === 'granted') {
        showSuccess('Konum izni verildi');
        // Hide banner and persist choice
        setHidePermissionBanner(true);
        try { await AsyncStorage.setItem('hide_permission_banner', '1'); } catch {}
      }
    } catch (e) {
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

  // --- Activity item ---
  const ActivityItem: React.FC<{ item: RecentActivity }> = ({ item }) => (
    <View style={styles.activityRow}>
      <View style={[styles.activityCircle, { backgroundColor: getActivityColor(item.type) + '20' }]}>
        <Ionicons name={getActivityIcon(item.type) as any} size={18} color={getActivityColor(item.type)} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.activityMsg}>{item.message}</Text>
        <Text style={styles.activityTime}>{formatTimeAgo(item.timestamp)}</Text>
      </View>
    </View>
  );

  const getActivityIcon = (type: RecentActivity['type']) => {
    switch (type) {
      case 'location': return 'navigate';
      case 'join': return 'person-add';
      case 'alert': return 'warning';
      default: return 'information-circle';
    }
  };

  const getActivityColor = (type: RecentActivity['type']) => {
    switch (type) {
      case 'location': return '#06b6d4';
      case 'join': return '#10b981';
      case 'alert': return '#f59e0b';
      default: return '#64748b';
    }
  };

  // Map Home static blog cards to backend article ids (component scope)
  const mapCardToArticleId = (cardId: string): string => {
    const map: Record<string, string> = {
      a1: 'getting-started',
      a2: 'privacy-security',
      a3: 'battery-optimization',
      a4: 'group-management',
      a5: 'realtime-tracking',
      a6: 'reports-analytics',
      a7: 'offline-sync',
      a8: 'android-ios-tips',
      a9: 'security-checklist',
      a10: 'deployment',
      a11: 'monitoring-alerting',
      a12: 'getting-started',
    };
    return map[cardId] || 'getting-started';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#06b6d4" />
        <Text style={styles.loadingText}>Hazırlanıyor...</Text>
      </View>
    );
  }


  // --- Authenticated UI ---
  return (
    <SafeAreaView style={styles.container} edges={[ 'top' ]}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[ '#06b6d4', '#0ea5a4' ]} style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <View style={styles.headerTextBlock}>
              <Text style={styles.brandLabel}>BAVAXE PLATFORMU</Text>
              <Text style={styles.headerTitle}>Ana Sayfa</Text>
              <Text style={styles.headerSubtitle}>Hoş Geldin, {userName}</Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <Pressable 
              onPress={() => router.push('/blog')} 
              style={({ pressed }) => [
                styles.headerIconButton,
                pressed && styles.headerIconButtonPressed
              ]}
            >
              <Ionicons name="book-outline" size={20} color="#fff" />
            </Pressable>
            <Pressable 
              onPress={() => router.push('/notifications' as any)} 
              style={({ pressed }) => [
                styles.headerIconButton,
                pressed && styles.headerIconButtonPressed
              ]}
            >
              <Ionicons name="notifications-outline" size={20} color="#fff" />
            </Pressable>
            <Pressable 
              onPress={onRefresh} 
              style={({ pressed }) => [
                styles.headerIconButton,
                pressed && styles.headerIconButtonPressed,
                refreshing && styles.headerIconButtonDisabled
              ]}
              disabled={refreshing}
            >
              <Ionicons name="refresh-outline" size={20} color="#fff" />
            </Pressable>
            <Pressable 
              onPress={() => router.push('/(tabs)/settings')} 
              style={({ pressed }) => [
                styles.headerIconButton,
                styles.headerIconButtonSettings,
                pressed && styles.headerIconButtonPressed
              ]}
            >
              <Ionicons name="settings-outline" size={20} color="#fff" />
            </Pressable>
          </View>
        </View>
      </LinearGradient>

      <Animated.ScrollView contentContainerStyle={styles.scrollContent} style={{ opacity: fadeAnim }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#06b6d4" />}>

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
              <View key={i} style={[styles.smallDot, currentSlide === i && styles.smallDotActive]} />
            ))}
          </View>
        </View>

        {/* Permission banner */}
        {!hasLocationPermission && !hidePermissionBanner && (
          <View style={styles.permissionBanner}>
            <Ionicons name="location-outline" size={24} color="#f59e0b" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.permissionTitle}>Konum İzni Gerekli</Text>
              <Text style={styles.permissionText}>Takip özelliğini kullanmak için konum izni verin</Text>
            </View>
            <Pressable onPress={requestLocationPermission} style={styles.permissionButton} android_ripple={{ color: 'rgba(6,182,212,0.25)' }}><Text style={styles.permissionButtonText}>İzin Ver</Text></Pressable>
            <Pressable
              onPress={async () => { try { await AsyncStorage.setItem('hide_permission_banner', '1'); } catch {}; setHidePermissionBanner(true); }}
              style={{ marginLeft: 8, paddingHorizontal: 10, paddingVertical: 6 }}
              android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
            >
              <Text style={{ color: '#64748b', fontWeight: '700' }}>Gizle</Text>
            </Pressable>
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.shadow]}>
            <Ionicons name="people" size={20} color="#06b6d4" />
            <Text style={styles.statValue}>{stats.activeWorkers}</Text>
            <Text style={styles.statLabel}>Aktif İşçi</Text>
          </View>
          <View style={[styles.statCard, styles.shadow]}>
            <Ionicons name="albums" size={20} color="#7c3aed" />
            <Text style={styles.statValue}>{stats.totalGroups}</Text>
            <Text style={styles.statLabel}>Toplam Grup</Text>
          </View>
          <View style={[styles.statCard, styles.shadow]}>
            <Ionicons name="navigate" size={20} color="#10b981" />
            <Text style={styles.statValue}>{stats.todayDistance} km</Text>
            <Text style={styles.statLabel}>Bugün</Text>
          </View>
          <View style={[styles.statCard, styles.shadow]}>
            <Ionicons name="warning" size={20} color="#f59e0b" />
            <Text style={styles.statValue}>{stats.activeAlerts}</Text>
            <Text style={styles.statLabel}>Uyarılar</Text>
          </View>
        </View>

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
            {QUICK_ACTIONS.map((q, idx) => (
              <Pressable 
                key={q.id} 
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
                    <Ionicons name={q.icon as any} size={24} color="#fff" />
                  </LinearGradient>
                </View>
                <View style={styles.quickActionContent}>
                  <Text style={styles.quickActionTitle}>{q.title}</Text>
                  <View style={styles.quickActionArrow}>
                    <Ionicons name="arrow-forward" size={14} color="#64748b" />
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Recent activities */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Son Aktiviteler</Text>
            <Pressable onPress={onRefresh}><Ionicons name="refresh" size={18} color="#64748b" /></Pressable>
          </View>
          {activities.length === 0 ? (
            <View style={styles.emptyState}><Ionicons name="time-outline" size={48} color="#cbd5e1" /><Text style={styles.emptyText}>Henüz aktivite yok</Text></View>
          ) : (
            activities.map((a) => <ActivityItem key={a.id} item={a} />)
          )}
        </View>

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
                  style={[styles.blogCard, styles.shadow]}
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
          <View style={[styles.infoCard, styles.shadow]}>
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
            <View style={[styles.serviceCard, styles.shadow]}>
              <Ionicons name="location" size={32} color="#06b6d4" />
              <Text style={styles.serviceTitle}>Canlı Takip</Text>
              <Text style={styles.serviceDesc}>Gerçek zamanlı konum</Text>
            </View>
            <View style={[styles.serviceCard, styles.shadow]}>
              <Ionicons name="stats-chart" size={32} color="#7c3aed" />
              <Text style={styles.serviceTitle}>Raporlama</Text>
              <Text style={styles.serviceDesc}>Detaylı analizler</Text>
            </View>
            <View style={[styles.serviceCard, styles.shadow]}>
              <Ionicons name="people" size={32} color="#10b981" />
              <Text style={styles.serviceTitle}>Grup Yönetimi</Text>
              <Text style={styles.serviceDesc}>Ekip organizasyonu</Text>
            </View>
            <View style={[styles.serviceCard, styles.shadow]}>
              <Ionicons name="shield-checkmark" size={32} color="#f59e0b" />
              <Text style={styles.serviceTitle}>Güvenlik</Text>
              <Text style={styles.serviceDesc}>KVKK uyumlu</Text>
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

        <View style={{ height: 120 }} />
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
    </SafeAreaView>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
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

  // Scroll
  scrollContent: { paddingBottom: 10 },
  
  // Top Slider
  topSlider: { marginBottom: 20 },

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
  slideCard: { backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', marginHorizontal: 0, borderRadius: 20, padding: 24, alignItems: 'flex-start', justifyContent: 'center' },
  slideBadge: { width: 80, height: 80, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  slideTitle: { fontSize: 22, fontWeight: '900', color: '#fff', marginBottom: 8, letterSpacing: 0.5, fontFamily: 'Poppins-Bold' },
  slideDesc: { color: 'rgba(255,255,255,0.9)', fontSize: 15, lineHeight: 22, fontFamily: 'Poppins-Regular' },
  slideCTA: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  slideCTAText: { color: '#fff', fontWeight: '900', marginRight: 8, fontFamily: 'Poppins-Bold' },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  smallDot: { width: 8, height: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 6 },
  smallDotActive: { width: 32, backgroundColor: '#06b6d4' },

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
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20, paddingHorizontal: 20 },
  statCard: {
    flexBasis: '48%',
    maxWidth: '48%',
    backgroundColor: '#1e293b',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'flex-start',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  statValue: { fontSize: 24, fontWeight: '900', color: '#fff', marginTop: 10, letterSpacing: 0.3, fontFamily: 'Poppins-Bold' },
  statLabel: { color: '#94a3b8', marginTop: 6, fontSize: 13, fontWeight: '700', fontFamily: 'Poppins-SemiBold' },

  // Quick Actions - Professional
  section: { marginBottom: 20, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: 0.5, fontFamily: 'Poppins-Bold' },
  sectionBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4, 
    backgroundColor: 'rgba(6,182,212,0.1)', 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.2)',
  },
  sectionBadgeText: { fontSize: 12, fontWeight: '800', color: '#06b6d4', fontFamily: 'Poppins-ExtraBold' },
  quickGrid: { gap: 12 },
  quickActionCard: { 
    backgroundColor: '#1e293b', 
    borderRadius: 16, 
    padding: 16, 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#334155',
    marginBottom: 10,
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  quickActionIconWrapper: { 
    width: 60, 
    height: 60, 
    borderRadius: 14, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: 16,
  },
  quickActionIcon: { 
    width: 44, 
    height: 44, 
    borderRadius: 10, 
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
    fontSize: 17, 
    fontWeight: '900', 
    color: '#fff', 
    letterSpacing: 0.3,
    fontFamily: 'Poppins-Bold',
  },
  quickActionArrow: { 
    width: 28, 
    height: 28, 
    borderRadius: 8, 
    backgroundColor: '#334155', 
    alignItems: 'center', 
    justifyContent: 'center',
  },

  // Activities
  activityRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 14, 
    backgroundColor: '#1e293b', 
    borderRadius: 14, 
    padding: 14, 
    borderWidth: 1, 
    borderColor: '#334155',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activityCircle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  activityMsg: { fontWeight: '900', color: '#fff', fontSize: 15, fontFamily: 'Poppins-Bold' },
  activityTime: { color: '#64748b', marginTop: 6, fontSize: 13, fontWeight: '600', fontFamily: 'Poppins-SemiBold' },

  emptyState: { alignItems: 'center', padding: 40, backgroundColor: '#1e293b', borderRadius: 16, borderWidth: 1, borderColor: '#334155' },
  emptyText: { color: '#64748b', marginTop: 12, fontSize: 14, fontFamily: 'Poppins-Regular' },

  // Permission
  permissionBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 16, padding: 16, marginBottom: 18, marginHorizontal: 20, borderWidth: 1, borderColor: '#f59e0b' },
  permissionTitle: { fontSize: 15, fontWeight: '900', color: '#fff', marginBottom: 6, fontFamily: 'Poppins-Bold' },
  permissionText: { fontSize: 13, color: '#94a3b8', fontFamily: 'Poppins-Regular' },
  permissionButton: { backgroundColor: '#f59e0b', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  permissionButtonText: { fontSize: 13, fontWeight: '900', color: '#fff', fontFamily: 'Poppins-Bold' },

  // Article Card (authenticated)
  articleCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, alignItems: 'center' },

  // Blog Layout
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  seeAllText: { color: '#06b6d4', fontWeight: '900', fontSize: 14, fontFamily: 'Poppins-Bold' },
  blogCard: { 
    backgroundColor: '#1e293b', 
    borderRadius: 20, 
    marginBottom: 18, 
    overflow: 'hidden', 
    borderWidth: 1, 
    borderColor: '#334155',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  blogImageContainer: { position: 'relative', height: 200 },
  blogImagePlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  blogBadge: { position: 'absolute', top: 16, right: 16, backgroundColor: '#10b981', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  blogBadgeText: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  blogContent: { padding: 20 },
  blogTitle: { fontSize: 20, fontWeight: '900', color: '#fff', marginBottom: 10, letterSpacing: 0.3, fontFamily: 'Poppins-Bold' },
  blogExcerpt: { fontSize: 14, color: '#94a3b8', lineHeight: 22, marginBottom: 14, fontFamily: 'Poppins-Regular' },
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
    marginBottom: 20, 
    backgroundColor: '#1e293b', 
    borderRadius: 20, 
    padding: 24, 
    borderWidth: 1, 
    borderColor: '#334155',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  infoTitle: { fontSize: 22, fontWeight: '900', color: '#fff', marginBottom: 14, letterSpacing: 0.5 },
  infoCard: { backgroundColor: '#1e293b', borderRadius: 16, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: '#334155' },
  infoText: { fontSize: 15, color: '#94a3b8', lineHeight: 24, fontFamily: 'Poppins-Regular' },

  // Services
  servicesSection: { marginHorizontal: 20, marginBottom: 20 },
  servicesGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  serviceCard: { 
    width: '48%', 
    backgroundColor: '#1e293b', 
    borderRadius: 18, 
    padding: 20, 
    marginBottom: 14, 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#334155',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  serviceTitle: { fontSize: 16, fontWeight: '900', color: '#fff', marginTop: 10, textAlign: 'center', letterSpacing: 0.3, fontFamily: 'Poppins-Bold' },
  serviceDesc: { fontSize: 13, color: '#94a3b8', marginTop: 6, textAlign: 'center', fontFamily: 'Poppins-Regular' },

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
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  modernContactIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
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
    fontSize: 15,
    color: '#fff',
    fontWeight: '800',
    fontFamily: 'Poppins-ExtraBold',
  },
  modernContactArrow: {
    width: 36,
    height: 36,
    borderRadius: 12,
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
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
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
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
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

  // helpers
  shadow: {},
});
