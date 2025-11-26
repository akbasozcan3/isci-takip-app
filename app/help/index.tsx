import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface HelpItem {
  id: string;
  icon: string;
  title: string;
  description: string;
  action: () => void;
}

export default function HelpScreen() {
  const router = useRouter();

  const helpItems: HelpItem[] = [
    {
      id: '1',
      icon: 'book-outline',
      title: 'Kullanım Kılavuzu',
      description: 'Uygulamayı nasıl kullanacağınızı öğrenin',
      action: () => router.push('/blog' as any),
    },
    {
      id: '2',
      icon: 'chatbubbles-outline',
      title: 'Sıkça Sorulan Sorular',
      description: 'En çok merak edilen soruların cevapları',
      action: () => {
        // FAQ sayfasına yönlendir
      },
    },
    {
      id: '3',
      icon: 'mail-outline',
      title: 'E-posta Desteği',
      description: 'ozcanakbas38@gmail.com',
      action: () => {
        Linking.openURL('mailto:ozcanakbas38@gmail.com');
      },
    },
    {
      id: '4',
      icon: 'call-outline',
      title: 'Telefon Desteği',
      description: '+90 (532) 710 43 55',
      action: () => {
        Linking.openURL('tel:+905327104355');
      },
    },
    {
      id: '5',
      icon: 'logo-whatsapp',
      title: 'WhatsApp Desteği',
      description: 'Hızlı destek için WhatsApp',
      action: () => {
        Linking.openURL('https://wa.me/905327104355');
      },
    },
    {
      id: '6',
      icon: 'bug-outline',
      title: 'Hata Bildir',
      description: 'Bir sorun mu buldunuz? Bize bildirin',
      action: () => {
        Linking.openURL('mailto:ozcanakbas38@gmail.com?subject=Hata%20Bildirimi');
      },
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" />
      
      <LinearGradient colors={['#06b6d4', '#0ea5a4']} style={styles.header}>
        <View style={styles.headerInner}>
          <Pressable 
            onPress={() => router.back()} 
            style={styles.backButton}
            android_ripple={{ color: 'rgba(255,255,255,0.3)', borderless: true, radius: 20 }}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Yardım & Destek</Text>
            <Text style={styles.headerSubtitle}>Size nasıl yardımcı olabiliriz?</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color="#06b6d4" />
          <Text style={styles.infoText}>
            7/24 destek ekibimiz size yardımcı olmak için hazır. Aşağıdaki iletişim kanallarından bize ulaşabilirsiniz.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>İletişim Kanalları</Text>
          
          {helpItems.map((item) => (
            <Pressable
              key={item.id}
              style={styles.helpCard}
              onPress={item.action}
              android_ripple={{ color: 'rgba(6, 182, 212, 0.1)' }}
            >
              <View style={styles.helpIcon}>
                <Ionicons name={item.icon as any} size={24} color="#06b6d4" />
              </View>
              <View style={styles.helpContent}>
                <Text style={styles.helpTitle}>{item.title}</Text>
                <Text style={styles.helpDescription}>{item.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#64748b" />
            </Pressable>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Uygulama Bilgileri</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Versiyon</Text>
            <Text style={styles.infoValue}>1.0.0</Text>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Son Güncelleme</Text>
            <Text style={styles.infoValue}>4 Kasım 2025</Text>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Geliştirici</Text>
            <Text style={styles.infoValue}>Bavaxe Teknoloji</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © 2024 Bavaxe. Tüm hakları saklıdır.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    paddingTop: StatusBar.currentHeight ?? 20,
    paddingHorizontal: 20,
    paddingBottom: 22,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0.5,
    fontFamily: 'Poppins-Bold',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 18,
    marginTop: 12,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.2)',
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 15,
    color: '#94a3b8',
    lineHeight: 22,
    fontFamily: 'Poppins-Regular',
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 16,
    letterSpacing: 0.3,
    fontFamily: 'Poppins-Bold',
  },
  helpCard: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  helpIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  helpContent: {
    flex: 1,
  },
  helpTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 6,
    fontFamily: 'Poppins-Bold',
    letterSpacing: 0.2,
  },
  helpDescription: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
    fontFamily: 'Poppins-Regular',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoLabel: {
    fontSize: 15,
    color: '#94a3b8',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  footerText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
});
