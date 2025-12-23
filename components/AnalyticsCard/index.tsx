import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import analyticsApi, { AnalyticsData } from '../../utils/api/analytics';
import { Card } from '../ui/Card/index';
import { useTheme } from '../ui/theme/ThemeContext';

interface AnalyticsCardProps {
  userId: string;
  dateRange?: string;
}

export function AnalyticsCard({ userId, dateRange = '7d' }: AnalyticsCardProps) {
  const router = useRouter();
  const theme = useTheme();
  const [analytics, setAnalytics] = React.useState<AnalyticsData | null>(null);
  const [loading, setLoading] = React.useState(true);

  const loadAnalytics = React.useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);
      const data = await analyticsApi.getAnalytics(userId, dateRange);
      setAnalytics(data);
    } catch (error: any) {
      setAnalytics({
        summary: {
          total_locations: 0,
          total_distance: 0,
          active_days: 0,
          average_daily_distance: 0,
        },
        trends: { locations_per_day: [], distance_per_day: [] },
        predictions: undefined,
        insights: [],
        anomalies: [],
      });
    } finally {
      setLoading(false);
    }
  }, [userId, dateRange]);

  React.useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  if (loading) {
    return (
      <Card variant="elevated" style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.textTertiary }]}>
          Analitik yükleniyor...
        </Text>
      </Card>
    );
  }

  if (!analytics || typeof analytics !== 'object') {
    return null;
  }

  const safeSummary = analytics.summary && typeof analytics.summary === 'object' ? analytics.summary : {
    total_locations: 0,
    total_distance: 0,
    active_days: 0,
    average_daily_distance: 0,
  };
  const summary = {
    total_locations: typeof safeSummary.total_locations === 'number' ? safeSummary.total_locations : (typeof safeSummary.total_locations === 'string' ? parseInt(safeSummary.total_locations, 10) || 0 : 0),
    total_distance: typeof safeSummary.total_distance === 'number' ? safeSummary.total_distance : (typeof safeSummary.total_distance === 'string' ? parseFloat(safeSummary.total_distance) || 0 : 0),
    active_days: typeof safeSummary.active_days === 'number' ? safeSummary.active_days : (typeof safeSummary.active_days === 'string' ? parseInt(safeSummary.active_days, 10) || 0 : 0),
    average_daily_distance: typeof safeSummary.average_daily_distance === 'number' ? safeSummary.average_daily_distance : (typeof safeSummary.average_daily_distance === 'string' ? parseFloat(safeSummary.average_daily_distance) || 0 : 0),
  };
  const insights = Array.isArray(analytics.insights) ? analytics.insights : [];
  const predictions = analytics.predictions && typeof analytics.predictions === 'object' && analytics.predictions !== null ? analytics.predictions : undefined;

  const formatNumber = (value: number): string => {
    const num = isNaN(value) ? 0 : value;
    return num.toFixed(1);
  };

  const formatInteger = (value: number): string => {
    const num = isNaN(value) ? 0 : Math.floor(value);
    return String(num);
  };

  return (
    <Card variant="elevated" style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <LinearGradient
            colors={theme.colors.gradients.primary.slice(0, 2) as [string, string]}
            style={styles.iconWrapper}
          >
            <Ionicons name="analytics" size={32} color={theme.colors.text} />
          </LinearGradient>
          <View>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              Gelişmiş Analitik
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textTertiary }]}>
              AI destekli analiz
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => router.push('/(tabs)/analytics' as any)}
          style={[styles.viewAllButton, { backgroundColor: theme.colors.primary + '1A', borderColor: theme.colors.primary + '33' }]}
        >
          <Text style={[styles.viewAllText, { color: theme.colors.primary }]}>
            Detaylar
          </Text>
          <Ionicons name="arrow-forward" size={18} color={theme.colors.primary} />
        </Pressable>
      </View>

      <View style={styles.statsGrid}>
        <View style={[styles.statItem, { backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }]}>
          <Text style={[styles.statValue, { color: theme.colors.text }]}>
            {formatNumber(summary.total_distance)} km
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textTertiary }]}>Mesafe</Text>
        </View>
        <View style={[styles.statItem, { backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }]}>
          <Text style={[styles.statValue, { color: theme.colors.text }]}>
            {formatInteger(summary.active_days)}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textTertiary }]}>Aktif Gün</Text>
        </View>
        <View style={[styles.statItem, { backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }]}>
          <Text style={[styles.statValue, { color: theme.colors.text }]}>
            {formatNumber(summary.average_daily_distance)} km
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textTertiary }]}>Ortalama</Text>
        </View>
      </View>

      {insights.length > 0 && (
        <View style={[styles.insightsContainer, { borderTopColor: theme.colors.border }]}>
          <Text style={[styles.insightsTitle, { color: theme.colors.text }]}>Öngörüler</Text>
          {insights.slice(0, 2).map((insight, idx) => {
            if (!insight || typeof insight !== 'object') return null;
            const severity = insight.severity || 'info';
            const message = String(insight.message || '');
            if (!message) return null;

            return (
              <View
                key={idx}
                style={[
                  styles.insightItem,
                  {
                    backgroundColor: theme.colors.backgroundSecondary,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Ionicons
                  name={severity === 'warning' ? 'warning' : 'information-circle'}
                  size={16}
                  color={severity === 'warning' ? theme.colors.warning : theme.colors.info}
                />
                <Text style={[styles.insightText, { color: theme.colors.textSecondary }]}>
                  {message}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {predictions && typeof predictions === 'object' && predictions !== null && 'estimated_daily_distance' in predictions && Boolean(predictions.estimated_daily_distance) && (
        <View
          style={[
            styles.predictionContainer,
            {
              backgroundColor: theme.colors.success + '1A',
              borderColor: theme.colors.success + '33',
            },
          ]}
        >
          <Ionicons name="trending-up" size={18} color={theme.colors.success} />
          <Text style={[styles.predictionText, { color: theme.colors.success }]}>
            Tahmini günlük mesafe:{' '}
            {formatNumber(
              typeof predictions.estimated_daily_distance === 'number'
                ? predictions.estimated_daily_distance
                : typeof predictions.estimated_daily_distance === 'string'
                  ? parseFloat(predictions.estimated_daily_distance) || 0
                  : 0
            )}{' '}
            km
          </Text>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0369a1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    fontFamily: 'Poppins-ExtraBold',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
    fontFamily: 'Poppins-Regular',
    opacity: 0.7,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    shadowColor: '#0369a1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '900',
    fontFamily: 'Poppins-ExtraBold',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 4,
    fontFamily: 'Poppins-ExtraBold',
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
  },
  insightsContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  insightsTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
    fontFamily: 'Poppins-Bold',
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  insightText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
  },
  predictionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  predictionText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Poppins-Bold',
  },
});

export default AnalyticsCard;
