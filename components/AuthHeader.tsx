import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BrandLogo } from './BrandLogo';

type AuthTab = 'login' | 'register';

type AuthHeaderProps = {
  activeTab: AuthTab;
  onTabChange: (tab: AuthTab) => void;
  title?: string;
  subtitle?: string;
};

export function AuthHeader({
  activeTab,
  onTabChange,
  title,
  subtitle,
}: AuthHeaderProps) {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(20)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();
  }, [activeTab]);

  const defaultTitles = {
    login: {
      title: 'Hoş Geldiniz',
      subtitle: 'Bavaxe sistemine giriş yapın',
    },
    register: {
      title: 'Kayıt Ol',
      subtitle: 'Bavaxe hesabınızı oluşturun',
    },
  };

  const currentTitle = title || defaultTitles[activeTab].title;
  const currentSubtitle = subtitle || defaultTitles[activeTab].subtitle;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.topSection}>
        <View style={styles.logoCenterContainer}>
          <View style={styles.logoWrapper}>
            <BrandLogo size={230} withSoftContainer={true} variant="large" />
          </View>
        </View>
        <View style={styles.brandSection}>
          <View style={styles.brandTextContainer}>
            <Text style={styles.tagline}>Konum takip sistemi</Text>
          </View>
        </View>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'login' && styles.tabActive]}
          onPress={() => onTabChange('login')}
          activeOpacity={0.7}
        >
          {activeTab === 'login' ? (
            <LinearGradient
              colors={['rgba(6, 182, 212, 0.15)', 'rgba(59, 130, 246, 0.15)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.tabGradient}
            >
              <Ionicons name="log-in-outline" size={18} color="#06b6d4" />
              <Text style={styles.tabTextActive}>Giriş</Text>
            </LinearGradient>
          ) : (
            <>
              <Ionicons name="log-in-outline" size={18} color="#64748b" />
              <Text style={styles.tabText}>Giriş</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.tabDivider} />

        <TouchableOpacity
          style={[styles.tab, activeTab === 'register' && styles.tabActive]}
          onPress={() => onTabChange('register')}
          activeOpacity={0.7}
        >
          {activeTab === 'register' ? (
            <LinearGradient
              colors={['rgba(6, 182, 212, 0.15)', 'rgba(59, 130, 246, 0.15)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.tabGradient}
            >
              <Ionicons name="person-add-outline" size={18} color="#06b6d4" />
              <Text style={styles.tabTextActive}>Kayıt ol</Text>
            </LinearGradient>
          ) : (
            <>
              <Ionicons name="person-add-outline" size={18} color="#64748b" />
              <Text style={styles.tabText}>Kayıt ol</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.titleSection}>
        <Text style={styles.title}>{currentTitle}</Text>
        <Text style={styles.subtitle}>{currentSubtitle}</Text>
      </View>

      <ScrollIndicatorCompact />
    </Animated.View>
  );
}

export function ScrollIndicatorCompact() {
  const bounceAnim = React.useRef(new Animated.Value(0)).current;
  const opacityAnim = React.useRef(new Animated.Value(0.7)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(bounceAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(bounceAnim, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.7,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();
  }, []);

  const translateY = bounceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 6],
  });

  return (
    <Animated.View
      style={[
        styles.scrollIndicatorCompact,
        {
          opacity: opacityAnim,
          transform: [{ translateY }],
        },
      ]}
    >
      <Ionicons name="chevron-down" size={18} color="#06b6d4" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingTop: Platform.OS === 'ios' ? 35 : -25,
    paddingBottom: 5,
    paddingHorizontal: 24,
  },
  topSection: {
    marginBottom: 12,
    marginTop: -180,
    alignItems: 'center',
  },
  logoCenterContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    top: 90,
    marginBottom: -30,
  },
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  brandSection: {
    width: '100%',
    alignItems: 'center',
    marginTop: -4,
  },
  brandTextContainer: {
    alignItems: 'center',
  },
  tagline: {
    fontSize: 15,
    color: '#94a3b8',
    fontFamily: 'Poppins-Regular',
    fontWeight: '400',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
    borderRadius: 14,
    padding: 4,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    overflow: 'hidden',
  },
  tabActive: {
    backgroundColor: 'transparent',
  },
  tabGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  tabDivider: {
    width: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    marginVertical: 8,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
    fontFamily: 'Poppins-SemiBold',
    letterSpacing: 0.2,
  },
  tabTextActive: {
    fontSize: 15,
    fontWeight: '700',
    color: '#06b6d4',
    fontFamily: 'Poppins-Bold',
    letterSpacing: 0.3,
  },
  titleSection: {
    alignItems: 'center',
    marginTop: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    fontFamily: 'Poppins-Bold',
    letterSpacing: 0.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#94a3b8',
    fontFamily: 'Poppins-Regular',
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  scrollIndicatorCompact: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
});
