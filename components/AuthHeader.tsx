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
  // Animation values
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(20)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.95)).current;
  const logoFadeAnim = React.useRef(new Animated.Value(0)).current;
  const logoScaleAnim = React.useRef(new Animated.Value(0.9)).current;

  React.useEffect(() => {
    // Logo animation - delayed and smooth
    Animated.sequence([
      Animated.delay(100),
      Animated.parallel([
        Animated.timing(logoFadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.spring(logoScaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Content animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 9,
        tension: 50,
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
          transform: [
            { translateY: slideAnim },
            { scale: scaleAnim }
          ],
        },
      ]}
    >
      {/* Logo Section with Animation */}
      <View style={styles.topSection}>
        <Animated.View
          style={[
            styles.logoCenterContainer,
            {
              opacity: logoFadeAnim,
              transform: [{ scale: logoScaleAnim }]
            }
          ]}
        >
          <View style={styles.logoWrapper}>
            <BrandLogo size={280} withSoftContainer={true} variant="large" />
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.brandSection,
            { opacity: fadeAnim }
          ]}
        >
          <View style={styles.brandTextContainer}>
            <Text style={styles.tagline}>Konum Takip Sistemi</Text>
          </View>
        </Animated.View>
      </View>

      {/* Tab Container with smooth transitions */}
      <Animated.View
        style={[
          styles.tabContainer,
          { opacity: fadeAnim }
        ]}
      >
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
              <Ionicons name="log-in-outline" size={18} color="#0EA5E9" />
              <Text style={styles.tabTextActive}>Giriş Yap</Text>
            </LinearGradient>
          ) : (
            <>
              <Ionicons name="log-in-outline" size={18} color="#64748b" />
              <Text style={styles.tabText}>Giriş Yap</Text>
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
              <Ionicons name="person-add-outline" size={18} color="#0EA5E9" />
              <Text style={styles.tabTextActive}>Kayıt ol</Text>
            </LinearGradient>
          ) : (
            <>
              <Ionicons name="person-add-outline" size={18} color="#64748b" />
              <Text style={styles.tabText}>Kayıt ol</Text>
            </>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Title Section with fade animation */}
      <Animated.View
        style={[
          styles.titleSection,
          { opacity: fadeAnim }
        ]}
      >
        <Text style={styles.title}>{currentTitle}</Text>
        <Text style={styles.subtitle}>{currentSubtitle}</Text>
      </Animated.View>

      <ScrollIndicatorCompact />
    </Animated.View>
  );
}

export function ScrollIndicatorCompact() {
  const bounceAnim = React.useRef(new Animated.Value(0)).current;
  const opacityAnim = React.useRef(new Animated.Value(0.5)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(bounceAnim, {
            toValue: 1,
            duration: 1400,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 1400,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(bounceAnim, {
            toValue: 0,
            duration: 1400,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.5,
            duration: 1400,
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();
  }, []);

  const translateY = bounceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 8],
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
      <Ionicons name="chevron-down" size={20} color="#0EA5E9" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingTop: Platform.OS === 'ios' ? 15 : -45,
    paddingBottom: 0,
    paddingHorizontal: 24,
  },
  topSection: {
    marginBottom: 5,
    marginTop: -150,
    alignItems: 'center',
  },
  logoCenterContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    top: 45,
    marginBottom: 0,
  },
  logoWrapper: {
    top: 61,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  brandSection: {
    width: '100%',
    alignItems: 'center',
    marginTop: -6,
  },
  brandTextContainer: {
    alignItems: 'center',
  },
  tagline: {
    fontSize: 13,
    color: '#94a3b8',
    fontFamily: 'Poppins-Medium',
    fontWeight: '500',
    letterSpacing: 0.5,
    top: -8,
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
    borderRadius: 14,
    padding: 3,
    marginBottom: 10,
    borderWidth: 0,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 11,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  tabActive: {
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
  },
  tabGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 11,
  },
  tabDivider: {
    width: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
    marginVertical: 10,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
    fontFamily: 'Poppins-Medium',
    letterSpacing: 0.2,
  },
  tabTextActive: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0EA5E9',
    fontFamily: 'Poppins-SemiBold',
    letterSpacing: 0.3,
  },
  titleSection: {
    alignItems: 'center',
    marginTop: 0,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
    fontFamily: 'Poppins-Bold',
    letterSpacing: 0.5,
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    fontFamily: 'Poppins-Regular',
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
    letterSpacing: 0.2,
  },
  scrollIndicatorCompact: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 0,
  },
});
