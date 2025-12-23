import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../components/ui/theme/ThemeContext';
import { getApiBase } from '../utils/api';

interface ProductData {
  features?: Array<{
    title: string;
    description: string;
    icon: string;
  }>;
  benefits?: Array<{
    title: string;
    description: string;
  }>;
  title?: string;
  description?: string;
}

export default function ProductScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [data, setData] = useState<ProductData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${getApiBase()}/app/pages/product`);
        const json = await res.json();
        if (json?.success && json?.data) {
          setData(json.data);
        } else {
          setData(getDefaultData());
        }
      } catch {
        setData(getDefaultData());
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getDefaultData = (): ProductData => ({
    title: 'Ürün Özellikleri',
    description: 'Bavaxe GPS takip platformunun tüm güçlü özelliklerini keşfedin',
    features: [
      {
        title: 'Gerçek Zamanlı İzleme',
        description: 'Araçlarınızı anlık olarak haritada izleyin ve konum güncellemelerini takip edin',
        icon: 'location',
      },
      {
        title: 'İş Yönetimi',
        description: 'Görevleri atayın, sürücüleri yönetin ve iş akışını optimize edin',
        icon: 'briefcase',
      },
      {
        title: 'Analitikler & Raporlar',
        description: 'Detaylı raporlar ve analytics ile performansı ölçün',
        icon: 'bar-chart',
      },
      {
        title: 'Entegrasyonlar',
        description: 'API ve webhook aracılığıyla mevcut sistemlerinizle entegre olun',
        icon: 'link',
      },
      {
        title: 'Mobil Uygulama',
        description: 'iOS ve Android için tam özellikli mobil takip uygulaması',
        icon: 'phone-portrait',
      },
      {
        title: 'Güvenlik',
        description: 'Kurumsal düzeyde şifreleme ve veri koruması',
        icon: 'shield-checkmark',
      },
    ],
    benefits: [
      {
        title: 'Operasyonel Verimlilik',
        description: 'Rota optimizasyonu ve araç yönetimi ile maliyetleri azaltın',
      },
      {
        title: 'Müşteri Memnuniyeti',
        description: 'Gerçek zamanlı izleme ile müşteri güvenini artırın',
      },
      {
        title: 'Veri Güvenliği',
        description: 'Kurumsal standartlarda veri koruması ve gizliliği',
      },
      {
        title: '24/7 Destek',
        description: 'Kapsamlı teknik destek ve danışmanlık hizmeti',
      },
    ],
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <LinearGradient colors={['#020617', '#0f172a']} style={styles.gradient}>
        {/* HEADER */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Ürün</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* TITLE SECTION */}
          <View style={styles.titleSection}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              {data?.title || 'Ürün Özellikleri'}
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.text + 'CC' }]}>
              {data?.description || ''}
            </Text>
          </View>

          {/* FEATURES GRID */}
          {data?.features && (
            <View style={styles.featuresSection}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Ana Özellikler
              </Text>
              <View style={styles.featuresGrid}>
                {data.features.map((feature, idx) => (
                  <View key={idx} style={styles.featureCard}>
                    <LinearGradient
                      colors={['rgba(6,182,212,0.1)', 'rgba(6,182,212,0.05)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.featureGradient}
                    >
                      <View style={styles.featureIcon}>
                        <Ionicons
                          name={feature.icon as any}
                          size={32}
                          color="#0EA5E9"
                        />
                      </View>
                      <Text style={[styles.featureTitle, { color: theme.colors.text }]}>
                        {feature.title}
                      </Text>
                      <Text style={[styles.featureDesc, { color: theme.colors.text + 'AA' }]}>
                        {feature.description}
                      </Text>
                    </LinearGradient>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* BENEFITS SECTION */}
          {data?.benefits && (
            <View style={styles.benefitsSection}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Faydaları
              </Text>
              {data.benefits.map((benefit, idx) => (
                <View key={idx} style={styles.benefitItem}>
                  <View
                    style={[
                      styles.benefitIcon,
                      { backgroundColor: 'rgba(6,182,212,0.15)' },
                    ]}
                  >
                    <Ionicons name="checkmark-circle" size={24} color="#0EA5E9" />
                  </View>
                  <View style={styles.benefitContent}>
                    <Text style={[styles.benefitTitle, { color: theme.colors.text }]}>
                      {benefit.title}
                    </Text>
                    <Text style={[styles.benefitDesc, { color: theme.colors.text + 'AA' }]}>
                      {benefit.description}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* CTA SECTION */}
          <View style={styles.ctaSection}>
            <Pressable
              style={({ pressed }) => [
                styles.ctaButton,
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => router.push('/upgrade')}
            >
              <Text style={styles.ctaButtonText}>Hemen Başla</Text>
            </Pressable>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(6,182,212,0.1)',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-Bold',
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  titleSection: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontFamily: 'Poppins-Bold',
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    textAlign: 'center',
    lineHeight: 24,
  },
  featuresSection: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-Bold',
    fontWeight: '700',
    marginBottom: 16,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  featureCard: {
    width: '48%',
    minHeight: 200,
    borderRadius: 16,
    overflow: 'hidden',
  },
  featureGradient: {
    flex: 1,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.2)',
    borderRadius: 16,
    justifyContent: 'space-between',
  },
  featureIcon: {
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 14,
    fontFamily: 'Poppins-Bold',
    fontWeight: '600',
    marginBottom: 8,
  },
  featureDesc: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    lineHeight: 18,
  },
  benefitsSection: {
    marginBottom: 40,
  },
  benefitItem: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(6,182,212,0.08)',
  },
  benefitIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  benefitContent: {
    flex: 1,
    justifyContent: 'center',
  },
  benefitTitle: {
    fontSize: 14,
    fontFamily: 'Poppins-Bold',
    fontWeight: '600',
    marginBottom: 4,
  },
  benefitDesc: {
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    lineHeight: 20,
  },
  ctaSection: {
    paddingVertical: 32,
    gap: 12,
  },
  ctaButton: {
    backgroundColor: '#0EA5E9',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  ctaButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Poppins-Bold',
    fontWeight: '600',
  },
});
