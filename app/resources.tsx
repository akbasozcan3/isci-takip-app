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

interface Resource {
  title: string;
  description: string;
  category: string;
  icon: string;
  link?: string;
}

interface ResourcesData {
  title?: string;
  description?: string;
  categories?: Record<string, Resource[]>;
}

export default function ResourcesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [data, setData] = useState<ResourcesData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${getApiBase()}/app/pages/resources`);
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

  const getDefaultData = (): ResourcesData => ({
    title: 'Kaynaklar',
    description: 'Bavaxe\'i en iyi şekilde kullanmak için tüm kaynaklara erişin',
    categories: {
      dokumantasyon: [
        {
          title: 'API Dokümantasyonu',
          description: 'Bavaxe API\'sini entegre etmek için detaylı teknik dokümanlar',
          category: 'Dokümantasyon',
          icon: 'document-text',
          link: '/blog?category=Teknoloji',
        },
        {
          title: 'Kullanıcı Rehberi',
          description: 'Adım adım uygulama kullanım talimatları',
          category: 'Dokümantasyon',
          icon: 'book',
          link: '/blog?category=Kullanım',
        },
        {
          title: 'API Referansı',
          description: 'Tüm endpoint\'lerin detaylı açıklamaları ve örnekleri',
          category: 'Dokümantasyon',
          icon: 'code-slash',
          link: '/blog?category=Teknoloji',
        },
      ],
      ogrenim: [
        {
          title: 'Video Eğitimler',
          description: 'Bavaxe platformunun tüm özelliklerini öğren',
          category: 'Öğrenim',
          icon: 'play-circle',
          link: '/blog?category=Eğitim',
        },
        {
          title: 'Webinar Serisi',
          description: 'Uzmanlar tarafından sunulan canlı eğitim oturumları',
          category: 'Öğrenim',
          icon: 'videocam',
          link: '/blog?category=Eğitim',
        },
        {
          title: 'Sertifikasyon Programı',
          description: 'Bavaxe uzmanı olmak için eğitim sertifikaları',
          category: 'Öğrenim',
          icon: 'medal',
          link: '/blog?category=Eğitim',
        },
      ],
      destek: [
        {
          title: 'Yardım Merkezi',
          description: 'Sık sorulan sorular ve sorun çözüm rehberleri',
          category: 'Destek',
          icon: 'help-circle',
          link: '/help',
        },
        {
          title: 'Topluluğumuz',
          description: 'Kullanıcı forumu ve topluluk desteği',
          category: 'Destek',
          icon: 'people-circle',
          link: '/help',
        },
        {
          title: '24/7 Teknik Destek',
          description: 'Teknik sorunlar için canlı destek',
          category: 'Destek',
          icon: 'headset',
          link: '/(tabs)/profile',
        },
      ],
      entegrasyon: [
        {
          title: 'Webhook Rehberi',
          description: 'Real-time event\'ler için webhook entegrasyonu',
          category: 'Entegrasyon',
          icon: 'git-network',
          link: '/blog?category=Teknoloji',
        },
        {
          title: 'SDK\'lar',
          description: 'Python, JavaScript, Go ve diğer dillerde SDK\'lar',
          category: 'Entegrasyon',
          icon: 'layers',
          link: '/blog?category=Teknoloji',
        },
        {
          title: 'Üçüncü Parti Entegrasyonları',
          description: 'Popüler servislerin entegrasyon rehberleri',
          category: 'Entegrasyon',
          icon: 'plug',
          link: '/blog?category=Teknoloji',
        },
      ],
    },
  });

  const openResource = (link?: string) => {
    if (link) {
      router.push(link as any);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <LinearGradient colors={['#020617', '#0f172a']} style={styles.gradient}>
        {/* HEADER */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Kaynaklar</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* TITLE SECTION */}
          <View style={styles.titleSection}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              {data?.title || 'Kaynaklar'}
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.text + 'CC' }]}>
              {data?.description || ''}
            </Text>
          </View>

          {/* RESOURCES BY CATEGORY */}
          {data?.categories &&
            Object.entries(data.categories).map(([categoryKey, resources]) => (
              <View key={categoryKey} style={styles.categorySection}>
                <Text style={[styles.categoryTitle, { color: theme.colors.text }]}>
                  {categoryKey === 'dokumantasyon'
                    ? 'Dokümantasyon'
                    : categoryKey === 'ogrenim'
                    ? 'Öğrenim Kaynakları'
                    : categoryKey === 'destek'
                    ? 'Destek'
                    : 'Entegrasyon'}
                </Text>

                <View style={styles.resourcesList}>
                  {resources.map((resource, idx) => (
                    <Pressable
                      key={idx}
                      onPress={() => openResource(resource.link)}
                      style={({ pressed }) => [
                        styles.resourceCard,
                        {
                          borderColor: 'rgba(6,182,212,0.2)',
                          backgroundColor: pressed
                            ? 'rgba(6,182,212,0.08)'
                            : 'rgba(6,182,212,0.03)',
                        },
                      ]}
                    >
                      <View style={styles.resourceHeader}>
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 8,
                            backgroundColor: 'rgba(6,182,212,0.15)',
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}
                        >
                          <Ionicons
                            name={resource.icon as any}
                            size={20}
                            color="#0EA5E9"
                          />
                        </View>
                        <Ionicons
                          name="arrow-forward"
                          size={20}
                          color={'rgba(6,182,212,0.5)'}
                        />
                      </View>
                      <Text
                        style={[styles.resourceTitle, { color: theme.colors.text }]}
                      >
                        {resource.title}
                      </Text>
                      <Text
                        style={[styles.resourceDesc, { color: theme.colors.text + 'AA' }]}
                      >
                        {resource.description}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}

          {/* SUPPORT CTA */}
          <View style={styles.supportSection}>
            <LinearGradient
              colors={['rgba(6,182,212,0.1)', 'rgba(6,182,212,0.05)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.supportCard}
            >
              <Ionicons name="help-buoy" size={32} color="#0EA5E9" />
              <Text style={[styles.supportTitle, { color: theme.colors.text }]}>
                Daha Fazla Yardıma mı İhtiyacınız Var?
              </Text>
              <Text style={[styles.supportDesc, { color: theme.colors.text + 'AA' }]}>
                Bavaxe destek ekibi her zaman yardımcı olmaya hazır
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.supportButton,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => router.push('/help')}
              >
                <Text style={styles.supportButtonText}>Destek Merkezi</Text>
              </Pressable>
            </LinearGradient>
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
  categorySection: {
    marginBottom: 32,
  },
  categoryTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-Bold',
    fontWeight: '600',
    marginBottom: 16,
  },
  resourcesList: {
    gap: 12,
  },
  resourceCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  resourceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resourceTitle: {
    fontSize: 14,
    fontFamily: 'Poppins-Bold',
    fontWeight: '600',
    marginBottom: 8,
  },
  resourceDesc: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    lineHeight: 18,
  },
  supportSection: {
    marginTop: 20,
    marginBottom: 32,
  },
  supportCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.2)',
    alignItems: 'center',
    gap: 12,
  },
  supportTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-Bold',
    fontWeight: '600',
    textAlign: 'center',
  },
  supportDesc: {
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  supportButton: {
    backgroundColor: '#0EA5E9',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 8,
  },
  supportButtonText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Poppins-Bold',
    fontWeight: '600',
  },
});
