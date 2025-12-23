// Premium Subscription Modal - Modern Minimalist Design
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PremiumBackground } from './PremiumBackground';
import { getApiBase } from '../utils/api';
import PaymentScreen from './PaymentScreen';

interface Plan {
  id: string;
  title: string;
  priceLabel: string;
  monthlyPrice?: number;
  badge?: string | null;
  recommended?: boolean;
  description?: string;
  features: string[];
}

interface Subscription {
  planId: string;
  planName: string;
  status?: string;
  renewsAt?: string | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubscriptionChange?: (sub: Subscription) => void;
}

const STORAGE_KEY = 'subscription_modal_shown';

const FALLBACK_PLANS: Plan[] = [
  {
    id: 'free',
    title: 'Free',
    priceLabel: 'Ücretsiz',
    description: 'Başlangıç için temel özellikler',
    features: [
      'Temel konum takibi',
      '1 çalışma alanı',
      'Standart destek',
      '7 günlük veri saklama',
      '50 istek/dakika',
      '10 aktivite limiti'
    ]
  },
  {
    id: 'plus',
    title: 'Plus',
    priceLabel: '$20 / ay',
    monthlyPrice: 20,
    badge: 'Popüler',
    description: 'Profesyoneller için gelişmiş özellikler',
    features: [
      'Öncelikli destek',
      '5 çalışma alanı',
      'Gerçek zamanlı takip',
      'Gelişmiş raporlama',
      '90 günlük veri saklama',
      '200 istek/dakika',
      '50 aktivite limiti',
      '2000 konum geçmişi'
    ]
  },
  {
    id: 'business',
    title: 'Business',
    priceLabel: '$50 / ay',
    monthlyPrice: 50,
    badge: 'Önerilen',
    recommended: true,
    description: 'Kurumsal düzey güvenlik ve yönetim',
    features: [
      'Sınırsız çalışma alanı',
      'Takım rol yönetimi',
      'Kurumsal güvenlik raporları',
      'Özel müşteri yöneticisi',
      'API erişimi',
      'Sınırsız veri saklama',
      '500 istek/dakika',
      '200 aktivite limiti',
      '10000 konum geçmişi',
      'Sınırsız export'
    ]
  }
];

export function useSubscriptionModal() {
  const [visible, setVisible] = React.useState(false);
  const [subscription, setSubscription] = React.useState<Subscription | null>(null);

  const checkAndShow = React.useCallback(async () => {
    try {
      const response = await authFetch('/me/subscription');
      if (response.ok) {
        const data = await response.json();
        setSubscription(data.subscription);

        if (!data.subscription || data.subscription.planId === 'free') {
          const shown = await AsyncStorage.getItem(STORAGE_KEY);
          const today = new Date().toDateString();

          if (shown !== today) {
            setVisible(true);
            await AsyncStorage.setItem(STORAGE_KEY, today);
          }
        }
      } else {
        const shown = await AsyncStorage.getItem(STORAGE_KEY);
        const today = new Date().toDateString();
        if (shown !== today) {
          setVisible(true);
          await AsyncStorage.setItem(STORAGE_KEY, today);
        }
      }
    } catch (error: any) {
      const { isNetworkError } = await import('../utils/network');
      if (!isNetworkError(error)) {
      }
      try {
        const shown = await AsyncStorage.getItem(STORAGE_KEY);
        const today = new Date().toDateString();
        if (shown !== today) {
          setVisible(true);
          await AsyncStorage.setItem(STORAGE_KEY, today);
        }
      } catch (e) {
      }
    }
  }, []);

  const hide = React.useCallback(() => {
    setVisible(false);
  }, []);

  return { visible, subscription, checkAndShow, hide, setSubscription };
}

