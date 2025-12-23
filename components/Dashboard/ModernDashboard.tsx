import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  Animated,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, StatsCard, useTheme } from '../ui';

interface DashboardStats {
  activeWorkers: number;
  totalGroups: number;
  todayDistance: number;
  activeAlerts: number;
}

interface QuickAction {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
}

interface RecentActivity {
  id: string;
  type: 'location' | 'join' | 'alert' | 'system';
  message: string;
  timestamp: number;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

interface ModernDashboardProps {
  stats: DashboardStats;
  quickActions: QuickAction[];
  recentActivities: RecentActivity[];
  onRefresh?: () => Promise<void>;
  refreshing?: boolean;
}

export const ModernDashboard: React.FC<ModernDashboardProps> = ({
  stats,
  quickActions,
  recentActivities,
  onRefresh,
  refreshing = false,
}) => {
  const theme = useTheme();
  const scrollY = React.useRef(new Animated.Value(0)).current;
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0.95],
    extrapolate: 'clamp',
  });

  const formatDistance = (km: number) => {
    if (km < 1) return `${Math.round(km * 1000)}m`;
    return `${km.toFixed(1)}km`;
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Az önce';
    if (minutes < 60) return `${minutes} dk önce`;
    if (hours < 24) return `${hours} saat önce`;
    return `${days} gün önce`;
  };

  const statsCards = [
    {
      title: 'Aktif Çalışanlar',
      value: stats.activeWorkers.toString(),
      icon: 'people' as const,
      iconColor: theme.colors.primary,
      trend: { value: 12, isPositive: true },
    },
    {
      title: 'Toplam Grup',
      value: stats.totalGroups.toString(),
      icon: 'layers' as const,
      iconColor: theme.colors.accent,
    },
    {
      title: 'Bugünkü Mesafe',
      value: formatDistance(stats.todayDistance),
      icon: 'location' as const,
      iconColor: theme.colors.success,
      subtitle: 'Toplam',
    },
    {
      title: 'Aktif Uyarılar',
      value: stats.activeAlerts.toString(),
      icon: 'notifications' as const,
      iconColor: theme.colors.warning,
    },
  ];

  const renderHeader = () => (
    <Animated.View
      style={[
        styles.header,
        {
          backgroundColor: theme.colors.background,
          opacity: headerOpacity,
        },
      ]}
    >
      <View style={styles.headerContent}>
        <View>
          <Text style={[styles.greeting, { color: theme.colors.textSecondary }]}>
            Hoş geldiniz
          </Text>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Dashboard
          </Text>
        </View>
        <View style={styles.headerBadges}>
          <Badge
            label="Aktif"
            variant="success"
            size="sm"
            icon="checkmark-circle"
          />
        </View>
      </View>
    </Animated.View>
  );

  const renderStats = () => (
    <View style={styles.statsContainer}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
        İstatistikler
      </Text>
      <View style={styles.statsGrid}>
        {statsCards.map((card, index) => (
          <StatsCard
            key={index}
            {...card}
            size="md"
            variant={index === 0 ? 'gradient' : 'default'}
          />
        ))}
      </View>
    </View>
  );

  const renderQuickActions = () => (
    <View style={styles.quickActionsContainer}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
        Hızlı İşlemler
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.quickActionsScroll}
      >
        {quickActions.map((action) => (
          <View
            key={action.id}
            style={[
              styles.quickActionCard,
              {
                backgroundColor: theme.colors.surfaceElevated,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <LinearGradient
              colors={[`${action.color}20`, `${action.color}10`]}
              style={styles.quickActionGradient}
            >
              <Ionicons name={action.icon} size={28} color={action.color} />
            </LinearGradient>
            <Text
              style={[styles.quickActionTitle, { color: theme.colors.text }]}
            >
              {action.title}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );

  const renderRecentActivities = () => (
    <View style={styles.activitiesContainer}>
      <View style={styles.activitiesHeader}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Son Aktiviteler
        </Text>
        <Text
          style={[styles.seeAll, { color: theme.colors.primary }]}
          onPress={() => {}}
        >
          Tümünü Gör
        </Text>
      </View>
      <View style={styles.activitiesList}>
        {recentActivities.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="time-outline"
              size={48}
              color={theme.colors.textTertiary}
            />
            <Text style={[styles.emptyText, { color: theme.colors.textTertiary }]}>
              Henüz aktivite yok
            </Text>
          </View>
        ) : (
          recentActivities.map((activity) => (
            <View
              key={activity.id}
              style={[
                styles.activityItem,
                {
                  backgroundColor: theme.colors.surfaceElevated,
                  borderColor: theme.colors.borderSecondary,
                },
              ]}
            >
              <View
                style={[
                  styles.activityIconContainer,
                  { backgroundColor: `${activity.color}20` },
                ]}
              >
                <Ionicons name={activity.icon} size={20} color={activity.color} />
              </View>
              <View style={styles.activityContent}>
                <Text style={[styles.activityMessage, { color: theme.colors.text }]}>
                  {activity.message}
                </Text>
                <Text style={[styles.activityTime, { color: theme.colors.textTertiary }]}>
                  {formatTime(activity.timestamp)}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Animated.ScrollView
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
            />
          ) : undefined
        }
        showsVerticalScrollIndicator={false}
      >
        {renderHeader()}
        {renderStats()}
        {renderQuickActions()}
        {renderRecentActivities()}
        <View style={{ height: 32 }} />
      </Animated.ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  headerBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  statsContainer: {
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickActionsContainer: {
    marginBottom: 24,
  },
  quickActionsScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
  quickActionCard: {
    width: 120,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  quickActionGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  activitiesContainer: {
    paddingHorizontal: 20,
  },
  activitiesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
  },
  activitiesList: {
    gap: 12,
  },
  activityItem: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  activityIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityMessage: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 12,
  },
  emptyState: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    marginTop: 12,
  },
});

