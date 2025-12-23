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

interface LegalSection {
  title: string;
  lastUpdated?: string;
  content: string;
}

interface LegalData {
  title?: string;
  description?: string;
  sections?: LegalSection[];
}

export default function LegalScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [data, setData] = useState<LegalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${getApiBase()}/app/pages/legal`);
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

  const getDefaultData = (): LegalData => ({
    title: 'Yasal Belgeler',
    description: 'Bavaxe hizmetlerinin yasal şartları ve gizlilik politikası',
    sections: [
      {
        title: 'Gizlilik Politikası',
        lastUpdated: '2024-01-15',
        content: `Bavaxe, kullanıcı gizliliğini çok ciddiye alır. Bu gizlilik politikası, kişisel verilerin nasıl toplandığını, kullanıldığını ve korunduğunu açıklar.

1. TOPLANAN VERİLER
- Kişisel kimlik bilgileri (ad, e-posta, telefon)
- Lokasyon verileri (GPS konumu)
- Cihaz bilgileri (cihaz ID, işletim sistemi)
- Kullanım istatistikleri ve log dosyaları

2. VERİLERİN KULLANIMI
- Hizmet sağlama ve iyileştirme
- Teknik destek ve müşteri hizmetleri
- Güvenlik ve dolandırıcılık önleme
- Yasal yükümlülüklerin yerine getirilmesi

3. VERİLERİN KORUNMASI
Verileri korumak için endüstri standardı şifrelemesi kullanıyoruz. Veriler yetkisiz erişime karşı korunur.

4. HAKLARINIZ
- Verilerinize erişim hakkı
- Verileri düzeltme hakkı
- Verileri silme hakkı
- İtiraz etme hakkı`,
      },
      {
        title: 'Kullanım Şartları',
        lastUpdated: '2024-01-15',
        content: `Bu kullanım şartları, Bavaxe hizmetlerinin kullanımına ilişkin şartları ve koşulları tanımlar.

1. HIZMET KULLANIMI
Bavaxe hizmetlerini yalnızca yasal amaçlar için kullanabilirsiniz. Herhangi bir yasa ihlali veya kötüye kullanım yapmanız yasaktır.

2. KULLANICI HESABI
Hesap oluşturma sırasında sağladığınız bilgilerin doğru ve güncel olmasından sorumlusunuz.

3. FIKRI MÜLKIYET
Bavaxe içeriği, tasarım ve işlevselliği telif hakkı tarafından korunur. Yazılı izin olmadan çoğaltılamaz.

4. SORUMLULUK SINIRI
Bavaxe, hizmetlerin kesintisiz veya hatasız olacağını garanti etmez. Herhangi bir zarardan sorumlu değildir.

5. KOŞULLARı DEĞİŞİKLİK
Bu şartları önceden haber vererek değiştirme hakkını saklı tutarız.`,
      },
      {
        title: 'KVKK Uyumluluğu',
        lastUpdated: '2024-01-15',
        content: `Bavaxe, Türkiye\'nin Kişisel Verilerin Korunması Kanunu (KVKK) ile tam olarak uyumludur.

1. VERİ SORUMLUSU
Bavaxe A.Ş., kişisel verilerin işlenmesinden sorumludur.

2. İŞLEME AMAÇLARI
Veriler şu amaçlarla işlenir:
- Hizmet sağlama
- Teknik süreçler
- Pazarlama (rıza ile)
- Yasal yükümlülükler

3. RIZA VE HAK
Belirli veri işlemeleri için açık rızanız alınır. Haklarınız konusunda başvuru yapabilirsiniz.

4. VERI TRANSFER
Uluslararası veri transferleri KVKK\'nın 5. maddesi gereğince yapılır.

5. İLETİŞİM
Veri hakları hakkında: bilgi@bavaxe.com`,
      },
      {
        title: 'Çerez Politikası',
        lastUpdated: '2024-01-15',
        content: `Bavaxe, kullanıcı deneyimini geliştirmek için çerezleri kullanır.

1. ÇEREZLERİN TÜRÜ
- Gerekli çerezler: Hizmeti sağlamak için
- Analitik çerezleri: Kullanımı anlamak için
- Pazarlama çerezleri: Reklam için (rıza ile)

