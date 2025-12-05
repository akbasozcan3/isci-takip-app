import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { AnalyticsData, microservicesClient } from '../utils/microservices';

interface AnalyticsCardProps {
  userId: string;
  dateRange?: string;
}

export function AnalyticsCard({ userId, dateRange = '7d' }: AnalyticsCardProps) {
  const router = useRouter();
  const [analytics, setAnalytics] = React.useState<AnalyticsData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (userId) {
      loadAnalytics();
    }
  }, [userId, dateRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const data = await microservicesClient.getAnalytics(userId, dateRange);
      setAnalytics(data);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#06b6d4" />
        <Text style={styles.loadingText}>Analitik yükleniyor...</Text>
      </View>
    );
  }

  if (!analytics) {
    return null;
  }

  const summary = analytics.summary || {};
  const insights = analytics.insights || [];
  const predictions = analytics.predictions || {};

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <LinearGradient
            colors={['#06b6d4', '#0891b2']}
            style={styles.iconWrapper}
          >
            <Ionicons name="analytics" size={24} color="#fff" />
          </LinearGradient>
          <View>
            <Text style={styles.title}>Gelişmiş Analitik</Text>
            <Text style={styles.subtitle}>AI destekli analiz</Text>
          </View>
        </View>
        <Pressable
          onPress={() => router.push('/(tabs)/analytics' as any)}
          style={styles.viewAllButton}
        >
          <Text style={styles.viewAllText}>Detaylar</Text>
          <Ionicons name="arrow-forward" size={16} color="#06b6d4" />
        </Pressable>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{summary.total_locations || 0}</Text>
          <Text style={styles.statLabel}>Konum</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {(summary.total_distance || 0).toFixed(1)} km
          </Text>
          <Text style={styles.statLabel}>Mesafe</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{summary.active_days || 0}</Text>
          <Text style={styles.statLabel}>Aktif Gün</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {(summary.average_daily_distance || 0).toFixed(1)} km
          </Text>
          <Text style={styles.statLabel}>Ortalama</Text>
        </View>
      </View>

      {insights.length > 0 && (
        <View style={styles.insightsContainer}>
          <Text style={styles.insightsTitle}>Öngörüler</Text>
          {insights.slice(0, 2).map((insight, idx) => (
            <View key={idx} style={styles.insightItem}>
              <Ionicons
                name={insight.severity === 'warning' ? 'warning' : 'information-circle'}
                size={16}
                color={insight.severity === 'warning' ? '#f59e0b' : '#06b6d4'}
              />
              <Text style={styles.insightText}>{insight.message}</Text>
            </View>
          ))}
        </View>
      )}

      {predictions.estimated_daily_distance && (
        <View style={styles.predictionContainer}>
          <Ionicons name="trending-up" size={18} color="#10b981" />
          <Text style={styles.predictionText}>
            Tahmini günlük mesafe: {predictions.estimated_daily_distance.toFixed(1)} km
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
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
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fff',
    fontFamily: 'Poppins-Bold',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    fontFamily: 'Poppins-Regular',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(6,182,212,0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.2)',
  },
  viewAllText: {
    color: '#06b6d4',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: 'Poppins-Bold',
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
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 4,
    fontFamily: 'Poppins-ExtraBold',
  },
  statLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontFamily: 'Poppins-Regular',
  },
  insightsContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  insightsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 12,
    fontFamily: 'Poppins-Bold',
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    padding: 10,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  insightText: {
    flex: 1,
    fontSize: 13,
    color: '#e2e8f0',
    fontFamily: 'Poppins-Regular',
  },
  predictionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.2)',
  },
  predictionText: {
    flex: 1,
    fontSize: 13,
    color: '#10b981',
    fontWeight: '700',
    fontFamily: 'Poppins-Bold',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
  },
});
