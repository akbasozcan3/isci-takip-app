import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BrandLogo } from './BrandLogo';
import { useTheme } from './ui/theme/ThemeContext';
import { getApiBase } from '../utils/api';

const { width } = Dimensions.get('window');

interface FooterConfig {
  socialLinks?: Array<{ platform: string; url: string; label: string }>;
  links?: {
    product?: Array<{ label: string; href: string }>;
    company?: Array<{ label: string; href: string }>;
    resources?: Array<{ label: string; href: string }>;
    legal?: Array<{ label: string; href: string }>;
  };
  copyright?: string;
  tagline?: string;
}

export function Footer() {
  const theme = useTheme();
  const router = useRouter();
  const [config, setConfig] = useState<FooterConfig | null>(null);

  const currentYear = new Date().getFullYear();
  const isWide = width >= 768;

  /* ---------------- FETCH CONFIG ---------------- */
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch(`${getApiBase()}/app/config`);
        const json = await res.json();
        if (json?.success && json?.data?.footer) {
          setConfig(json.data.footer);
        }
      } catch {
        console.warn('Footer config alınamadı, default kullanılıyor.');
      }
    };
    fetchConfig();
  }, []);

  /* ---------------- DEFAULT DATA ---------------- */
  const footerSections = useMemo(() => {
    if (!config?.links) {
      return [
        {
          title: 'Ürün',
          links: [
            { label: 'Özellikler', href: '/product' },
            { label: 'Fiyatlandırma', href: '/upgrade' },
            { label: 'Güvenlik', href: '/product' },
            { label: 'API', href: '/product' },
          ],
        },
        {
          title: 'Şirket',
          links: [
            { label: 'Hakkımızda', href: '/company' },
            { label: 'Blog', href: '/blog' },
            { label: 'Kariyer', href: '/company' },
            { label: 'İletişim', href: '/company' },
          ],
        },
        {
          title: 'Kaynaklar',
          links: [
            { label: 'Dokümantasyon', href: '/resources' },
            { label: 'Rehberler', href: '/resources' },
            { label: 'API Referansı', href: '/resources' },
            { label: 'Yardım Merkezi', href: '/resources' },
          ],
        },
        {
          title: 'Yasal',
          links: [
            { label: 'Gizlilik Politikası', href: '/legal' },
            { label: 'Kullanım Şartları', href: '/legal' },
            { label: 'KVKK', href: '/legal' },
            { label: 'Çerez Politikası', href: '/legal' },
          ],
        },
      ];
    }

    return Object.entries(config.links).map(([key, value]) => ({
      title:
        key === 'product'
          ? 'Ürün'
          : key === 'company'
            ? 'Şirket'
            : key === 'resources'
              ? 'Kaynaklar'
              : 'Yasal',
      links: value || [],
    }));
  }, [config]);

  const socialLinks = useMemo(() => {
    const map: Record<string, string> = {
      twitter: 'logo-twitter',
      linkedin: 'logo-linkedin',
      github: 'logo-github',
      email: 'mail',
    };

    if (!config?.socialLinks) {
      return [
        { icon: 'logo-twitter', url: 'https://twitter.com/bavaxe' },
        { icon: 'logo-linkedin', url: 'https://linkedin.com/company/bavaxe' },
        { icon: 'logo-github', url: 'https://github.com/bavaxe' },
        { icon: 'mail', url: 'mailto:support@bavaxe.com' },
      ];
    }

    return config.socialLinks.map(s => ({
      icon: map[s.platform] || 'link',
      url: s.url,
    }));
  }, [config]);

  const tagline =
    config?.tagline || 'Profesyonel GPS Takip ve İş Yönetim Platformu';
  const copyright =
    config?.copyright ||
    `© ${currentYear} Bavaxe. Tüm hakları saklıdır.`;

  /* ---------------- NAVIGATION ---------------- */
  const go = (href: string) => {
    if (href.startsWith('http') || href.startsWith('mailto')) {
      Linking.openURL(href);
    } else {
      router.push(href as any);
    }
  };

  /* ---------------- RENDER ---------------- */
  return (
    <LinearGradient
      colors={['#020617', '#0f172a', '#020617']}
      style={styles.wrapper}
    >
      <View style={styles.container}>
        {/* TOP */}
        <View
          style={[
            styles.top,
            { flexDirection: isWide ? 'row' : 'column' },
          ]}
        >
          {/* BRAND */}
          <View style={styles.brand}>
            <BrandLogo size={300} style={{ marginTop: -70 }} variant="large" />
            <Text style={[styles.tagline, { color: theme.colors.text }]}>
              {tagline}
            </Text>

            <View style={styles.socials}>
              {socialLinks.map((s, i) => (
                <Pressable
                  key={i}
                  onPress={() => go(s.url)}
                  hitSlop={10}
                  style={({ pressed }) => [
                    styles.socialBtn,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Ionicons name={s.icon as any} size={20} color="#0EA5E9" />
                </Pressable>
              ))}
            </View>
          </View>

          {/* LINKS */}
          <View style={styles.links}>
            {footerSections.map((section, i) => (
              <View key={i} style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                  {section.title}
                </Text>
                {section.links.map((l, j) => (
                  <Pressable key={j} onPress={() => go(l.href)}>
                    <Text
                      style={[
                        styles.link,
                        { color: theme.colors.text + 'CC' },
                      ]}
                    >
                      {l.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>
        </View>

        {/* DIVIDER */}
        <View style={styles.divider} />

        {/* BOTTOM */}
        <View style={styles.bottom}>
          <Text style={[styles.copy, { color: theme.colors.text + '99' }]}>
            {copyright}
          </Text>

          <View style={styles.bottomLinks}>
            {['Gizlilik', 'Ayarlar'].map((t, i) => (
              <Text key={i} style={styles.bottomLink}>
                {t}
              </Text>
            ))}
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    paddingTop: 80,
    paddingBottom: Platform.OS === 'ios' ? 56 : 44,
    backgroundColor: '#020617',
  },
  container: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 24,
  },
  top: {
    gap: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    maxWidth: 500,
    gap: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagline: {
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.9,
    fontFamily: 'Poppins-SemiBold',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  socials: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  socialBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(6,182,212,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6,182,212,0.08)',
  },
  links: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    marginTop: 8,
  },
  section: {
    minWidth: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    marginBottom: 16,
    fontFamily: 'Poppins-Bold',
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  link: {
    fontSize: 13,
    marginBottom: 12,
    fontFamily: 'Poppins-Regular',
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(6,182,212,0.2)',
    marginVertical: 48,
  },
  bottom: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 24,
    paddingTop: 8,
  },
  copy: {
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    letterSpacing: 0.2,
  },
  bottomLinks: {
    flexDirection: 'row',
    gap: 24,
  },
  bottomLink: {
    fontSize: 12,
    color: '#64a3b8',
    fontFamily: 'Poppins-Regular',
    letterSpacing: 0.3,
  },
});