2. ÇEREZLERİ KONTROL ETME
Tarayıcı ayarlarında çerezleri devre dışı bırakabilirsiniz, ancak bazı özellikleri etkileyebilir.

3. ÜÇÜNCÜ TARAF
Google Analytics gibi hizmetler çerez kullanabilir.

4. GÜNCELLEME
Politika herhangi bir zamanda güncellenebilir.`,
      },
    ],
  });

  const toggleSection = (idx: number) => {
    setExpandedIdx(expandedIdx === idx ? null : idx);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <LinearGradient colors={['#020617', '#0f172a']} style={styles.gradient}>
        {/* HEADER */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Yasal</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* TITLE SECTION */}
          <View style={styles.titleSection}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              {data?.title || 'Yasal Belgeler'}
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.text + 'CC' }]}>
              {data?.description || ''}
            </Text>
          </View>

          {/* LEGAL SECTIONS */}
          {data?.sections && (
            <View style={styles.sectionsContainer}>
              {data.sections.map((section, idx) => (
                <View key={idx} style={styles.sectionWrapper}>
                  <Pressable
                    onPress={() => toggleSection(idx)}
                    style={({ pressed }) => [
                      styles.sectionHeader,
                      {
                        backgroundColor: pressed
                          ? 'rgba(6,182,212,0.08)'
                          : 'rgba(6,182,212,0.04)',
                        borderColor:
                          expandedIdx === idx
                            ? 'rgba(6,182,212,0.3)'
                            : 'rgba(6,182,212,0.15)',
                      },
                    ]}
                  >
                    <View style={styles.headerContent}>
                      <Text
                        style={[styles.sectionTitle, { color: theme.colors.text }]}
                      >
                        {section.title}
                      </Text>
                      {section.lastUpdated && (
                        <Text
                          style={[
                            styles.lastUpdated,
                            { color: theme.colors.text + '77' },
                          ]}
                        >
                          Son güncelleme: {section.lastUpdated}
                        </Text>
                      )}
                    </View>
                    <Ionicons
                      name={expandedIdx === idx ? 'chevron-up' : 'chevron-down'}
                      size={24}
                      color="#0EA5E9"
                    />
                  </Pressable>

                  {expandedIdx === idx && (
                    <View style={styles.sectionContent}>
                      <Text
                        style={[
                          styles.contentText,
                          { color: theme.colors.text + 'AA' },
                        ]}
                      >
                        {section.content}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* CONTACT SECTION */}
          <View style={styles.contactSection}>
            <LinearGradient
              colors={['rgba(6,182,212,0.1)', 'rgba(6,182,212,0.05)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.contactCard}
            >
              <Ionicons name="mail" size={32} color="#0EA5E9" />
              <Text style={[styles.contactTitle, { color: theme.colors.text }]}>
                Sorularınız mı Var?
              </Text>
              <Text
                style={[styles.contactDesc, { color: theme.colors.text + 'AA' }]}
              >
                Yasal belgeler hakkında sorularınız için lütfen iletişime geçin
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.contactButton,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => router.push('/(tabs)/profile')}
              >
                <Text style={styles.contactButtonText}>İletişime Geçin</Text>
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
  sectionsContainer: {
    gap: 12,
    marginBottom: 32,
  },
  sectionWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.15)',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  headerContent: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Bold',
    fontWeight: '600',
    marginBottom: 4,
  },
  lastUpdated: {
    fontSize: 11,
    fontFamily: 'Poppins-Regular',
  },
  sectionContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(6,182,212,0.1)',
    backgroundColor: 'rgba(6,182,212,0.02)',
  },
  contentText: {
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    lineHeight: 22,
  },
  contactSection: {
    marginTop: 20,
    marginBottom: 32,
  },
  contactCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.2)',
    alignItems: 'center',
    gap: 12,
  },
  contactTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-Bold',
    fontWeight: '600',
    textAlign: 'center',
  },
  contactDesc: {
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  contactButton: {
    backgroundColor: '#0EA5E9',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 8,
  },
  contactButtonText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Poppins-Bold',
    fontWeight: '600',
  },
});