export default function SubscriptionModal({ visible, onClose, onSubscriptionChange }: Props) {
  const [plans, setPlans] = React.useState<Plan[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [processingPlan, setProcessingPlan] = React.useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = React.useState<string>('free');
  const [showPayment, setShowPayment] = React.useState(false);
  const [selectedPlan, setSelectedPlan] = React.useState<Plan | null>(null);

  React.useEffect(() => {
    if (visible) {
      fetchPlans();
    }
  }, [visible]);

  const fetchPlans = async () => {
    try {
      setLoading(true);

      const apiBase = getApiBase();
      const plansUrl = `${apiBase}/api/plans`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const plansRes = await fetch(plansUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!plansRes.ok) {
        console.warn('[SubscriptionModal] Plans fetch failed:', plansRes.status);
        setPlans(FALLBACK_PLANS);
        setLoading(false);
        return;
      }

      let plansData: any = {};
      try {
        const text = await plansRes.text();
        plansData = text ? JSON.parse(text) : {};
      } catch (parseError) {
        console.error('[SubscriptionModal] Plans parse error:', parseError);
        setPlans(FALLBACK_PLANS);
        setLoading(false);
        return;
      }

      const plansArray = plansData.plans || plansData.data?.plans || [];

      if (Array.isArray(plansArray) && plansArray.length > 0) {
        setPlans(plansArray);
        setCurrentPlan(plansData.currentPlan || plansData.data?.currentPlan || 'free');
      } else {
        console.warn('[SubscriptionModal] Plans array empty, using fallback');
        setPlans(FALLBACK_PLANS);
        setCurrentPlan('free');
      }

      try {
        const subscriptionRes = await authFetch('/me/subscription');
        if (subscriptionRes.ok) {
          const subData = await subscriptionRes.json();
          if (subData?.subscription?.planId || subData?.data?.subscription?.planId) {
            setCurrentPlan(subData.subscription?.planId || subData.data?.subscription?.planId);
          }
        }
      } catch (subError) {
        console.warn('[SubscriptionModal] Subscription fetch error:', subError);
      }
    } catch (error: any) {
      console.error('[SubscriptionModal] Fetch plans error:', error);
      if (error.name !== 'AbortError') {
        setPlans(FALLBACK_PLANS);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (planId: string) => {
    if (processingPlan) return;
    if (planId === 'free') {
      onClose();
      return;
    }

    const plan = plans.find(p => p.id === planId);
    if (!plan) {
      Alert.alert('Hata', 'Plan bulunamadı');
      return;
    }

    setProcessingPlan(planId);
    setSelectedPlan(plan);
    setShowPayment(true);
  };

  const handlePaymentSuccess = async () => {
    setShowPayment(false);
    setSelectedPlan(null);

    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      const subRes = await authFetch('/me/subscription');
      if (subRes.ok) {
        const subData = await subRes.json();
        onSubscriptionChange?.(subData.subscription);

        if (subData.subscription?.planId) {
          const { updateSubscriptionSegment } = await import('../utils/onesignalSegments');
          updateSubscriptionSegment(subData.subscription.planId as 'free' | 'plus' | 'business');
        }
        onClose();
      }
    } catch (e) {
    }
  };

  const handlePaymentCancel = () => {
    setShowPayment(false);
    setSelectedPlan(null);
    setProcessingPlan(null);
  };

  const renderPlan = (plan: Plan) => {
    const isCurrent = currentPlan === plan.id;
    const isRecommended = plan.recommended;
    const isFree = plan.id === 'free';

    return (
      <Pressable
        key={plan.id}
        style={[
          styles.planCard,
          isRecommended && styles.planCardRecommended,
          isCurrent && styles.planCardCurrent
        ]}
        onPress={() => !isCurrent && handleSelectPlan(plan.id)}
        disabled={isCurrent || processingPlan !== null}
      >
        {/* Gradient Background for Recommended */}
        {isRecommended && (
          <LinearGradient
            colors={['#6366f1', '#8b5cf6', '#a855f7']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}

        {/* Badge */}
        {isRecommended && (
          <View style={styles.badge}>
            <Ionicons name="sparkles" size={14} color="#fbbf24" />
            <Text style={styles.badgeText}>ÖNERİLEN</Text>
          </View>
        )}

        <View style={styles.planContent}>
          {/* Header */}
          <View style={styles.planHeader}>
            <Text style={[styles.planTitle, !isRecommended && styles.planTitleDark]}>
              {plan.title}
            </Text>
            <Text style={[styles.planPrice, !isRecommended && styles.planPriceDark]}>
              {plan.priceLabel}
            </Text>
          </View>

          {/* Description */}
          {plan.description && (
            <Text style={[styles.planDesc, !isRecommended && styles.planDescDark]}>
              {plan.description}
            </Text>
          )}

          {/* Features */}
          <View style={styles.featureList}>
            {plan.features.slice(0, 5).map((feature, idx) => (
              <View key={idx} style={styles.featureRow}>
                <View style={[styles.checkIcon, !isRecommended && styles.checkIconDark]}>
                  <Ionicons
                    name="checkmark"
                    size={14}
                    color={isRecommended ? '#fff' : '#10b981'}
                  />
                </View>
                <Text style={[styles.featureText, !isRecommended && styles.featureTextDark]}>
                  {feature}
                </Text>
              </View>
            ))}
          </View>

          {/* CTA */}
          {isCurrent ? (
            <View style={styles.currentBadge}>
              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              <Text style={styles.currentText}>Aktif Plan</Text>
            </View>
          ) : (
            <Pressable
              style={[
                styles.selectButton,
                isRecommended && styles.selectButtonRecommended
              ]}
              onPress={() => handleSelectPlan(plan.id)}
              disabled={processingPlan !== null}
            >
              {processingPlan === plan.id ? (
                <ActivityIndicator color={isRecommended ? '#7c3aed' : '#fff'} />
              ) : (
                <>
                  <Text style={[
                    styles.selectButtonText,
                    isRecommended && styles.selectButtonTextRecommended
                  ]}>
                    {isFree ? 'Ücretsiz Devam Et' : 'Hemen Başla'}
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={18}
                    color={isRecommended ? '#7c3aed' : '#fff'}
                  />
                </>
              )}
            </Pressable>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <>
      <Modal
        visible={visible && !showPayment}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <View style={styles.container}>
          <PremiumBackground color="#6366f1" lineCount={12} circleCount={6} />

          {/* Header */}
          <LinearGradient
            colors={['rgba(15, 23, 42, 0.95)', 'rgba(15, 23, 42, 0.8)', 'transparent']}
            style={styles.header}
          >
            <View style={styles.headerContent}>
              <View style={styles.iconContainer}>
                <LinearGradient
                  colors={['#6366f1', '#8b5cf6']}
                  style={styles.iconGradient}
                >
                  <Ionicons name="rocket-outline" size={36} color="#fff" />
                </LinearGradient>
              </View>
              <Text style={styles.title}>Premium Planlar</Text>
              <Text style={styles.subtitle}>
                Sınırsız özelliklere erişin, ekibinizi profesyonelce yönetin
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={26} color="#cbd5e1" />
            </Pressable>
          </LinearGradient>

          {/* Plans */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#6366f1" />
                <Text style={styles.loadingText}>Planlar yükleniyor...</Text>
              </View>
            ) : plans.length === 0 ? (
              <View style={styles.loadingContainer}>
                <Ionicons name="alert-circle" size={48} color="#64748b" />
                <Text style={styles.loadingText}>Planlar yüklenemedi</Text>
              </View>
            ) : (
              <>
                {plans.filter(p => p.id !== 'free').map(renderPlan)}

                {/* Free option */}
                <Pressable
                  style={styles.freeOption}
                  onPress={onClose}
                >
                  <Text style={styles.freeOptionText}>
                    Şimdilik ücretsiz planla devam et
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color="#64748b" />
                </Pressable>
              </>
            )}

            {/* Features Grid */}
            <View style={styles.featuresGrid}>
              <Text style={styles.gridTitle}>Neden Premium?</Text>
              <View style={styles.gridContainer}>
                <FeatureCard icon="flash" color="#f59e0b" label="10x Hızlı" />
                <FeatureCard icon="shield-checkmark" color="#10b981" label="Güvenli" />
                <FeatureCard icon="people" color="#6366f1" label="Takım" />
                <FeatureCard icon="analytics" color="#ec4899" label="Raporlar" />
              </View>
            </View>

            {/* Trust Badges */}
            <View style={styles.trustSection}>
              <TrustBadge icon="lock-closed" text="256-bit SSL" />
              <TrustBadge icon="card" text="Güvenli Ödeme" />
              <TrustBadge icon="refresh" text="İptal Garantisi" />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {selectedPlan && (
        <PaymentScreen
          visible={showPayment}
          planId={selectedPlan.id}
          planName={selectedPlan.title}
          amount={selectedPlan.monthlyPrice || 0}
          currency="TRY"
          onSuccess={handlePaymentSuccess}
          onCancel={handlePaymentCancel}
        />
      )}
    </>
  );
}

function FeatureCard({ icon, color, label }: any) {
  return (
    <View style={styles.featureCard}>
      <View style={[styles.featureIcon, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={styles.featureLabel}>{label}</Text>
    </View>
  );
}

function TrustBadge({ icon, text }: any) {
  return (
    <View style={styles.trustBadge}>
      <Ionicons name={icon} size={14} color="#64748b" />
      <Text style={styles.trustText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  headerContent: {
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 20,
  },
  iconGradient: {
    width: 80,
    height: 80,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 24,
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    color: '#64748b',
    marginTop: 16,
    fontSize: 15,
  },
  planCard: {
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  planCardRecommended: {
    borderWidth: 0,
  },
  planCardCurrent: {
    borderColor: '#10b981',
    borderWidth: 2,
  },
  badge: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    zIndex: 10,
  },
  badgeText: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  planContent: {
    padding: 24,
  },
  planHeader: {
    marginBottom: 12,
  },
  planTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 6,
  },
  planTitleDark: {
    color: '#f1f5f9',
  },
  planPrice: {
    fontSize: 36,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -1,
  },
  planPriceDark: {
    color: '#6366f1',
  },
  planDesc: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 20,
    lineHeight: 22,
  },
  planDescDark: {
    color: '#94a3b8',
  },
  featureList: {
    gap: 12,
    marginBottom: 24,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIconDark: {
    backgroundColor: 'rgba(16,185,129,0.15)',
  },
  featureText: {
    color: '#fff',
    fontSize: 15,
    flex: 1,
    fontWeight: '500',
  },
  featureTextDark: {
    color: '#e2e8f0',
  },
  currentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderRadius: 12,
  },
  currentText: {
    color: '#10b981',
    fontWeight: '700',
    fontSize: 16,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#6366f1',
  },
  selectButtonRecommended: {
    backgroundColor: '#fff',
  },
  selectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  selectButtonTextRecommended: {
    color: '#6366f1',
  },
  freeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 20,
    marginTop: 8,
  },
  freeOptionText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '600',
  },
  featuresGrid: {
    marginTop: 40,
    paddingTop: 32,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  gridTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 24,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  featureCard: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  featureIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  featureLabel: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  trustSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 32,
    flexWrap: 'wrap',
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trustText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '500',
  },
});
