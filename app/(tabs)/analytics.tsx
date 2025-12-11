import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NetworkStatusIcon } from '../../components/NetworkStatusIcon';
import { useToast } from '../../components/Toast';
import { authFetch } from '../../utils/auth';

const { width } = Dimensions.get('window');

interface AnalyticsData {
  summary: {
    totalLocations: number;
    totalDistance: number;
    totalTime: number;
    averageSpeed: number;
    maxSpeed: number;
    activeDays: number;
    averageDailyDistance: number;
    topSpeedZone: string;
    mostActiveHour: number;
    mostActiveDay: string;
  };
  timeSeries: Array<{
    date: string;
    distance: number;
    locations: number;
    averageSpeed: number;
  }>;
  speedZones: Array<{
    zone: string;
    duration: number;
    percentage: number;
    distance: number;
  }>;
  activityPatterns: {
    hourly: Array<{ hour: number; count: number }>;
    daily: Array<{ day: string; count: number }>;
    weekly: Array<{ week: string; count: number }>;
  };
  routeMetrics: {
    totalRoutes: number;
    averageRouteDistance: number;
    longestRoute: number;
    shortestRoute: number;
    averageRouteDuration: number;
  };
  quality: {
    accuracy: number;
    reliability: number;
    consistency: number;
    gpsQuality: string;
  };
  predictions: {
    estimatedDailyDistance: number;
    estimatedWeeklyDistance: number;
    trend: 'up' | 'down' | 'stable';
    confidence: number;
  };
  insights: Array<{
    type: 'info' | 'warning' | 'success';
    message: string;
    icon: string;
  }>;
  header?: {
    userName?: string;
    planId?: string;
    planName?: string;
    totalStats?: {
      locations: number;
      distance: number;
      activeDays: number;
    };
  };
}

