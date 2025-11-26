// Abonelik Modal - Uygulama açılışında bir kez gösterilir
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as ExpoLinking from 'expo-linking';
import * as ExpoWebBrowser from 'expo-web-browser';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { authFetch } from '../utils/auth';

const { width, height } = Dimensions.get('window');

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

export function useSubscriptionModal() {
  const [visible, setVisible] = React.useState(false);
  const [subscription, setSubscription] = React.useState<Subscription | null>(null);

  const checkAndShow = React.useCallback(async () => {
    try {
      // Daha önce gösterilmiş mi kontrol et
      const shown = await AsyncStorage.getItem(STORAGE_KEY);
      const today = new Date().toDateString();
      
      // Her gün sadece 1 kez göster
      if (shown === today) {
        return;
      }

      // Kullanıcının mevcut aboneliğini kontrol et
      const response = await authFetch('/api/me/subscription');
      if (response.ok) {
        const data = await response.json();
        setSubscription(data.subscription);
        
        // Free plan ise modal'ı göster
        if (!data.subscription || data.subscription.planId === 'free') {
          setVisible(true);
          await AsyncStorage.setItem(STORAGE_KEY, today);
        }
      }
    } catch (error) {
      console.error('[SubscriptionModal] Check error:', error);
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

  React.useEffect(() => {
    if (visible) {
      fetchPlans();
    }
  }, [visible]);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const response = await authFetch('/api/plans');
      if (response.ok) {
        const data = await response.json();
        setPlans(data.plans || []);
        setCurrentPlan(data.currentPlan || 'free');
      }
    } catch (error) {
      console.error('[SubscriptionModal] Fetch plans error:', error);
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

    setProcessingPlan(planId);
    try {
      const response = await authFetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          successUrl: ExpoLinking.createURL('/'),
          cancelUrl: ExpoLinking.createURL('/')
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Checkout oluşturulamadı');
      }

      const data = await response.json();

      if (data.checkoutUrl) {
        await ExpoWebBrowser.openBrowserAsync(data.checkoutUrl, {
          dismissButtonStyle: 'close',
          presentationStyle: ExpoWebBrowser.WebBrowserPresentationStyle.FULL_SCREEN
        });

        // Ödeme sonrası subscription kontrolü
        const subRes = await authFetch('/api/me/subscription');
        if (subRes.ok) {
          const subData = await subRes.json();
          if (subData.subscription?.planId === planId) {
            Alert.alert('🎉 Hoş Geldiniz!', `${subData.subscription.planName} planınız aktifleştirildi.`);
            onSubscriptionChange?.(subData.subscription);
            onClose();
          }
        }
      }
    } catch (error: any) {
      Alert.alert('Hata', error.message || 'Ödeme sırasında bir sorun oluştu.');
    } finally {
      setProcessingPlan(null);
    }
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
        {isRecommended && (
          <View style={styles.recommendedBadge}>
            <Ionicons name="star" size={12} color="#fff" />
            <Text style={styles.recommendedText}>ÖNERİLEN</Text>
          </View>
        )}

        <View style={styles.planHeader}>
          <Text style={[styles.planTitle, isRecommended && styles.planTitleLight]}>
            {plan.title}
          </Text>
          <Text style={[styles.planPrice, isRecommended && styles.planPriceLight]}>
            {plan.priceLabel}
          </Text>
        </View>

        {plan.description && (
          <Text style={[styles.planDesc, isRecommended && styles.planDescLight]}>
            {plan.description}
          </Text>
        )}

        <View style={styles.featureList}>
          {plan.features.slice(0, 4).map((feature, idx) => (
            <View key={idx} style={styles.featureRow}>
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={isRecommended ? '#fff' : '#10b981'}
              />
              <Text style={[styles.featureText, isRecommended && styles.featureTextLight]}>
                {feature}
              </Text>
            </View>
          ))}
        </View>

        {isCurrent ? (
          <View style={styles.currentBadge}>
            <Ionicons name="checkmark-circle" size={18} color="#10b981" />
            <Text style={styles.currentText}>Mevcut Plan</Text>
          </View>
        ) : (
          <Pressable
            style={[
              styles.selectButton,
              isRecommended && styles.selectButtonRecommended,
              isFree && styles.selectButtonFree
            ]}
            onPress={() => handleSelectPlan(plan.id)}
            disabled={processingPlan !== null}
          >
            {processingPlan === plan.id ? (
              <ActivityIndicator color={isRecommended ? '#7c3aed' : '#fff'} />
            ) : (
              <Text style={[
                styles.selectButtonText,
                isRecommended && styles.selectButtonTextRecommended
              ]}>
                {isFree ? 'Ücretsiz Devam Et' : 'Planı Seç'}
              </Text>
            )}
          </Pressable>
        )}
      </Pressable>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <LinearGradient
          colors={['#0f172a', '#1e293b']}
          style={styles.gradient}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <View style={styles.iconWrapper}>
                <LinearGradient
                  colors={['#7c3aed', '#a855f7']}
                  style={styles.iconGradient}
                >
                  <Ionicons name="rocket" size={32} color="#fff" />
                </LinearGradient>
              </View>
              <Text style={styles.title}>Premium'a Geç</Text>
              <Text style={styles.subtitle}>
                Tüm özelliklerin kilidini aç ve ekibini profesyonelce yönet
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#94a3b8" />
            </Pressable>
          </View>

          {/* Plans */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#7c3aed" />
                <Text style={styles.loadingText}>Planlar yükleniyor...</Text>
              </View>
            ) : (
              <>
                {plans.filter(p => p.id !== 'free').map(renderPlan)}
                
                {/* Free option at bottom */}
                <Pressable
                  style={styles.freeOption}
                  onPress={onClose}
                >
                  <Text style={styles.freeOptionText}>
                    Ücretsiz planla devam et
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color="#64748b" />
                </Pressable>
              </>
            )}

            {/* Features comparison */}
            <View style={styles.comparisonSection}>
              <Text style={styles.comparisonTitle}>Neden Premium?</Text>
              <View style={styles.comparisonGrid}>
                <View style={styles.comparisonItem}>
                  <Ionicons name="location" size={24} color="#06b6d4" />
                  <Text style={styles.comparisonLabel}>Gerçek Zamanlı Takip</Text>
                </View>
                <View style={styles.comparisonItem}>
                  <Ionicons name="people" size={24} color="#10b981" />
                  <Text style={styles.comparisonLabel}>Sınırsız Ekip</Text>
                </View>
                <View style={styles.comparisonItem}>
                  <Ionicons name="analytics" size={24} color="#f59e0b" />
                  <Text style={styles.comparisonLabel}>Detaylı Raporlar</Text>
                </View>
                <View style={styles.comparisonItem}>
                  <Ionicons name="shield-checkmark" size={24} color="#7c3aed" />
                  <Text style={styles.comparisonLabel}>Kurumsal Güvenlik</Text>
                </View>
              </View>
            </View>

            {/* Trust badges */}
            <View style={styles.trustSection}>
              <View style={styles.trustBadge}>
                <Ionicons name="lock-closed" size={16} color="#64748b" />
                <Text style={styles.trustText}>256-bit SSL</Text>
              </View>
              <View style={styles.trustBadge}>
                <Ionicons name="card" size={16} color="#64748b" />
                <Text style={styles.trustText}>Güvenli Ödeme</Text>
              </View>
              <View style={styles.trustBadge}>
                <Ionicons name="refresh" size={16} color="#64748b" />
                <Text style={styles.trustText}>İptal Garantisi</Text>
              </View>
            </View>
          </ScrollView>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a'
  },
  gradient: {
    flex: 1
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 24,
    paddingBottom: 24
  },
  headerContent: {
    flex: 1,
    alignItems: 'center'
  },
  iconWrapper: {
    marginBottom: 16
  },
  iconGradient: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12
  },
  planCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  planCardRecommended: {
    backgroundColor: '#7c3aed',
    borderColor: '#7c3aed'
  },
  planCardCurrent: {
    borderColor: '#10b981',
    borderWidth: 2
  },
  recommendedBadge: {
    position: 'absolute',
    top: -10,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12
  },
  recommendedText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800'
  },
  planHeader: {
    marginBottom: 12
  },
  planTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4
  },
  planTitleLight: {
    color: '#fff'
  },
  planPrice: {
    fontSize: 28,
    fontWeight: '900',
    color: '#7c3aed'
  },
  planPriceLight: {
    color: '#fff'
  },
  planDesc: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 16,
    lineHeight: 20
  },
  planDescLight: {
    color: 'rgba(255,255,255,0.8)'
  },
  featureList: {
    gap: 10,
    marginBottom: 16
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  featureText: {
    color: '#e2e8f0',
    fontSize: 14,
    flex: 1
  },
  featureTextLight: {
    color: 'rgba(255,255,255,0.9)'
  },
  currentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderRadius: 12
  },
  currentText: {
    color: '#10b981',
    fontWeight: '700'
  },
  selectButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed'
  },
  selectButtonRecommended: {
    backgroundColor: '#fff'
  },
  selectButtonFree: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)'
  },
  selectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800'
  },
  selectButtonTextRecommended: {
    color: '#7c3aed'
  },
  freeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginTop: 8
  },
  freeOptionText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '600'
  },
  comparisonSection: {
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)'
  },
  comparisonTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20
  },
  comparisonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  comparisonItem: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12
  },
  comparisonLabel: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center'
  },
  trustSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 24,
    flexWrap: 'wrap'
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  trustText: {
    color: '#64748b',
    fontSize: 12
  }
});

