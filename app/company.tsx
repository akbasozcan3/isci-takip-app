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

interface CompanyData {
  mission?: string;
  vision?: string;
  values?: Array<{
    title: string;
    description: string;
    icon: string;
  }>;
  team?: Array<{
    name: string;
    role: string;
    bio: string;
  }>;
  title?: string;
  description?: string;
}

export default function CompanyScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [data, setData] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${getApiBase()}/app/pages/company`);
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

  const getDefaultData = (): CompanyData => ({
    title: 'Hakkımızda',
    description: 'Bavaxe, GPS takip ve iş yönetim alanında lider bir platformdur',
    mission: 'İşletmelerin operasyonel verimliliğini maksimize etmek ve müşteri memnuniyetini artırmak için yenilikçi teknoloji çözümleri sunmak.',
    vision: '2030 yılında, GPS takip ve iş yönetim kategorisinde dünyanın en güvenilir ve kullanıcı dostu platformu olmak.',
    values: [
      {
        title: 'İnnovasyon',
        description: 'Sürekli teknoloji geliştirme ve iyileştirme ile sektörde öncü olmak',
        icon: 'bulb',
      },
      {
        title: 'Güvenilirlik',
        description: 'Müşteri verilerini korumak ve hizmet kalitesini garantilemek',
        icon: 'shield-checkmark',
      },
      {
        title: 'Müşteri Odaklılık',
        description: 'Müşteri ihtiyaçlarını anlamak ve en iyi çözümleri sunmak',
        icon: 'heart',
      },
      {
        title: 'Takım Çalışması',
        description: 'Diverse ve yetenekli ekipler ile başarı elde etmek',
        icon: 'people',
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
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Şirket</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* TITLE SECTION */}
          <View style={styles.titleSection}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              {data?.title || 'Hakkımızda'}
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.text + 'CC' }]}>
              {data?.description || ''}
            </Text>
          </View>

          {/* MISSION & VISION */}
          <View style={styles.missionVisionSection}>
            <View
              style={[
                styles.card,
                { borderColor: 'rgba(6,182,212,0.3)', backgroundColor: 'rgba(6,182,212,0.05)' },
              ]}
            >
              <Ionicons name="target" size={28} color="#0EA5E9" />
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Misyonumuz</Text>
              <Text style={[styles.cardText, { color: theme.colors.text + 'AA' }]}>
                {data?.mission || ''}
              </Text>
            </View>

            <View
              style={[
                styles.card,
                { borderColor: 'rgba(6,182,212,0.3)', backgroundColor: 'rgba(6,182,212,0.05)' },
              ]}
            >
              <Ionicons name="eye" size={28} color="#0EA5E9" />
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Vizyonumuz</Text>
              <Text style={[styles.cardText, { color: theme.colors.text + 'AA' }]}>
                {data?.vision || ''}
              </Text>
            </View>
          </View>

          {/* VALUES SECTION */}
          {data?.values && (
            <View style={styles.valuesSection}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Temel Değerlerimiz
              </Text>
              <View style={styles.valuesGrid}>
                {data.values.map((value, idx) => (
                  <View key={idx} style={styles.valueCard}>
                    <LinearGradient
                      colors={['rgba(6,182,212,0.1)', 'rgba(6,182,212,0.05)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.valueGradient}
                    >
                      <View style={styles.valueIcon}>
                        <Ionicons
                          name={value.icon as any}
                          size={28}
                          color="#0EA5E9"
                        />
                      </View>
                      <Text style={[styles.valueTitle, { color: theme.colors.text }]}>
                        {value.title}
                      </Text>
                      <Text style={[styles.valueDesc, { color: theme.colors.text + 'AA' }]}>
                        {value.description}
                      </Text>
                    </LinearGradient>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* TEAM SECTION */}
          {data?.team && data.team.length > 0 && (
            <View style={styles.teamSection}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Ekibimiz
              </Text>
              {data.team.map((member, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.teamMember,
                    { borderBottomColor: 'rgba(6,182,212,0.1)' },
                  ]}
                >
                  <View
                    style={[
                      styles.memberAvatar,
                      { backgroundColor: 'rgba(6,182,212,0.2)' },
                    ]}
                  >
                    <Ionicons name="person" size={24} color="#0EA5E9" />
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={[styles.memberName, { color: theme.colors.text }]}>
                      {member.name}
                    </Text>
                    <Text style={[styles.memberRole, { color: '#0EA5E9' }]}>
                      {member.role}
                    </Text>
                    <Text style={[styles.memberBio, { color: theme.colors.text + 'AA' }]}>
                      {member.bio}
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
              onPress={() => router.push('/(tabs)/profile')}
            >
              <Text style={styles.ctaButtonText}>İletişime Geçin</Text>
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
  missionVisionSection: {
    gap: 16,
    marginBottom: 32,
  },
  card: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Bold',
    fontWeight: '600',
  },
  cardText: {
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    lineHeight: 20,
  },
  valuesSection: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-Bold',
    fontWeight: '700',
    marginBottom: 16,
  },
  valuesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  valueCard: {
    width: '48%',
    minHeight: 180,
    borderRadius: 16,
    overflow: 'hidden',
  },
  valueGradient: {
    flex: 1,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.2)',
    borderRadius: 16,
    justifyContent: 'space-between',
  },
  valueIcon: {
    marginBottom: 12,
  },
  valueTitle: {
    fontSize: 14,
    fontFamily: 'Poppins-Bold',
    fontWeight: '600',
    marginBottom: 8,
  },
  valueDesc: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    lineHeight: 18,
  },
  teamSection: {
    marginBottom: 40,
  },
  teamMember: {
    flexDirection: 'row',
    paddingVertical: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  memberAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  memberName: {
    fontSize: 14,
    fontFamily: 'Poppins-Bold',
    fontWeight: '600',
    marginBottom: 4,
  },
  memberRole: {
    fontSize: 12,
    fontFamily: 'Poppins-SemiBold',
    marginBottom: 4,
  },
  memberBio: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    lineHeight: 18,
  },
  ctaSection: {
    paddingVertical: 32,
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