export default function AnalyticsScreen() {
  const router = useRouter();
  const { showError } = useToast();
  
  const [fontsLoaded] = useFonts({
    'Poppins-Black': require('../assets/Poppins-Black.ttf'),
    'Poppins-BlackItalic': require('../assets/Poppins-BlackItalic.ttf'),
    'Poppins-Bold': require('../assets/Poppins-Bold.ttf'),
    'Poppins-BoldItalic': require('../assets/Poppins-BoldItalic.ttf'),
    'Poppins-ExtraBold': require('../assets/Poppins-ExtraBold.ttf'),
    'Poppins-ExtraBoldItalic': require('../assets/Poppins-ExtraBoldItalic.ttf'),
    'Poppins-ExtraLight': require('../assets/Poppins-ExtraLight.ttf'),
    'Poppins-ExtraLightItalic': require('../assets/Poppins-ExtraLightItalic.ttf'),
    'Poppins-Italic': require('../assets/Poppins-Italic.ttf'),
    'Poppins-Light': require('../assets/Poppins-Light.ttf'),
    'Poppins-LightItalic': require('../assets/Poppins-LightItalic.ttf'),
    'Poppins-Medium': require('../assets/Poppins-Medium.ttf'),
    'Poppins-MediumItalic': require('../assets/Poppins-MediumItalic.ttf'),
    'Poppins-Regular': require('../assets/Poppins-Regular.ttf'),
    'Poppins-SemiBold': require('../assets/Poppins-SemiBold.ttf'),
    'Poppins-SemiBoldItalic': require('../assets/Poppins-SemiBoldItalic.ttf'),
    'Poppins-Thin': require('../assets/Poppins-Thin.ttf'),
    'Poppins-ThinItalic': require('../assets/Poppins-ThinItalic.ttf'),
  });

  const [refreshing, setRefreshing] = React.useState(false);
  const [, setUserId] = React.useState('');
  const [deviceId, setDeviceId] = React.useState('');
  const [dateRange, setDateRange] = React.useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [analytics, setAnalytics] = React.useState<AnalyticsData | null>(null);
  const [selectedTab, setSelectedTab] = React.useState<'overview' | 'routes' | 'patterns' | 'quality'>('overview');
  const [userName, setUserName] = React.useState('Kullanıcı');
  const [, setPlanName] = React.useState('Free');
  
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(20)).current;

  React.useEffect(() => {
    if (fontsLoaded) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [fontsLoaded]);

  React.useEffect(() => {
    loadUserData();
  }, []);

  React.useEffect(() => {
    if (deviceId) {
      const timeoutId = setTimeout(() => {
        loadAnalytics();
      }, 300);
      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [deviceId, dateRange]);

  const loadUserData = React.useCallback(async () => {
    try {
      const storedUserId = await SecureStore.getItemAsync('workerId');
      const storedDeviceId = await SecureStore.getItemAsync('deviceId');
      
      if (storedUserId) {
        setUserId(storedUserId);
        setDeviceId(storedDeviceId || storedUserId);
      } else {
        const newId = `user-${Platform.OS}-${Date.now()}`;
        await SecureStore.setItemAsync('workerId', newId);
        setUserId(newId);
        setDeviceId(newId);
      }
    } catch (error) {
      console.error('[Analytics] Load user data error:', error);
    }
  }, []);

  const loadAnalytics = React.useCallback(async () => {
    if (!deviceId) return;
    
    try {
      setRefreshing(true);
      const params = new URLSearchParams({
        dateRange,
        includeTimeSeries: 'true',
        includePatterns: 'true',
        includePredictions: 'true',
        includeHeader: 'true'
      });

      const url = `/location/analytics/advanced?deviceId=${encodeURIComponent(deviceId)}&${params.toString()}`;
      const res = await authFetch(url);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errorMessage = errorData.error || errorData.message || `HTTP ${res.status}: ${res.statusText}`;
        
        if (res.status === 429) {
          const retryAfter = errorData.retryAfter || 30;
          showError(`Çok fazla istek. ${retryAfter} saniye sonra tekrar deneyin.`);
          return;
        }
        
        throw new Error(errorMessage);
      }

      const data = await res.json();
      if (data.success && data.data) {
        setAnalytics(data.data);
        if (data.data.header) {
          setUserName(data.data.header.userName || 'Kullanıcı');
          setPlanName(data.data.header.planName || 'Free');
        }
      } else {
        throw new Error(data.error || 'Analitik verisi alınamadı');
      }
    } catch (error: any) {
      console.error('[Analytics] Load error:', error);
      const errorMessage = error.message || 'Analitik yüklenemedi';
      if (errorMessage.includes('Endpoint not found') || errorMessage.includes('404')) {
        showError('Analitik servisi şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.');
      } else if (!errorMessage.includes('Çok fazla istek')) {
        showError(errorMessage);
      }
    } finally {
      setRefreshing(false);
    }
  }, [deviceId, dateRange, showError]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await loadAnalytics();
  }, [loadAnalytics]);

  const formatDistance = (meters: number): string => {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(2)} km`;
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}s ${minutes}d`;
    return `${minutes} dk`;
  };

  const formatSpeed = (ms: number): string => {
    const kmh = ms * 3.6;
    return `${kmh.toFixed(1)} km/h`;
  };


  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />
      
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <LinearGradient colors={["#8b5cf6", "#6366f1"]} style={styles.header} start={[0, 0]} end={[1, 1]}>
          <View style={styles.headerTop}>
            <View style={styles.headerTextBlock}>
              <Text style={styles.brandLabel}>BAVAXE PLATFORMU</Text>
              <Text style={styles.headerTitle}>Gelişmiş Analitik</Text>
              <Text style={styles.headerSubtitle}>Hoş Geldin, {userName}</Text>
            </View>
            <View style={styles.headerActions}>
              <NetworkStatusIcon size={20} />
            </View>
          </View>

          <View style={styles.dateRangeSelector}>
            {(['7d', '30d', '90d', 'all'] as const).map((range) => (
              <Pressable
                key={range}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setDateRange(range);
                }}
                style={({ pressed }) => [
                  styles.dateRangeButton,
                  dateRange === range && styles.dateRangeButtonActive,
                  pressed && styles.dateRangeButtonPressed
                ]}
              >
                <Text style={[
                  styles.dateRangeText,
                  dateRange === range && styles.dateRangeTextActive
                ]}>
                  {range === '7d' ? '7 Gün' : range === '30d' ? '30 Gün' : range === '90d' ? '90 Gün' : 'Tümü'}
                </Text>
              </Pressable>
            ))}
          </View>
        </LinearGradient>
      </Animated.View>

      <ScrollView 
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor="#8b5cf6"
            colors={['#8b5cf6']}
          />
        }
      >
        {!analytics || !analytics.summary || analytics.summary.totalLocations < 2 ? (
          <View style={styles.emptyState}>
            <LinearGradient
              colors={['rgba(139, 92, 246, 0.2)', 'rgba(99, 102, 241, 0.1)']}
              style={styles.emptyIconWrapper}
            >
              <Ionicons name="analytics-outline" size={64} color="#8b5cf6" />
            </LinearGradient>
            <Text style={styles.emptyTitle}>Yetersiz Konum Verisi</Text>
            <Text style={styles.emptySubtitle}>
              Analitik için en az 2 geçerli konum kaydı gereklidir. Konum takibini başlatarak veri toplamaya başlayın.
            </Text>
            <Pressable 
              onPress={() => router.push('/(tabs)/track')}
              style={({ pressed }) => [
                styles.emptyButton,
                pressed && styles.emptyButtonPressed
              ]}
            >
              <LinearGradient
                colors={['#8b5cf6', '#6366f1']}
                style={styles.emptyButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="navigate" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.emptyButtonText}>Takibi Başlat</Text>
              </LinearGradient>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.tabSelector}>
              {[
                { id: 'overview', label: 'Genel Bakış', icon: 'stats-chart' },
                { id: 'routes', label: 'Rotalar', icon: 'map' },
                { id: 'patterns', label: 'Paternler', icon: 'time' },
                { id: 'quality', label: 'Kalite', icon: 'checkmark-circle' }
              ].map((tab) => (
                <Pressable
                  key={tab.id}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedTab(tab.id as any);
                  }}
                  style={({ pressed }) => [
                    styles.tabButton,
                    selectedTab === tab.id && styles.tabButtonActive,
                    pressed && styles.tabButtonPressed
                  ]}
                >
                  <Ionicons 
                    name={tab.icon as any} 
                    size={16} 
                    color={selectedTab === tab.id ? '#fff' : '#94a3b8'} 
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[
                    styles.tabText,
                    selectedTab === tab.id && styles.tabTextActive
                  ]}>
                    {tab.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {selectedTab === 'overview' && analytics.summary && (
              <View style={styles.content}>
                <View style={styles.statsGrid}>
                  <View style={styles.statCard}>
                    <LinearGradient
                      colors={['rgba(139, 92, 246, 0.2)', 'rgba(139, 92, 246, 0.1)']}
                      style={styles.statCardGradient}
                    >
                      <Ionicons name="location" size={28} color="#8b5cf6" />
                      <Text style={styles.statValue}>
                        {analytics.summary.totalLocations > 0 
                          ? analytics.summary.totalLocations.toLocaleString() 
                          : '0'}
                      </Text>
                      <Text style={styles.statLabel}>Geçerli Konum Kaydı</Text>
                    </LinearGradient>
                  </View>

                  <View style={styles.statCard}>
                    <LinearGradient
                      colors={['rgba(16, 185, 129, 0.2)', 'rgba(16, 185, 129, 0.1)']}
                      style={styles.statCardGradient}
                    >
                      <Ionicons name="navigate" size={28} color="#10b981" />
                      <Text style={styles.statValue}>{formatDistance(analytics.summary.totalDistance)}</Text>
                      <Text style={styles.statLabel}>Toplam Mesafe</Text>
                    </LinearGradient>
                  </View>

                  <View style={styles.statCard}>
                    <LinearGradient
                      colors={['rgba(245, 158, 11, 0.2)', 'rgba(245, 158, 11, 0.1)']}
                      style={styles.statCardGradient}
                    >
                      <Ionicons name="speedometer" size={28} color="#f59e0b" />
                      <Text style={styles.statValue}>{formatSpeed(analytics.summary.averageSpeed)}</Text>
                      <Text style={styles.statLabel}>Ortalama Hız</Text>
                    </LinearGradient>
                  </View>

                  <View style={styles.statCard}>
                    <LinearGradient
                      colors={['rgba(239, 68, 68, 0.2)', 'rgba(239, 68, 68, 0.1)']}
                      style={styles.statCardGradient}
                    >
                      <Ionicons name="flash" size={28} color="#ef4444" />
                      <Text style={styles.statValue}>{formatSpeed(analytics.summary.maxSpeed)}</Text>
                      <Text style={styles.statLabel}>Maksimum Hız</Text>
                    </LinearGradient>
                  </View>
                </View>

                {analytics.summary.totalLocations >= 10 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Özet İstatistikler</Text>
                    <View style={styles.summaryCard}>
                      <View style={styles.summaryRow}>
                        <Ionicons name="calendar" size={20} color="#8b5cf6" />
                        <Text style={styles.summaryLabel}>Aktif Günler</Text>
                        <Text style={styles.summaryValue}>{analytics.summary.activeDays} gün</Text>
                      </View>
                      {analytics.summary.averageDailyDistance > 0 && (
                        <View style={styles.summaryRow}>
                          <Ionicons name="trending-up" size={20} color="#10b981" />
                          <Text style={styles.summaryLabel}>Günlük Ortalama</Text>
                          <Text style={styles.summaryValue}>{formatDistance(analytics.summary.averageDailyDistance)}</Text>
                        </View>
                      )}
                      {analytics.summary.totalLocations >= 20 && (
                        <>
                          <View style={styles.summaryRow}>
                            <Ionicons name="time" size={20} color="#f59e0b" />
                            <Text style={styles.summaryLabel}>En Aktif Saat</Text>
                            <Text style={styles.summaryValue}>{analytics.summary.mostActiveHour}:00</Text>
                          </View>
                          <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
                            <Ionicons name="calendar-outline" size={20} color="#7c3aed" />
                            <Text style={styles.summaryLabel}>En Aktif Gün</Text>
                            <Text style={styles.summaryValue}>{analytics.summary.mostActiveDay}</Text>
                          </View>
                        </>
                      )}
                    </View>
                  </View>
                )}

                {analytics.summary.totalLocations >= 10 && analytics.insights && analytics.insights.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Öngörüler</Text>
                    {analytics.insights.map((insight, idx) => (
                      <View key={idx} style={styles.insightCard}>
                        <Ionicons 
                          name={insight.icon as any} 
                          size={24} 
                          color={
                            insight.type === 'warning' ? '#f59e0b' :
                            insight.type === 'success' ? '#10b981' : '#8b5cf6'
                          } 
                        />
                        <Text style={styles.insightText}>{insight.message}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {analytics.summary.totalLocations >= 20 && analytics.predictions && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Tahminler</Text>
                    <View style={styles.predictionCard}>
                      <LinearGradient
                        colors={['rgba(16, 185, 129, 0.2)', 'rgba(16, 185, 129, 0.1)']}
                        style={styles.predictionGradient}
                      >
                        <Ionicons 
                          name={analytics.predictions.trend === 'up' ? 'trending-up' : analytics.predictions.trend === 'down' ? 'trending-down' : 'remove'} 
                          size={32} 
                          color="#10b981" 
                        />
                        <View style={styles.predictionContent}>
                          <Text style={styles.predictionLabel}>Tahmini Günlük Mesafe</Text>
                          <Text style={styles.predictionValue}>
                            {formatDistance(analytics.predictions.estimatedDailyDistance)}
                          </Text>
                          <Text style={styles.predictionConfidence}>
                            Güven: %{analytics.predictions.confidence}
                          </Text>
                        </View>
                      </LinearGradient>
                    </View>
                  </View>
                )}
              </View>
            )}

            {selectedTab === 'routes' && analytics.summary.totalLocations >= 10 && analytics.routeMetrics && (
              <View style={styles.content}>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Rota Metrikleri</Text>
                  <View style={styles.metricsGrid}>
                    <View style={styles.metricCard}>
                      <Ionicons name="map" size={24} color="#8b5cf6" />
                      <Text style={styles.metricValue}>{analytics.routeMetrics.totalRoutes}</Text>
                      <Text style={styles.metricLabel}>Toplam Rota</Text>
                    </View>
                    <View style={styles.metricCard}>
                      <Ionicons name="navigate" size={24} color="#10b981" />
                      <Text style={styles.metricValue}>{formatDistance(analytics.routeMetrics.averageRouteDistance)}</Text>
                      <Text style={styles.metricLabel}>Ortalama Mesafe</Text>
                    </View>
                    <View style={styles.metricCard}>
                      <Ionicons name="arrow-up" size={24} color="#f59e0b" />
                      <Text style={styles.metricValue}>{formatDistance(analytics.routeMetrics.longestRoute)}</Text>
                      <Text style={styles.metricLabel}>En Uzun Rota</Text>
                    </View>
                    <View style={styles.metricCard}>
                      <Ionicons name="arrow-down" size={24} color="#ef4444" />
                      <Text style={styles.metricValue}>{formatDistance(analytics.routeMetrics.shortestRoute)}</Text>
                      <Text style={styles.metricLabel}>En Kısa Rota</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {selectedTab === 'routes' && analytics.summary.totalLocations < 10 && (
              <View style={styles.emptyState}>
                <Ionicons name="map-outline" size={64} color="#64748b" />
                <Text style={styles.emptyTitle}>Rota Verisi Yok</Text>
                <Text style={styles.emptySubtitle}>
                  Rota analizi için en az 10 geçerli konum kaydı gereklidir.
                </Text>
              </View>
            )}

            {selectedTab === 'patterns' && analytics.summary.totalLocations >= 20 && analytics.activityPatterns && (
              <View style={styles.content}>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Aktivite Paternleri</Text>
                  
                  {analytics.activityPatterns.hourly && analytics.activityPatterns.hourly.length > 0 && (
                    <View style={styles.patternCard}>
                      <Text style={styles.patternTitle}>Saatlik Dağılım</Text>
                      <View style={styles.patternBars}>
                        {analytics.activityPatterns.hourly.map((item, idx) => {
                          const maxCount = Math.max(...analytics.activityPatterns.hourly.map(h => h.count));
                          const height = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                          return (
                            <View key={idx} style={styles.patternBarContainer}>
                              <View style={[styles.patternBar, { height: `${Math.max(height, 5)}%` }]} />
                              <Text style={styles.patternBarLabel}>{item.hour}</Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {analytics.activityPatterns.daily && analytics.activityPatterns.daily.length > 0 && (
                    <View style={styles.patternCard}>
                      <Text style={styles.patternTitle}>Günlük Dağılım</Text>
                      {analytics.activityPatterns.daily.map((item, idx) => (
                        <View key={idx} style={styles.patternRow}>
                          <Text style={styles.patternDay}>{item.day}</Text>
                          <View style={styles.patternProgressContainer}>
                            <View style={[styles.patternProgress, { width: `${(item.count / Math.max(...analytics.activityPatterns.daily.map(d => d.count))) * 100}%` }]} />
                          </View>
                          <Text style={styles.patternCount}>{item.count}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            )}

            {selectedTab === 'patterns' && analytics.summary.totalLocations < 20 && (
              <View style={styles.emptyState}>
                <Ionicons name="time-outline" size={64} color="#64748b" />
                <Text style={styles.emptyTitle}>Patern Verisi Yok</Text>
                <Text style={styles.emptySubtitle}>
                  Aktivite paternleri için en az 20 geçerli konum kaydı gereklidir.
                </Text>
              </View>
            )}

            {selectedTab === 'quality' && analytics.summary.totalLocations >= 10 && analytics.quality && (
              <View style={styles.content}>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>GPS Kalitesi</Text>
                  <View style={styles.qualityCard}>
                    <View style={styles.qualityRow}>
                      <Ionicons name="locate" size={24} color="#8b5cf6" />
                      <Text style={styles.qualityLabel}>Doğruluk</Text>
                      <View style={styles.qualityBarContainer}>
                        <View style={[styles.qualityBar, { width: `${analytics.quality.accuracy}%` }]} />
                      </View>
                      <Text style={styles.qualityValue}>%{analytics.quality.accuracy}</Text>
                    </View>
                    <View style={styles.qualityRow}>
                      <Ionicons name="shield-checkmark" size={24} color="#10b981" />
                      <Text style={styles.qualityLabel}>Güvenilirlik</Text>
                      <View style={styles.qualityBarContainer}>
                        <View style={[styles.qualityBar, styles.qualityBarSuccess, { width: `${analytics.quality.reliability}%` }]} />
                      </View>
                      <Text style={styles.qualityValue}>%{analytics.quality.reliability}</Text>
                    </View>
                    <View style={styles.qualityRow}>
                      <Ionicons name="sync" size={24} color="#f59e0b" />
                      <Text style={styles.qualityLabel}>Tutarlılık</Text>
                      <View style={styles.qualityBarContainer}>
                        <View style={[styles.qualityBar, styles.qualityBarWarning, { width: `${analytics.quality.consistency}%` }]} />
                      </View>
                      <Text style={styles.qualityValue}>%{analytics.quality.consistency}</Text>
                    </View>
                    <View style={styles.qualityBadge}>
                      <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                      <Text style={styles.qualityBadgeText}>{analytics.quality.gpsQuality}</Text>
                    </View>
                  </View>
                </View>

                {analytics.speedZones && analytics.speedZones.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Hız Bölgeleri</Text>
                    {analytics.speedZones.map((zone, idx) => (
                      <View key={idx} style={styles.zoneCard}>
                        <View style={styles.zoneHeader}>
                          <Ionicons 
                            name={
                              zone.zone === 'parked' ? 'stop-circle' :
                              zone.zone === 'walking' ? 'walk' :
                              zone.zone === 'driving' ? 'car' : 'speedometer'
                            } 
                            size={24} 
                            color="#8b5cf6" 
                          />
                          <Text style={styles.zoneName}>
                            {zone.zone === 'parked' ? 'Park Halinde' :
                             zone.zone === 'walking' ? 'Yürüme' :
                             zone.zone === 'driving' ? 'Sürüş' : zone.zone}
                          </Text>
                        </View>
                        <View style={styles.zoneStats}>
                          <View style={styles.zoneStat}>
                            <Text style={styles.zoneStatValue}>%{zone.percentage.toFixed(1)}</Text>
                            <Text style={styles.zoneStatLabel}>Süre</Text>
                          </View>
                          <View style={styles.zoneStat}>
                            <Text style={styles.zoneStatValue}>{formatDistance(zone.distance)}</Text>
                            <Text style={styles.zoneStatLabel}>Mesafe</Text>
                          </View>
                          <View style={styles.zoneStat}>
                            <Text style={styles.zoneStatValue}>{formatDuration(zone.duration)}</Text>
                            <Text style={styles.zoneStatLabel}>Toplam</Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {selectedTab === 'quality' && analytics.summary.totalLocations < 10 && (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-circle-outline" size={64} color="#64748b" />
                <Text style={styles.emptyTitle}>Kalite Verisi Yok</Text>
                <Text style={styles.emptySubtitle}>
                  GPS kalite analizi için en az 10 geçerli konum kaydı gereklidir.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0f172a'
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a'
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 14,
    fontFamily: 'Poppins-Regular'
  },
  header: {
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 20 : 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  headerTextBlock: {
    flex: 1
  },
  brandLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontFamily: 'Poppins-Bold',
    marginBottom: 4
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.5,
    fontFamily: 'Poppins-ExtraBold'
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold'
  },
  dateRangeSelector: {
    flexDirection: 'row',
    gap: 8
  },
  dateRangeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  dateRangeButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.25)'
  },
  dateRangeButtonPressed: {
    transform: [{ scale: 0.95 }]
  },
  dateRangeText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Poppins-Bold'
  },
  dateRangeTextActive: {
    color: '#fff'
  },
  scroll: {
    flex: 1
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32
  },
  emptyIconWrapper: {
    width: 120,
    height: 120,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
    marginTop: 20,
    marginBottom: 8,
    fontFamily: 'Poppins-Bold'
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
    fontFamily: 'Poppins-Regular'
  },
  emptyButton: {
    borderRadius: 16,
    overflow: 'hidden'
  },
  emptyButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }]
  },
  emptyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 16
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'Poppins-Bold'
  },
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155'
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12
  },
  tabButtonActive: {
    backgroundColor: '#0f172a'
  },
  tabButtonPressed: {
    opacity: 0.8
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    fontFamily: 'Poppins-Bold'
  },
  tabTextActive: {
    color: '#fff'
  },
  content: {
    gap: 16
  },
  section: {
    marginBottom: 20
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 12,
    fontFamily: 'Poppins-ExtraBold'
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  statCard: {
    width: (width - 44) / 2,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155'
  },
  statCardGradient: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
    marginTop: 8,
    marginBottom: 4,
    fontFamily: 'Poppins-ExtraBold'
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'Poppins-Medium'
  },
  summaryCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155'
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155'
  },
  summaryLabel: {
    flex: 1,
    fontSize: 14,
    color: '#e2e8f0',
    marginLeft: 12,
    fontFamily: 'Poppins-Medium'
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
    fontFamily: 'Poppins-Bold'
  },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155'
  },
  insightText: {
    flex: 1,
    fontSize: 13,
    color: '#e2e8f0',
    marginLeft: 12,
    fontFamily: 'Poppins-Regular'
  },
  predictionCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155'
  },
  predictionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20
  },
  predictionContent: {
    flex: 1,
    marginLeft: 16
  },
  predictionLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
    fontFamily: 'Poppins-Medium'
  },
  predictionValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 4,
    fontFamily: 'Poppins-ExtraBold'
  },
  predictionConfidence: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'Poppins-Regular'
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  metricCard: {
    width: (width - 44) / 2,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155'
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fff',
    marginTop: 8,
    marginBottom: 4,
    fontFamily: 'Poppins-ExtraBold'
  },
  metricLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontFamily: 'Poppins-Regular'
  },
  patternCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155'
  },
  patternTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 16,
    fontFamily: 'Poppins-Bold'
  },
  patternBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 120,
    marginBottom: 8
  },
  patternBarContainer: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end'
  },
  patternBar: {
    width: '80%',
    backgroundColor: '#8b5cf6',
    borderRadius: 4,
    marginBottom: 4
  },
  patternBarLabel: {
    fontSize: 9,
    color: '#94a3b8',
    fontFamily: 'Poppins-Regular'
  },
  patternRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  patternDay: {
    width: 60,
    fontSize: 12,
    color: '#e2e8f0',
    fontFamily: 'Poppins-Medium'
  },
  patternProgressContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#0f172a',
    borderRadius: 4,
    marginHorizontal: 12,
    overflow: 'hidden'
  },
  patternProgress: {
    height: '100%',
    backgroundColor: '#8b5cf6',
    borderRadius: 4
  },
  patternCount: {
    width: 40,
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'right',
    fontFamily: 'Poppins-Bold'
  },
  qualityCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155'
  },
  qualityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16
  },
  qualityLabel: {
    width: 100,
    fontSize: 14,
    color: '#e2e8f0',
    marginLeft: 12,
    fontFamily: 'Poppins-Medium'
  },
  qualityBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#0f172a',
    borderRadius: 4,
    marginHorizontal: 12,
    overflow: 'hidden'
  },
  qualityBar: {
    height: '100%',
    backgroundColor: '#8b5cf6',
    borderRadius: 4
  },
  qualityBarSuccess: {
    backgroundColor: '#10b981'
  },
  qualityBarWarning: {
    backgroundColor: '#f59e0b'
  },
  qualityValue: {
    width: 50,
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'right',
    fontFamily: 'Poppins-Bold'
  },
  qualityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.2)'
  },
  qualityBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10b981',
    marginLeft: 8,
    fontFamily: 'Poppins-Bold'
  },
  zoneCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155'
  },
  zoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  zoneName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    marginLeft: 12,
    fontFamily: 'Poppins-Bold'
  },
  zoneStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155'
  },
  zoneStat: {
    alignItems: 'center'
  },
  zoneStatValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 4,
    fontFamily: 'Poppins-ExtraBold'
  },
  zoneStatLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontFamily: 'Poppins-Regular'
  }
});
