import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PaymentScreen from '../components/PaymentScreen';
import { authFetch } from '../utils/auth';

type Plan = {
  id: string;
  title: string;
  priceLabel: string;
  monthlyPrice?: number;
  monthlyPriceTRY?: number;
  currency?: string;
  badge?: string;
  recommended?: boolean;
  buttonLabel?: string;
  description?: string;
  features: string[];
};

type Subscription = {
  planId: string;
  planName: string;
  price?: number;
  priceLabel?: string;
  renewsAt?: string | null;
  status?: string;
};

type BillingEvent = {
  id: string;
  timestamp: number | string;
  type?: string;
  planId?: string;
  planName?: string;
  amount?: number;
  currency?: string;
  interval?: string;
  description?: string;
};

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
    monthlyPriceTRY: 600,
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
    monthlyPriceTRY: 1500,
    badge: 'Önerilen',
    recommended: true,
    buttonLabel: 'Business planı seç',
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

const UpgradeScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ planId?: string }>();
  const { width } = useWindowDimensions();
  const isWide = width >= 720;

  const [plans, setPlans] = React.useState<Plan[]>(FALLBACK_PLANS);
  const [subscription, setSubscription] = React.useState<Subscription | null>(null);
  const [history, setHistory] = React.useState<BillingEvent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [processingPlan, setProcessingPlan] = React.useState<string | null>(null);
  const [showPayment, setShowPayment] = React.useState(false);
  const [selectedPlan, setSelectedPlan] = React.useState<Plan | null>(null);

  const fetchPlans = React.useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const [plansRes, subscriptionRes, historyRes] = await Promise.all([
        authFetch('/plans'),
        authFetch('/me/subscription'),
        authFetch('/billing/history')
      ]);

      if (plansRes.ok) {
        const plansData = await plansRes.json();
        if (Array.isArray(plansData.plans) && plansData.plans.length > 0) {
          interface PlanData {
            id: string;
            title: string;
            priceLabel: string;
            monthlyPrice?: number;
            monthlyPriceTRY?: number;
            badge?: string | null;
            recommended?: boolean;
            description?: string;
            features: string[];
          }
          const formattedPlans = plansData.plans.map((p: PlanData) => ({
            id: p.id,
            title: p.title,
            priceLabel: p.priceLabel,
            monthlyPrice: p.monthlyPrice,
            monthlyPriceTRY: p.monthlyPriceTRY,
            badge: p.badge || null,
            recommended: p.recommended || false,
            buttonLabel: p.id === 'business' ? 'Business planı seç' : p.id === 'plus' ? 'Plus planı seç' : 'Planı seç',
            description: p.description,
            features: Array.isArray(p.features) ? p.features : []
          }));
          setPlans(formattedPlans);
        } else {
          setPlans(FALLBACK_PLANS);
        }
      } else {
        setPlans(FALLBACK_PLANS);
      }

      if (subscriptionRes.ok) {
        const subData = await subscriptionRes.json();
        setSubscription(subData.subscription || null);
      }

      if (historyRes.ok) {
        const historyData = await historyRes.json();
        const historyArray = Array.isArray(historyData.history)
          ? historyData.history
          : Array.isArray(historyData)
            ? historyData
            : [];
        setHistory(historyArray);
      } else {
        setHistory([]);
      }
    } catch (error) {
      console.error('[UpgradeScreen] Plan fetch error:', error);
      setErrorMessage('Plan bilgileri alınamadı. Lütfen bağlantınızı kontrol edip tekrar deneyin.');
      setPlans(FALLBACK_PLANS);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  React.useEffect(() => {
    if (params.planId && plans.length > 0) {
      const plan = plans.find(p => p.id === params.planId);
      if (plan && plan.id !== 'free') {
        setSelectedPlan(plan);
        setShowPayment(true);
      }
    }
  }, [params.planId, plans]);

  const refreshSubscription = React.useCallback(async () => {
    try {
      const [subscriptionRes, historyRes] = await Promise.all([
        authFetch('/me/subscription'),
        authFetch('/billing/history')
      ]);

      if (subscriptionRes.ok) {
        const subData = await subscriptionRes.json();
        setSubscription(subData.subscription || null);
      }

      if (historyRes.ok) {
        const historyData = await historyRes.json();
        const historyArray = Array.isArray(historyData.history)
          ? historyData.history
          : Array.isArray(historyData)
            ? historyData
            : [];
        setHistory(historyArray);
      } else {
        setHistory([]);
      }

      await fetchPlans();
    } catch (error) {
      console.error('[UpgradeScreen] Subscription refresh error:', error);
    }
  }, [fetchPlans]);

  const handleSelectPlan = React.useCallback(
    async (planId: string) => {
      if (processingPlan) return;

      if (planId === 'free') {
        Alert.alert('Bilgi', 'Zaten ücretsiz plandayız veya ücretsiz plana geçiş için destek ile iletişime geçin.');
        return;
      }

      const plan = plans.find(p => p.id === planId);
      if (!plan) {
        Alert.alert('Hata', 'Plan bulunamadı');
        return;
      }

      setSelectedPlan(plan);
      setShowPayment(true);
    },
    [processingPlan, plans]
  );

  const handlePaymentSuccess = React.useCallback(async () => {
    setShowPayment(false);
    setSelectedPlan(null);

    await refreshSubscription();

    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      const subRes = await authFetch('/me/subscription');
      if (subRes.ok) {
        const subData = await subRes.json();
        if (subData.subscription) {
          Alert.alert(
            '🎉 Ödeme Başarılı!',
            `${subData.subscription.planName} planınız aktifleştirildi.`,
            [{ text: 'Tamam', style: 'default' }]
          );
        }
      }
    } catch (e) {
      console.error('[UpgradeScreen] Subscription check error:', e);
    }
  }, [refreshSubscription]);

  const handlePaymentCancel = React.useCallback(() => {
    setShowPayment(false);
    setSelectedPlan(null);
  }, []);

  React.useEffect(() => {
    if (showPayment) {
      refreshSubscription();
    }
  }, [showPayment, refreshSubscription]);

  const formatDate = (timestamp?: number | string) => {
    if (!timestamp) return '';
    const date = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp);
    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const renderPlanCard = (plan: Plan) => {
    const isCurrent = subscription?.planId === plan.id;
    const isRecommended = Boolean(plan.recommended);
    const isFree = plan.id === 'free';
    const cardStyles = [
      styles.planCard,
      isWide ? styles.planCardHalf : styles.planCardFull,
      isRecommended ? styles.planCardHighlight : isFree ? styles.planCardFree : styles.planCardDefault
    ];

    return (
      <View key={plan.id} style={cardStyles}>
        <View style={styles.planHeader}>
          <View style={styles.badgeRow}>
            {isCurrent ? (
              <View style={[styles.badge, styles.badgeCurrent]}>
                <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                <Text style={[styles.badgeText, styles.badgeCurrentText]}>Mevcut plan</Text>
              </View>
            ) : plan.badge ? (
              <View style={[styles.badge, isRecommended ? styles.badgeRecommended : styles.badgeDefault]}>
                <Ionicons name={isRecommended ? 'sparkles-outline' : 'star-outline'} size={16} color="#fff" />
                <Text style={styles.badgeText}>{plan.badge}</Text>
              </View>
            ) : null}
          </View>

          <Text style={[styles.planTitle, isRecommended && styles.planTitleHighlight]}>{plan.title}</Text>
          <Text style={[styles.planPrice, isRecommended && styles.planPriceHighlight]}>{plan.priceLabel}</Text>
          {plan.description ? (
            <Text style={[styles.planDescription, isRecommended && styles.planDescriptionHighlight]}>
              {plan.description}
            </Text>
          ) : null}
        </View>

        <View style={styles.featureList}>
          {plan.features.map((feature) => (
            <View key={feature} style={styles.featureRow}>
              <View style={[styles.featureBullet, isRecommended && styles.featureBulletHighlight]} />
              <Text style={[styles.featureText, isRecommended && styles.featureTextHighlight]}>{feature}</Text>
            </View>
          ))}
        </View>

        {isCurrent ? (
          <View style={styles.currentPlanFoot}>
            <Ionicons name="shield-checkmark" size={18} color="#10b981" />
            <Text style={styles.currentPlanText}>Bu plan aktif</Text>
          </View>
        ) : isFree ? (
          <View style={styles.currentPlanFoot}>
            <Ionicons name="checkmark-circle" size={18} color="#64748b" />
            <Text style={[styles.currentPlanText, { color: '#64748b' }]}>Varsayılan plan</Text>
          </View>
        ) : (
          <TouchableOpacity
            activeOpacity={0.9}
            style={[
              styles.ctaButton,
              isRecommended ? styles.ctaButtonPrimary : styles.ctaButtonGhost,
              processingPlan === plan.id && styles.ctaButtonDisabled
            ]}
            disabled={processingPlan === plan.id}
            onPress={() => handleSelectPlan(plan.id)}
          >
            {processingPlan === plan.id ? (
              <ActivityIndicator color={isRecommended ? '#050509' : '#fff'} />
            ) : (
              <>
                <Text style={[styles.ctaButtonText, isRecommended ? styles.ctaButtonTextPrimary : styles.ctaButtonTextGhost]}>
                  {plan.buttonLabel || 'Bu planı seç'}
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color={isRecommended ? '#050509' : '#fff'}
                  style={{ marginLeft: 6 }}
                />
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#07070D', '#050509']} style={styles.hero}>
        <View style={styles.heroHeader}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.heroTitle}>Planını yükselt</Text>
          <Text style={styles.heroSubtitle}>
            Daha fazla workspace, premium destek ve gelişmiş güvenlik kontrolleriyle takımını bir üst seviyeye taşı.
          </Text>
          {subscription ? (
            <View style={styles.subscriptionPill}>
              <Ionicons name="sparkles" size={16} color="#a855f7" />
              <Text style={styles.subscriptionPillText}>
                Aktif plan: {subscription.planName}{' '}
                {subscription.renewsAt ? `• Yenileme: ${formatDate(subscription.renewsAt)}` : ''}
              </Text>
            </View>
          ) : null}
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 48, paddingHorizontal: 20, gap: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Ionicons name="warning" size={18} color="#f97316" />
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </View>
        ) : null}

        <View style={[styles.cardsRow, isWide && styles.cardsRowWide]}>
          {loading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color="#a855f7" />
              <Text style={styles.loadingText}>Planlar yükleniyor...</Text>
            </View>
          ) : (
            <>
              {plans.filter(p => p.id !== 'free').map(renderPlanCard)}
              {plans.find(p => p.id === 'free') && renderPlanCard(plans.find(p => p.id === 'free')!)}
            </>
          )}
        </View>

        <View style={styles.historyCard}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Abonelik hareketleri</Text>
            <TouchableOpacity onPress={fetchPlans} style={styles.historyRefresh} activeOpacity={0.8}>
              <Ionicons name="refresh" size={18} color="#a855f7" />
              <Text style={styles.historyRefreshText}>Yenile</Text>
            </TouchableOpacity>
          </View>

          {!history || !Array.isArray(history) || history.length === 0 ? (
            <Text style={styles.historyEmpty}>Henüz bir abonelik hareketi kaydı yok.</Text>
          ) : (
            Array.isArray(history) && history.map((entry) => (
              <View key={entry.id} style={styles.historyItem}>
                <View style={styles.historyBullet} />
                <View style={styles.historyDetails}>
                  <Text style={styles.historyLabel}>{entry.description || entry.type || 'Plan güncellemesi'}</Text>
                  <Text style={styles.historyMeta}>
                    {(entry.planName || entry.planId || '').toString()} • {formatDate(entry.timestamp)}
                  </Text>
                </View>
                {typeof entry.amount === 'number' ? (
                  <Text style={styles.historyAmount}>
                    ₺{entry.amount}/{entry.interval === 'yearly' ? 'yıl' : 'ay'}
                  </Text>
                ) : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {selectedPlan && (
        <PaymentScreen
          visible={showPayment}
          planId={selectedPlan.id}
          planName={selectedPlan.title}
          amount={selectedPlan.monthlyPriceTRY || selectedPlan.monthlyPrice ||
            (selectedPlan.priceLabel ? parseInt(selectedPlan.priceLabel.replace(/[^\d]/g, '')) : 0)}
          currency={selectedPlan.currency || 'USD'}
          onSuccess={handlePaymentSuccess}
          onCancel={handlePaymentCancel}
        />
      )}
    </SafeAreaView>
  );
};

export default UpgradeScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#050509'
  },
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 16
  },
  heroHeader: {
    gap: 14
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  heroTitle: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 0.3
  },
  heroSubtitle: {
    color: '#c7c7d1',
    fontSize: 15,
    lineHeight: 22
  },
  subscriptionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(168,85,247,0.12)',
    borderRadius: 999
  },
  subscriptionPillText: {
    color: '#e9d5ff',
    fontSize: 13,
    fontWeight: '600'
  },
  content: {
    flex: 1
  },
  cardsRow: {
    width: '100%'
  },
  cardsRowWide: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16
  },
  planCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 16 },
    shadowRadius: 30,
    elevation: 16
  },
  planCardFull: {
    width: '100%'
  },
  planCardHalf: {
    flex: 1
  },
  planCardDefault: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)'
  },
  planCardFree: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)'
  },
  planCardHighlight: {
    backgroundColor: '#5E33D1'
  },
  planHeader: {
    marginBottom: 18,
    gap: 12
  },
  planTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#f4f4ff'
  },
  planTitleHighlight: {
    color: '#ffffff'
  },
  planPrice: {
    fontSize: 34,
    fontWeight: '900',
    color: '#fff'
  },
  planPriceHighlight: {
    color: '#fff'
  },
  planDescription: {
    color: '#9ea0b4',
    fontSize: 14,
    lineHeight: 20
  },
  planDescriptionHighlight: {
    color: 'rgba(255,255,255,0.9)'
  },
  badgeRow: {
    flexDirection: 'row'
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999
  },
  badgeDefault: {
    backgroundColor: 'rgba(255,255,255,0.08)'
  },
  badgeRecommended: {
    backgroundColor: 'rgba(255,255,255,0.25)'
  },
  badgeCurrent: {
    backgroundColor: 'rgba(16,185,129,0.15)'
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700'
  },
  badgeCurrentText: {
    color: '#10b981'
  },
  featureList: {
    gap: 12,
    marginBottom: 20
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  featureBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6b7280'
  },
  featureBulletHighlight: {
    backgroundColor: '#fff'
  },
  featureText: {
    color: '#d1d5db',
    fontSize: 14,
    flex: 1,
    fontWeight: '600'
  },
  featureTextHighlight: {
    color: 'rgba(255,255,255,0.95)'
  },
  currentPlanFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(16,185,129,0.08)'
  },
  currentPlanText: {
    color: '#d1fae5',
    fontWeight: '700'
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5
  },
  ctaButtonPrimary: {
    backgroundColor: '#fff',
    borderColor: '#fff'
  },
  ctaButtonGhost: {
    borderColor: 'rgba(255,255,255,0.4)'
  },
  ctaButtonDisabled: {
    opacity: 0.6
  },
  ctaButtonText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3
  },
  ctaButtonTextPrimary: {
    color: '#050509'
  },
  ctaButtonTextGhost: {
    color: '#fff'
  },
  historyCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)'
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  historyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800'
  },
  historyRefresh: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(168,85,247,0.12)'
  },
  historyRefreshText: {
    color: '#c084fc',
    fontWeight: '700'
  },
  historyEmpty: {
    color: '#9ca3af',
    fontSize: 14
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 12
  },
  historyBullet: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#a855f7'
  },
  historyDetails: {
    flex: 1
  },
  historyLabel: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15
  },
  historyMeta: {
    color: '#9ca3af',
    fontSize: 13,
    marginTop: 2
  },
  historyAmount: {
    color: '#c084fc',
    fontWeight: '800'
  },
  loadingCard: {
    width: '100%',
    paddingVertical: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)'
  },
  loadingText: {
    color: '#9ca3af',
    marginTop: 12,
    fontWeight: '600'
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(249,115,22,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.4)'
  },
  errorBannerText: {
    flex: 1,
    color: '#fed7aa',
    fontWeight: '600'
  }
});

