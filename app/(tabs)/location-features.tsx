// Konum Özellikleri Ekranı - Aile Paylaşımı, Kurye, Numaradan Bulma, Yol Takip
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NetworkStatusIcon } from '../../components/NetworkStatusIcon';
import { useToast } from '../../components/Toast';
import { getApiBase } from '../../utils/api';
import { authFetch } from '../../utils/auth';
import { shareLocation } from '../../utils/locationShare';

const API_BASE = getApiBase();

interface ActiveGroup {
  id: string;
  code: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  memberCount: number;
  onlineCount: number;
  userRole: string;
  isAdmin: boolean;
}

interface FamilyMember {
  userId: string;
  name: string;
  phone: string;
  relation: string;
  location?: {
    lat: number;
    lng: number;
    timestamp: number;
    isActive: boolean;
  };
}

interface Delivery {
  deliveryId: string;
  recipientName: string;
  recipientPhone: string;
  destination: { lat: number; lng: number };
  status: 'pending' | 'in_progress' | 'delivered' | 'cancelled';
  currentLocation?: { lat: number; lng: number; timestamp: number };
}

export default function LocationFeaturesScreen() {
  const router = useRouter();
  const { showError, showSuccess, showWarning, showInfo } = useToast();
  
  const [fontsLoaded] = useFonts({
    'Poppins-Black': require('../assets/Poppins-Black.ttf'),
    'Poppins-BlackItalic': require('../assets/Poppins-BlackItalic.ttf'),
    'Poppins-Bold': require('../assets/Poppins-Bold.ttf'),
    'Poppins-BoldItalic': require('../assets/Poppins-BoldItalic.ttf'),
    'Poppins-ExtraBold': require('../assets/Poppins-ExtraBold.ttf'),
    'Poppins-ExtraBoldItalic': require('../assets/Poppins-ExtraBoldItalic.ttf'),
    'Poppins-ExtraLight': require('../assets/Poppins-ExtraLight.ttf'),
    'Poppins-ExtraLightItalic': require('../assets/Poppins-ExtraLightItalic.ttf'),
    'Poppins-Italic': require('../assets/Poppins-Italic.ttf'),
    'Poppins-Light': require('../assets/Poppins-Light.ttf'),
    'Poppins-LightItalic': require('../assets/Poppins-LightItalic.ttf'),
    'Poppins-Medium': require('../assets/Poppins-Medium.ttf'),
    'Poppins-MediumItalic': require('../assets/Poppins-MediumItalic.ttf'),
    'Poppins-Regular': require('../assets/Poppins-Regular.ttf'),
    'Poppins-SemiBold': require('../assets/Poppins-SemiBold.ttf'),
    'Poppins-SemiBoldItalic': require('../assets/Poppins-SemiBoldItalic.ttf'),
    'Poppins-Thin': require('../assets/Poppins-Thin.ttf'),
    'Poppins-ThinItalic': require('../assets/Poppins-ThinItalic.ttf'),
  });
  
  const [activeTab, setActiveTab] = React.useState<'family' | 'courier' | 'phone' | 'route'>('family');
  const [loading, setLoading] = React.useState(false);
  const [userId, setUserId] = React.useState('');
  const [activeGroups, setActiveGroups] = React.useState<ActiveGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = React.useState<ActiveGroup | null>(null);
  const [userPlan, setUserPlan] = React.useState<{ planId: string; limits: any } | null>(null);
  
  // Aile Paylaşımı
  const [familyMembers, setFamilyMembers] = React.useState<FamilyMember[]>([]);
  const [addFamilyModal, setAddFamilyModal] = React.useState(false);
  const [familyIdentifier, setFamilyIdentifier] = React.useState('');
  const [familyName, setFamilyName] = React.useState('');
  const [familyRelation, setFamilyRelation] = React.useState('family');
  
  // Numaradan Bulma
  const [phoneSearch, setPhoneSearch] = React.useState('');
  const [phoneResult, setPhoneResult] = React.useState<any>(null);
  
  // Kurye
  const [deliveries, setDeliveries] = React.useState<Delivery[]>([]);
  const [newDeliveryModal, setNewDeliveryModal] = React.useState(false);
  const [deliveryName, setDeliveryName] = React.useState('');
  const [deliveryPhone, setDeliveryPhone] = React.useState('');
  const [deliveryAddress, setDeliveryAddress] = React.useState('');
  const [deliveryLat, setDeliveryLat] = React.useState('');
  const [deliveryLng, setDeliveryLng] = React.useState('');
  const [geocodingAddress, setGeocodingAddress] = React.useState(false);
  
  // Yol Takip
  const [routes, setRoutes] = React.useState<any[]>([]);
  const [currentRoute, setCurrentRoute] = React.useState<any>(null);

  const lastLoadTime = React.useRef<Record<string, number>>({});
  const LOAD_CACHE_TIME = 5000;

  const shouldLoad = React.useCallback((key: string) => {
    const now = Date.now();
    const lastTime = lastLoadTime.current[key] || 0;
    if (now - lastTime < LOAD_CACHE_TIME) {
      return false;
    }
    lastLoadTime.current[key] = now;
    return true;
  }, []);

  const loadDeliveries = React.useCallback(async () => {
    if (!shouldLoad('deliveries')) return;
    if (!selectedGroup) {
      setDeliveries([]);
      return;
    }
    try {
      setLoading(true);
      const res = await authFetch(`/location/deliveries?groupId=${selectedGroup.id}`);
      if (res.ok) {
        const data = await res.json();
        setDeliveries(data.data?.deliveries || data.deliveries || []);
      } else {
        const errorData = await res.json().catch(() => ({}));
        if (res.status === 429) {
          showWarning('Çok fazla istek. Lütfen birkaç saniye bekleyin.');
        } else if (res.status !== 404) {
          console.error('Load deliveries error:', errorData);
        }
        setDeliveries([]);
      }
    } catch (error: any) {
      if (error.message?.includes('rate limit') || error.message?.includes('429')) {
        showWarning('Çok fazla istek. Lütfen birkaç saniye bekleyin.');
      } else {
        console.error('Load deliveries error:', error);
      }
      setDeliveries([]);
    } finally {
      setLoading(false);
    }
  }, [selectedGroup, shouldLoad, showWarning]);

  const loadFamilyMembers = React.useCallback(async () => {
    if (!shouldLoad('family')) return;
    if (!selectedGroup) {
      setFamilyMembers([]);
      return;
    }
    try {
      setLoading(true);
      const res = await authFetch(`/location/family?groupId=${selectedGroup.id}`);
      if (res.ok) {
        const data = await res.json();
        setFamilyMembers(data.data?.members || []);
      } else {
        const errorData = await res.json().catch(() => ({}));
        if (res.status === 429) {
          showWarning('Çok fazla istek. Lütfen birkaç saniye bekleyin.');
        }
      }
    } catch (error: any) {
      if (error.message?.includes('rate limit') || error.message?.includes('429')) {
        showWarning('Çok fazla istek. Lütfen birkaç saniye bekleyin.');
      } else {
        console.error('Load family members error:', error);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedGroup, shouldLoad, showWarning]);

  const addFamilyMember = React.useCallback(async () => {
    if (!familyIdentifier.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      showError('İsim veya ID gereklidir');
      return;
    }

    if (!selectedGroup) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      showError('Grup seçilmedi. Aile üyesi eklemek için önce bir grup seçmelisiniz.');
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setLoading(true);
      const identifier = familyIdentifier.trim();
      const isUserId = /^[a-zA-Z0-9_-]+$/.test(identifier) && identifier.length > 5;
      
      const res = await authFetch('/location/family/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: isUserId ? identifier : undefined,
          name: isUserId ? undefined : identifier,
          displayName: familyName.trim() || undefined,
          relation: familyRelation,
          groupId: selectedGroup.id
        })
      });

      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showSuccess('Aile üyesi eklendi!');
        setAddFamilyModal(false);
        setFamilyIdentifier('');
        setFamilyName('');
        lastLoadTime.current['family'] = 0;
        loadFamilyMembers();
      } else {
        const error = await res.json();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        if (res.status === 403 && error.planId) {
          showError(error.error || 'Plan limiti aşıldı');
          setTimeout(() => {
            router.push('/UpgradeScreen');
          }, 2000);
        } else {
          showError(error.error || 'Aile üyesi eklenemedi');
        }
      }
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showError(error.message || 'Aile üyesi eklenemedi');
    } finally {
      setLoading(false);
    }
  }, [familyIdentifier, familyName, familyRelation, selectedGroup, showError, showSuccess, loadFamilyMembers, router]);

  // Aktif grupları yükle
  const loadActiveGroups = React.useCallback(async () => {
    if (!userId) return;
    try {
      const res = await authFetch(`/groups/user/${userId}/active`);
      if (res.ok) {
        const groups = await res.json();
        setActiveGroups(Array.isArray(groups) ? groups : []);
        if (Array.isArray(groups) && groups.length > 0 && !selectedGroup) {
          setSelectedGroup(groups[0]);
        }
      } else {
        setActiveGroups([]);
      }
    } catch (error: any) {
      console.error('Load active groups error:', error);
      setActiveGroups([]);
    }
  }, [userId, selectedGroup]);

  const findLocationByPhone = React.useCallback(async () => {
    if (!phoneSearch.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      showError('Telefon numarası girin');
      return;
    }

    if (!selectedGroup) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      showError('Grup seçilmedi. Bu özelliği kullanmak için önce bir grup seçmelisiniz.');
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setLoading(true);
      const res = await authFetch(`/location/find-by-phone?phone=${encodeURIComponent(phoneSearch.trim())}&groupId=${selectedGroup.id}`);
      if (res.ok) {
        const data = await res.json();
        setPhoneResult(data.data);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showSuccess('Konum bulundu!');
      } else {
        const error = await res.json();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showError(error.error || 'Konum bulunamadı');
        setPhoneResult(null);
      }
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showError(error.message || 'Konum bulunamadı');
      setPhoneResult(null);
    } finally {
      setLoading(false);
    }
  }, [phoneSearch, selectedGroup, showError, showSuccess]);

  const createDelivery = React.useCallback(async () => {
    if (!deliveryName.trim() || !deliveryPhone.trim() || !deliveryAddress.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      showError('Tüm alanları doldurun');
      return;
    }

    if (!deliveryLat || !deliveryLng) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      showError('Adres geçerli değil. Lütfen adresi kontrol edin.');
      return;
    }

    if (!selectedGroup) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      showError('Grup seçilmedi. Teslimat oluşturmak için önce bir grup seçmelisiniz.');
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setLoading(true);
      const res = await authFetch('/location/delivery/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientName: deliveryName.trim(),
          recipientPhone: deliveryPhone.trim(),
          destinationAddress: deliveryAddress.trim(),
          destinationLat: deliveryLat ? parseFloat(deliveryLat) : undefined,
          destinationLng: deliveryLng ? parseFloat(deliveryLng) : undefined,
          groupId: selectedGroup.id
        })
      });

      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showSuccess('Teslimat oluşturuldu!');
        setNewDeliveryModal(false);
        setDeliveryName('');
        setDeliveryPhone('');
        setDeliveryAddress('');
        setDeliveryLat('');
        setDeliveryLng('');
        lastLoadTime.current['deliveries'] = 0;
        loadDeliveries();
      } else {
        const error = await res.json();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        if (res.status === 403 && error.planId) {
          showError(error.error || 'Plan limiti aşıldı');
          setTimeout(() => {
            router.push('/UpgradeScreen');
          }, 2000);
        } else {
          showError(error.error || 'Teslimat oluşturulamadı');
        }
      }
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showError(error.message || 'Teslimat oluşturulamadı');
    } finally {
      setLoading(false);
    }
  }, [deliveryName, deliveryPhone, deliveryAddress, deliveryLat, deliveryLng, selectedGroup, showError, showSuccess, loadDeliveries, router]);

  const geocodeDeliveryAddress = React.useCallback(async (address: string) => {
    if (!address.trim()) {
      setDeliveryLat('');
      setDeliveryLng('');
      return;
    }

    try {
      setGeocodingAddress(true);
      
      try {
        const res = await authFetch('/location/geocode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: address.trim() })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data?.coordinates) {
            setDeliveryLat(data.data.coordinates.lat.toString());
            setDeliveryLng(data.data.coordinates.lng.toString());
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            showSuccess('Adres bulundu!');
            return;
          }
        }
      } catch (backendError) {
        console.warn('Backend geocoding failed, trying local:', backendError);
      }

      const results = await Location.geocodeAsync(address);
      if (results && results.length > 0) {
        const { latitude, longitude } = results[0];
        setDeliveryLat(latitude.toString());
        setDeliveryLng(longitude.toString());
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showSuccess('Adres bulundu!');
      } else {
        setDeliveryLat('');
        setDeliveryLng('');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        showWarning('Adres bulunamadı. Lütfen daha detaylı bir adres girin.');
      }
    } catch (error: any) {
      console.error('Geocoding error:', error);
      setDeliveryLat('');
      setDeliveryLng('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showError('Adres işlenemedi: ' + (error.message || 'Bilinmeyen hata'));
    } finally {
      setGeocodingAddress(false);
    }
  }, [showError, showSuccess, showWarning]);

  const getCurrentLocationForDelivery = React.useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        showError('Konum izni verilmedi');
        return;
      }

      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setDeliveryLat(location.coords.latitude.toString());
      setDeliveryLng(location.coords.longitude.toString());
      
      try {
        const addresses = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        });
        if (addresses && addresses.length > 0) {
          const addr = addresses[0] as any;
          const fullAddress = [
            addr.street,
            addr.streetNumber,
            addr.district,
            addr.city,
            addr.country
          ].filter(Boolean).join(', ');
          setDeliveryAddress(fullAddress);
        }
      } catch (e) {
        console.warn('Reverse geocode error:', e);
      }
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showSuccess('Konum alındı!');
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showError('Konum alınamadı: ' + error.message);
    }
  }, [showError, showSuccess]);

  const updateDeliveryStatus = React.useCallback(async (deliveryId: string, status: 'pending' | 'in_progress' | 'delivered' | 'cancelled') => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setLoading(true);
      
      const res = await authFetch(`/location/delivery/${deliveryId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status,
          groupId: selectedGroup?.id || null
        })
      });

      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showSuccess('Teslimat durumu güncellendi!');
        lastLoadTime.current['deliveries'] = 0;
        loadDeliveries();
      } else {
        const error = await res.json();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showError(error.error || 'Durum güncellenemedi');
      }
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showError(error.message || 'Durum güncellenemedi');
    } finally {
      setLoading(false);
    }
  }, [selectedGroup, showError, showSuccess, loadDeliveries]);

  const loadRoutes = React.useCallback(async () => {
    if (!shouldLoad('routes')) return;
    if (!selectedGroup) {
      setRoutes([]);
      return;
    }
    try {
      setLoading(true);
      const res = await authFetch(`/location/routes?groupId=${selectedGroup.id}`);
      if (res.ok) {
        const data = await res.json();
        setRoutes(data.data?.routes || data.routes || []);
      } else {
        const errorData = await res.json().catch(() => ({}));
        if (res.status === 429) {
          showWarning('Çok fazla istek. Lütfen birkaç saniye bekleyin.');
        } else if (res.status !== 404) {
          console.error('Load routes error:', errorData);
        }
      }
    } catch (error: any) {
      if (error.message?.includes('rate limit') || error.message?.includes('429')) {
        showWarning('Çok fazla istek. Lütfen birkaç saniye bekleyin.');
      } else {
        console.error('Load routes error:', error);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedGroup, shouldLoad, showWarning]);


  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = await SecureStore.getItemAsync('auth_token');
        if (token) {
          const res = await authFetch('/users/me');
          if (res.ok) {
            const { user, subscription } = await res.json();
            if (user && user.id && mounted) {
              setUserId(user.id);
              if (subscription) {
                const planRes = await authFetch('/billing/plans');
                if (planRes.ok) {
                  const plans = await planRes.json();
                  const currentPlan = Array.isArray(plans) ? plans.find((p: any) => p.id === subscription.planId) : null;
                  if (currentPlan && mounted) {
                    setUserPlan({ planId: subscription.planId, limits: currentPlan.limits || {} });
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Get user ID error:', error);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    if (userId) {
      loadActiveGroups();
    }
  }, [userId, loadActiveGroups]);

  React.useEffect(() => {
    if (!fontsLoaded) return;
    if (!selectedGroup) return;
    
    const timer = setTimeout(() => {
      if (activeTab === 'family') {
        loadFamilyMembers();
      } else if (activeTab === 'courier') {
        loadDeliveries();
      } else if (activeTab === 'route') {
        loadRoutes();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [activeTab, fontsLoaded, selectedGroup, loadFamilyMembers, loadDeliveries, loadRoutes]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <LinearGradient 
        colors={['#06b6d4', '#0ea5a4']} 
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <View style={styles.headerTextBlock}>
              <Text style={styles.brandLabel}>BAVAXE PLATFORMU</Text>
              <Text style={styles.headerTitle}>Konum Özellikleri</Text>
              <Text style={styles.headerSubtitle}>Aile • Kurye • Numaradan Bulma • Yol Takip</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <NetworkStatusIcon size={20} />
          </View>
        </View>
      </LinearGradient>

      {/* Tabs - Modern Design */}
      <View style={styles.tabsContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScrollContent}
        >
          <Pressable 
            style={({ pressed }) => [
              styles.tab,
              activeTab === 'family' && styles.tabActive,
              pressed && styles.tabPressed
            ]}
            onPress={() => setActiveTab('family')}
          >
            {activeTab === 'family' ? (
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.tabGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="people" size={22} color="#fff" />
                <Text style={styles.tabTextActive}>Aile</Text>
              </LinearGradient>
            ) : (
              <View style={styles.tabInactive}>
                <Ionicons name="people-outline" size={22} color="#64748b" />
                <Text style={styles.tabText}>Aile</Text>
              </View>
            )}
          </Pressable>
          
          <Pressable 
            style={({ pressed }) => [
              styles.tab,
              activeTab === 'courier' && styles.tabActive,
              pressed && styles.tabPressed
            ]}
            onPress={() => setActiveTab('courier')}
          >
            {activeTab === 'courier' ? (
              <LinearGradient
                colors={['#f093fb', '#f5576c']}
                style={styles.tabGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="bicycle" size={22} color="#fff" />
                <Text style={styles.tabTextActive}>Kurye</Text>
              </LinearGradient>
            ) : (
              <View style={styles.tabInactive}>
                <Ionicons name="bicycle-outline" size={22} color="#64748b" />
                <Text style={styles.tabText}>Kurye</Text>
              </View>
            )}
          </Pressable>
          
          <Pressable 
            style={({ pressed }) => [
              styles.tab,
              activeTab === 'phone' && styles.tabActive,
              pressed && styles.tabPressed
            ]}
            onPress={() => setActiveTab('phone')}
          >
            {activeTab === 'phone' ? (
              <LinearGradient
                colors={['#4facfe', '#00f2fe']}
                style={styles.tabGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="call" size={22} color="#fff" />
                <Text style={styles.tabTextActive}>Numara</Text>
              </LinearGradient>
            ) : (
              <View style={styles.tabInactive}>
                <Ionicons name="call-outline" size={22} color="#64748b" />
                <Text style={styles.tabText}>Numara</Text>
              </View>
            )}
          </Pressable>
          
          <Pressable 
            style={({ pressed }) => [
              styles.tab,
              activeTab === 'route' && styles.tabActive,
              pressed && styles.tabPressed
            ]}
            onPress={() => setActiveTab('route')}
          >
            {activeTab === 'route' ? (
              <LinearGradient
                colors={['#43e97b', '#38f9d7']}
                style={styles.tabGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="map" size={22} color="#fff" />
                <Text style={styles.tabTextActive}>Yol</Text>
              </LinearGradient>
            ) : (
              <View style={styles.tabInactive}>
                <Ionicons name="map-outline" size={22} color="#64748b" />
                <Text style={styles.tabText}>Yol</Text>
              </View>
            )}
          </Pressable>
        </ScrollView>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Aile Konum Paylaşımı */}
        {activeTab === 'family' && (
          <View>
            {!selectedGroup && (
              <View style={styles.groupWarningCard}>
                <View style={styles.groupWarningHeader}>
                  <Ionicons name="warning" size={20} color="#92400e" />
                  <Text style={styles.groupWarningTitle}>Grup Seçilmedi</Text>
                </View>
                <Text style={styles.groupWarningText}>
                  Aile konum paylaşımı özelliğini kullanmak için önce bir grup seçmelisiniz. Grup olmadan aile üyeleri eklenemez ve konum paylaşılamaz.
                </Text>
                {activeGroups.length > 0 ? (
                  <Pressable 
                    style={({ pressed }) => [
                      styles.groupWarningButton,
                      pressed && styles.groupWarningButtonPressed
                    ]}
                    onPress={() => router.push('/(tabs)/groups')}
                  >
                    <LinearGradient
                      colors={['#f59e0b', '#d97706']}
                      style={styles.groupWarningButtonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Ionicons name="people" size={18} color="#fff" />
                      <Text style={styles.groupWarningButtonText}>Grup Seç</Text>
                    </LinearGradient>
                  </Pressable>
                ) : (
                  <View style={styles.groupWarningNoGroups}>
                    <Ionicons name="information-circle-outline" size={18} color="#64748b" />
                    <Text style={styles.groupWarningNoGroupsText}>
                      Henüz aktif grubunuz yok. Önce bir grup oluşturun veya bir gruba katılın.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {selectedGroup && (
              <View style={styles.selectedGroupCard}>
                <View style={styles.selectedGroupInfo}>
                  <LinearGradient
                    colors={['#10b981', '#059669']}
                    style={styles.selectedGroupIcon}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  </LinearGradient>
                  <View style={styles.selectedGroupText}>
                    <Text style={styles.selectedGroupLabel}>Aktif Grup</Text>
                    <Text style={styles.selectedGroupName}>{selectedGroup.name}</Text>
                  </View>
                </View>
              </View>
            )}

            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <LinearGradient
                  colors={['#667eea', '#764ba2']}
                  style={styles.sectionIconWrapper}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="people" size={20} color="#fff" />
                </LinearGradient>
                <Text style={styles.sectionTitle}>Aile Üyeleri</Text>
              </View>
              <Pressable 
                style={({ pressed }) => [
                  styles.addButton,
                  pressed && styles.addButtonPressed
                ]}
                onPress={() => setAddFamilyModal(true)}
              >
                <LinearGradient
                  colors={['#667eea', '#764ba2']}
                  style={styles.addButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="add" size={20} color="#fff" />
                </LinearGradient>
              </Pressable>
            </View>

            {loading && familyMembers.length === 0 ? (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#667eea" />
                <Text style={styles.loaderText}>Yükleniyor...</Text>
              </View>
            ) : familyMembers.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={64} color="#94a3b8" />
                <Text style={styles.emptyText}>Henüz aile üyesi eklenmemiş</Text>
                <Pressable 
                  style={({ pressed }) => [
                    styles.emptyButton,
                    pressed && styles.emptyButtonPressed
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setAddFamilyModal(true);
                  }}
                  android_ripple={{ color: 'rgba(102, 126, 234, 0.3)' }}
                >
                  <LinearGradient
                    colors={['#667eea', '#764ba2']}
                    style={styles.emptyButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons name="add-circle" size={20} color="#fff" />
                    <Text style={styles.emptyButtonText}>Aile Üyesi Ekle</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            ) : (
              familyMembers.map((member) => (
                <View key={member.userId} style={styles.memberCard}>
                  <View style={styles.memberCardGradient}>
                    <View style={styles.memberInfo}>
                      <LinearGradient
                        colors={['#667eea', '#764ba2']}
                        style={styles.memberAvatar}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <Ionicons name="person" size={24} color="#fff" />
                      </LinearGradient>
                      <View style={styles.memberDetails}>
                        <Text style={styles.memberName}>{member.name}</Text>
                        <View style={styles.memberMeta}>
                          <Ionicons name="call" size={14} color="#64748b" />
                          <Text style={styles.memberPhone}>{member.phone}</Text>
                        </View>
                        <View style={styles.memberMeta}>
                          <Ionicons name="people" size={14} color="#94a3b8" />
                          <Text style={styles.memberRelation}>{member.relation}</Text>
                        </View>
                      </View>
                    </View>
                    {member.location && (
                      <View style={styles.memberLocation}>
                        <View style={styles.locationHeader}>
                          <View style={styles.locationStatusContainer}>
                            <View style={[styles.statusDot, member.location.isActive && styles.statusDotActive]} />
                            <Text style={styles.locationStatusText}>
                              {member.location.isActive ? '🟢 Aktif' : '🔴 Pasif'}
                            </Text>
                          </View>
                          <Text style={styles.locationTime}>
                            {new Date(member.location.timestamp).toLocaleTimeString('tr-TR', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </Text>
                        </View>
                        <Pressable
                          style={({ pressed }) => [
                            styles.shareButton,
                            pressed && styles.shareButtonPressed
                          ]}
                          onPress={() => {
                            if (member.location) {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                              shareLocation(
                                { lat: member.location.lat, lng: member.location.lng, name: member.name },
                                () => {
                                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                  showSuccess('Konum paylaşıldı!');
                                },
                                (error) => {
                                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                                  showError(error);
                                }
                              );
                            }
                          }}
                          android_ripple={{ color: 'rgba(102, 126, 234, 0.3)' }}
                        >
                          <LinearGradient
                            colors={['#667eea', '#764ba2']}
                            style={styles.shareButtonGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                          >
                            <Ionicons name="share-social" size={18} color="#fff" />
                            <Text style={styles.shareButtonText}>Paylaş</Text>
                          </LinearGradient>
                        </Pressable>
                      </View>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Kurye Uygulaması */}
        {activeTab === 'courier' && (
          <View>
            {!selectedGroup && (
              <View style={styles.groupWarningCard}>
                <View style={styles.groupWarningHeader}>
                  <Ionicons name="warning" size={20} color="#92400e" />
                  <Text style={styles.groupWarningTitle}>Grup Seçilmedi</Text>
                </View>
                <Text style={styles.groupWarningText}>
                  Kurye teslimat özelliğini kullanmak için önce bir grup seçmelisiniz. Grup olmadan teslimat oluşturulamaz ve takip edilemez.
                </Text>
                {activeGroups.length > 0 ? (
                  <Pressable 
                    style={({ pressed }) => [
                      styles.groupWarningButton,
                      pressed && styles.groupWarningButtonPressed
                    ]}
                    onPress={() => router.push('/(tabs)/groups')}
                  >
                    <LinearGradient
                      colors={['#f59e0b', '#d97706']}
                      style={styles.groupWarningButtonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Ionicons name="people" size={18} color="#fff" />
                      <Text style={styles.groupWarningButtonText}>Grup Seç</Text>
                    </LinearGradient>
                  </Pressable>
                ) : (
                  <View style={styles.groupWarningNoGroups}>
                    <Ionicons name="information-circle-outline" size={18} color="#64748b" />
                    <Text style={styles.groupWarningNoGroupsText}>
                      Henüz aktif grubunuz yok. Önce bir grup oluşturun veya bir gruba katılın.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {selectedGroup && (
              <View style={styles.selectedGroupCard}>
                <View style={styles.selectedGroupInfo}>
                  <LinearGradient
                    colors={['#10b981', '#059669']}
                    style={styles.selectedGroupIcon}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  </LinearGradient>
                  <View style={styles.selectedGroupText}>
                    <Text style={styles.selectedGroupLabel}>Aktif Grup</Text>
                    <Text style={styles.selectedGroupName}>{selectedGroup.name}</Text>
                  </View>
                </View>
                <Pressable 
                  style={({ pressed }) => [
                    styles.groupTrackButton,
                    pressed && styles.groupTrackButtonPressed
                  ]}
                  onPress={() => router.push({ pathname: '/(tabs)/track', params: { groupId: selectedGroup.id } })}
                >
                  <LinearGradient
                    colors={['#06b6d4', '#0ea5a4']}
                    style={styles.groupTrackButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons name="location" size={16} color="#fff" />
                    <Text style={styles.groupTrackButtonText}>Canlı Takip</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            )}

            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <LinearGradient
                  colors={['#f093fb', '#f5576c']}
                  style={styles.sectionIconWrapper}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="bicycle" size={20} color="#fff" />
                </LinearGradient>
                <Text style={styles.sectionTitle}>Teslimatlar</Text>
              </View>
              <Pressable 
                style={({ pressed }) => [
                  styles.addButton,
                  pressed && styles.addButtonPressed
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setNewDeliveryModal(true);
                }}
                android_ripple={{ color: 'rgba(240, 147, 251, 0.3)' }}
              >
                <LinearGradient
                  colors={['#f093fb', '#f5576c']}
                  style={styles.addButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="add" size={20} color="#fff" />
                </LinearGradient>
              </Pressable>
            </View>

            {deliveries.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="bicycle-outline" size={64} color="#94a3b8" />
                <Text style={styles.emptyText}>Henüz teslimat yok</Text>
                <Pressable 
                  style={({ pressed }) => [
                    styles.emptyButton,
                    pressed && styles.emptyButtonPressed
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setNewDeliveryModal(true);
                  }}
                  android_ripple={{ color: 'rgba(240, 147, 251, 0.3)' }}
                >
                  <LinearGradient
                    colors={['#f093fb', '#f5576c']}
                    style={styles.emptyButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons name="bicycle" size={20} color="#fff" />
                    <Text style={styles.emptyButtonText}>Yeni Teslimat</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            ) : (
              deliveries.map((delivery) => (
                <View key={delivery.deliveryId} style={styles.deliveryCard}>
                  <View style={styles.deliveryCardGradient}>
                    <View style={styles.deliveryHeader}>
                      <View style={styles.deliveryHeaderLeft}>
                        <LinearGradient
                          colors={['#f093fb', '#f5576c']}
                          style={styles.deliveryIconWrapper}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        >
                          <Ionicons name="bicycle" size={22} color="#fff" />
                        </LinearGradient>
                        <View style={styles.deliveryInfo}>
                          <Text style={styles.deliveryName}>{delivery.recipientName}</Text>
                          <View style={styles.deliveryMeta}>
                            <Ionicons name="call" size={14} color="#64748b" />
                            <Text style={styles.deliveryPhone}>{delivery.recipientPhone}</Text>
                          </View>
                        </View>
                      </View>
                      <View style={[styles.statusBadge, styles[`status${delivery.status}`]]}>
                        <Text style={styles.statusText}>
                          {delivery.status === 'pending' ? '⏳ Bekliyor' :
                           delivery.status === 'in_progress' ? '🚚 Yolda' :
                           delivery.status === 'delivered' ? '✅ Teslim' :
                           '❌ İptal'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.deliveryLocation}>
                    <View style={styles.locationBox}>
                        <Ionicons name="location" size={18} color="#f093fb" />
                        <Text style={styles.deliveryAddress}>
                          {delivery.destination.lat.toFixed(6)}, {delivery.destination.lng.toFixed(6)}
                        </Text>
                      </View>
                    </View>
                    {delivery.currentLocation && (
                      <View style={styles.deliveryCurrentLocation}>
                        <Ionicons name="navigate" size={16} color="#10b981" />
                        <Text style={styles.deliveryCurrentText}>
                          Mevcut: {delivery.currentLocation.lat.toFixed(4)}, {delivery.currentLocation.lng.toFixed(4)}
                        </Text>
                      </View>
                    )}
                    <Pressable
                      style={({ pressed }) => [
                        styles.deliveryActionButton,
                        pressed && styles.deliveryActionButtonPressed,
                        (delivery.status === 'delivered' || delivery.status === 'cancelled') && styles.deliveryActionButtonDisabled
                      ]}
                      onPress={() => {
                        if (delivery.status === 'pending') {
                          updateDeliveryStatus(delivery.deliveryId, 'in_progress');
                        } else if (delivery.status === 'in_progress') {
                          updateDeliveryStatus(delivery.deliveryId, 'delivered');
                        }
                      }}
                      disabled={loading || delivery.status === 'delivered' || delivery.status === 'cancelled'}
                      android_ripple={{ color: 'rgba(240, 147, 251, 0.3)' }}
                    >
                      <LinearGradient
                        colors={['#f093fb', '#f5576c']}
                        style={styles.deliveryActionGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <Text style={styles.deliveryActionText}>
                          {delivery.status === 'pending' ? 'Başlat' :
                           delivery.status === 'in_progress' ? 'Tamamla' :
                           'Tamamlandı'}
                        </Text>
                      </LinearGradient>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Numaradan Konum Bulma */}
        {activeTab === 'phone' && (
          <View>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <LinearGradient
                  colors={['#4facfe', '#00f2fe']}
                  style={styles.sectionIconWrapper}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="call" size={20} color="#fff" />
                </LinearGradient>
                <Text style={styles.sectionTitle}>Numaradan Konum Bul</Text>
              </View>
            </View>

            {!selectedGroup && (
              <View style={styles.groupWarningCard}>
                <View style={styles.groupWarningHeader}>
                  <Ionicons name="warning" size={20} color="#92400e" />
                  <Text style={styles.groupWarningTitle}>Grup Seçilmedi</Text>
                </View>
                <Text style={styles.groupWarningText}>
                  Numaradan konum bulma özelliğini kullanmak için önce bir grup seçmelisiniz. Grup olmadan bu işlem yapılamaz.
                </Text>
                {activeGroups.length > 0 ? (
                  <Pressable 
                    style={({ pressed }) => [
                      styles.groupWarningButton,
                      pressed && styles.groupWarningButtonPressed
                    ]}
                    onPress={() => router.push('/(tabs)/groups')}
                  >
                    <LinearGradient
                      colors={['#f59e0b', '#d97706']}
                      style={styles.groupWarningButtonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Ionicons name="people" size={18} color="#fff" />
                      <Text style={styles.groupWarningButtonText}>Grup Seç</Text>
                    </LinearGradient>
                  </Pressable>
                ) : (
                  <View style={styles.groupWarningNoGroups}>
                    <Ionicons name="information-circle-outline" size={18} color="#64748b" />
                    <Text style={styles.groupWarningNoGroupsText}>
                      Henüz aktif grubunuz yok. Önce bir grup oluşturun veya bir gruba katılın.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {selectedGroup && (
              <View style={styles.selectedGroupCard}>
                <View style={styles.selectedGroupInfo}>
                  <LinearGradient
                    colors={['#10b981', '#059669']}
                    style={styles.selectedGroupIcon}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  </LinearGradient>
                  <View style={styles.selectedGroupText}>
                    <Text style={styles.selectedGroupLabel}>Aktif Grup</Text>
                    <Text style={styles.selectedGroupName}>{selectedGroup.name}</Text>
                  </View>
                </View>
                <Pressable 
                  style={({ pressed }) => [
                    styles.groupTrackButton,
                    pressed && styles.groupTrackButtonPressed
                  ]}
                  onPress={() => router.push({ pathname: '/(tabs)/track', params: { groupId: selectedGroup.id } })}
                >
                  <LinearGradient
                    colors={['#06b6d4', '#0ea5a4']}
                    style={styles.groupTrackButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons name="location" size={16} color="#fff" />
                    <Text style={styles.groupTrackButtonText}>Canlı Takip</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            )}

            <View style={styles.phoneSearchCard}>
              <View style={styles.phoneSearchCardGradient}>
                <View style={styles.phoneSearchHeader}>
                  <View style={styles.phoneSearchIconContainer}>
                    <LinearGradient
                      colors={['#4facfe', '#00f2fe']}
                      style={styles.phoneSearchIconWrapper}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Ionicons name="call" size={24} color="#fff" />
                    </LinearGradient>
                  </View>
                  <View style={styles.phoneSearchHeaderText}>
                    <Text style={styles.phoneSearchTitle}>Telefon Numarası Ara</Text>
                    <Text style={styles.phoneSearchSubtitle}>Numarayı girerek konum bilgisini bulun</Text>
                  </View>
                </View>

                <View style={styles.phoneSearchInputContainer}>
                  <View style={styles.phoneSearchInputWrapper}>
                    <View style={styles.phoneSearchInputIconContainer}>
                      <Ionicons name="call-outline" size={22} color="#4facfe" />
                    </View>
                    <TextInput
                      style={styles.phoneSearchInput}
                      placeholder="5XX XXX XX XX"
                      value={phoneSearch}
                      onChangeText={(text) => {
                        const cleaned = text.replace(/\D/g, '');
                        if (cleaned.length <= 10) {
                          setPhoneSearch(cleaned);
                        }
                      }}
                      keyboardType="phone-pad"
                      placeholderTextColor="#94a3b8"
                      maxLength={10}
                      autoFocus={false}
                    />
                    {phoneSearch.length > 0 && (
                      <Pressable
                        style={styles.phoneSearchClearButton}
                        onPress={() => {
                          setPhoneSearch('');
                          setPhoneResult(null);
                        }}
                      >
                        <Ionicons name="close-circle" size={20} color="#94a3b8" />
                      </Pressable>
                    )}
                  </View>
                  
                  <Pressable 
                    style={({ pressed }) => [
                      styles.phoneSearchButton,
                      (!phoneSearch.trim() || loading) && styles.phoneSearchButtonDisabled,
                      pressed && !loading && phoneSearch.trim() && styles.phoneSearchButtonPressed
                    ]}
                    onPress={findLocationByPhone}
                    disabled={!phoneSearch.trim() || loading}
                    android_ripple={{ color: 'rgba(79, 172, 254, 0.3)' }}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <LinearGradient
                        colors={phoneSearch.trim() ? ['#4facfe', '#00f2fe'] : ['#cbd5e1', '#94a3b8']}
                        style={styles.phoneSearchButtonGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <Ionicons name="search" size={22} color="#fff" />
                        <Text style={styles.phoneSearchButtonText}>Ara</Text>
                      </LinearGradient>
                    )}
                  </Pressable>
                </View>

                {phoneSearch.length > 0 && phoneSearch.length < 10 && (
                  <View style={styles.phoneSearchHint}>
                    <Ionicons name="information-circle-outline" size={16} color="#f59e0b" />
                    <Text style={styles.phoneSearchHintText}>
                      {10 - phoneSearch.length} rakam daha girin
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {phoneResult && (
              <View style={styles.phoneResultCard}>
                <View style={styles.phoneResultCardGradient}>
                  <View style={styles.phoneResultHeader}>
                    <LinearGradient
                      colors={['#4facfe', '#00f2fe']}
                      style={styles.phoneResultAvatar}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Ionicons name="person" size={32} color="#fff" />
                    </LinearGradient>
                    <View style={styles.phoneResultInfo}>
                      <Text style={styles.phoneResultName}>
                        {phoneResult.name || 'İsimsiz Kullanıcı'}
                      </Text>
                      <View style={styles.phoneResultPhoneRow}>
                        <Ionicons name="call" size={16} color="#64748b" />
                        <Text style={styles.phoneResultPhone}>{phoneResult.phone}</Text>
                      </View>
                    </View>
                    {phoneResult.location?.isActive && (
                      <View style={styles.phoneResultActiveBadge}>
                        <View style={styles.phoneResultActiveDot} />
                        <Text style={styles.phoneResultActiveText}>Aktif</Text>
                      </View>
                    )}
                  </View>

                  {phoneResult.location ? (
                    <View style={styles.phoneResultLocationSection}>
                      <View style={styles.phoneResultLocationHeader}>
                        <LinearGradient
                          colors={['#4facfe', '#00f2fe']}
                          style={styles.phoneResultLocationIconWrapper}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        >
                          <Ionicons name="location" size={20} color="#fff" />
                        </LinearGradient>
                        <View style={styles.phoneResultLocationInfo}>
                          <Text style={styles.phoneResultLocationLabel}>Son Konum</Text>
                          <Text style={styles.phoneResultLocationCoords}>
                            {phoneResult.location.lat.toFixed(6)}, {phoneResult.location.lng.toFixed(6)}
                          </Text>
                          <Text style={styles.phoneResultLocationTime}>
                            {new Date(phoneResult.location.timestamp).toLocaleString('tr-TR', {
                              day: '2-digit',
                              month: 'long',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.phoneResultActions}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.phoneResultActionButton,
                            pressed && styles.phoneResultActionButtonPressed
                          ]}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            shareLocation(
                              { 
                                lat: phoneResult.location.lat, 
                                lng: phoneResult.location.lng, 
                                name: phoneResult.name || phoneResult.phone
                              },
                              () => {
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                showSuccess('Konum paylaşıldı!');
                              },
                              (error) => {
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                                showError(error);
                              }
                            );
                          }}
                          android_ripple={{ color: 'rgba(79, 172, 254, 0.3)' }}
                        >
                          <LinearGradient
                            colors={['#4facfe', '#00f2fe']}
                            style={styles.phoneResultActionGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                          >
                            <Ionicons name="share-social" size={20} color="#fff" />
                            <Text style={styles.phoneResultActionText}>Konum Paylaş</Text>
                          </LinearGradient>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.phoneResultNoLocation}>
                      <Ionicons name="location-outline" size={48} color="#94a3b8" />
                      <Text style={styles.phoneResultNoLocationText}>
                        Bu numara için konum bilgisi bulunamadı
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {!phoneResult && phoneSearch.length === 0 && (
              <View style={styles.phoneSearchEmptyState}>
                <LinearGradient
                  colors={['#4facfe', '#00f2fe']}
                  style={styles.phoneSearchEmptyIconWrapper}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="call-outline" size={48} color="#fff" />
                </LinearGradient>
                <Text style={styles.phoneSearchEmptyTitle}>Numara Ara</Text>
                <Text style={styles.phoneSearchEmptyText}>
                  Telefon numarasını girerek kişinin konum bilgisini bulabilirsiniz
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Yol Takip */}
        {activeTab === 'route' && (
          <View>
            {!selectedGroup && (
              <View style={styles.groupWarningCard}>
                <View style={styles.groupWarningHeader}>
                  <Ionicons name="warning" size={20} color="#92400e" />
                  <Text style={styles.groupWarningTitle}>Grup Seçilmedi</Text>
                </View>
                <Text style={styles.groupWarningText}>
                  Yol takip özelliğini kullanmak için önce bir grup seçmelisiniz. Grup olmadan rota kaydedilemez ve takip edilemez.
                </Text>
                {activeGroups.length > 0 ? (
                  <Pressable 
                    style={({ pressed }) => [
                      styles.groupWarningButton,
                      pressed && styles.groupWarningButtonPressed
                    ]}
                    onPress={() => router.push('/(tabs)/groups')}
                  >
                    <LinearGradient
                      colors={['#f59e0b', '#d97706']}
                      style={styles.groupWarningButtonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Ionicons name="people" size={18} color="#fff" />
                      <Text style={styles.groupWarningButtonText}>Grup Seç</Text>
                    </LinearGradient>
                  </Pressable>
                ) : (
                  <View style={styles.groupWarningNoGroups}>
                    <Ionicons name="information-circle-outline" size={18} color="#64748b" />
                    <Text style={styles.groupWarningNoGroupsText}>
                      Henüz aktif grubunuz yok. Önce bir grup oluşturun veya bir gruba katılın.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {selectedGroup && (
              <View style={styles.selectedGroupCard}>
                <View style={styles.selectedGroupInfo}>
                  <LinearGradient
                    colors={['#10b981', '#059669']}
                    style={styles.selectedGroupIcon}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  </LinearGradient>
                  <View style={styles.selectedGroupText}>
                    <Text style={styles.selectedGroupLabel}>Aktif Grup</Text>
                    <Text style={styles.selectedGroupName}>{selectedGroup.name}</Text>
                  </View>
                </View>
                <Pressable 
                  style={({ pressed }) => [
                    styles.groupTrackButton,
                    pressed && styles.groupTrackButtonPressed
                  ]}
                  onPress={() => router.push({ pathname: '/(tabs)/track', params: { groupId: selectedGroup.id } })}
                >
                  <LinearGradient
                    colors={['#06b6d4', '#0ea5a4']}
                    style={styles.groupTrackButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons name="location" size={16} color="#fff" />
                    <Text style={styles.groupTrackButtonText}>Canlı Takip</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            )}

            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <LinearGradient
                  colors={['#43e97b', '#38f9d7']}
                  style={styles.sectionIconWrapper}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="map" size={20} color="#fff" />
                </LinearGradient>
                <Text style={styles.sectionTitle}>Rotalarım</Text>
              </View>
            </View>
            {routes.length === 0 ? (
              <View style={styles.emptyState}>
                <LinearGradient
                  colors={['#43e97b', '#38f9d7']}
                  style={styles.emptyIconWrapper}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="map" size={48} color="#fff" />
                </LinearGradient>
                <Text style={styles.emptyTitle}>Henüz Rota Yok</Text>
                <Text style={styles.emptyText}>Rotalarınızı kaydederek yol takibi yapabilirsiniz</Text>
              </View>
            ) : (
              routes.map((route) => (
                <View key={route.routeId} style={styles.routeCard}>
                  <View style={styles.routeCardGradient}>
                    <View style={styles.routeHeader}>
                      <LinearGradient
                        colors={['#43e97b', '#38f9d7']}
                        style={styles.routeIconWrapper}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <Ionicons name="map" size={22} color="#fff" />
                      </LinearGradient>
                      <View style={styles.routeInfo}>
                        <Text style={styles.routeName}>{route.name}</Text>
                        <View style={styles.routeMeta}>
                          <Ionicons name="location" size={14} color="#64748b" />
                          <Text style={styles.routeInfoText}>
                            {route.waypoints?.length || 0} nokta
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Aile Üyesi Ekle Modal */}
      <Modal visible={addFamilyModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.modalHeader}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="people" size={28} color="#fff" />
              <Text style={styles.modalTitle}>Aile Üyesi Ekle</Text>
            </LinearGradient>
            <View style={styles.modalBody}>
              <View style={styles.modalInputWrapper}>
                <Ionicons name="person" size={20} color="#667eea" style={styles.modalInputIcon} />
                <TextInput
                  style={styles.modalInput}
                  placeholder="İsim veya Kullanıcı ID"
                  value={familyIdentifier}
                  onChangeText={setFamilyIdentifier}
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.modalInputWrapper}>
                <Ionicons name="text" size={20} color="#667eea" style={styles.modalInputIcon} />
                <TextInput
                  style={styles.modalInput}
                  placeholder="Görünen İsim (opsiyonel)"
                  value={familyName}
                  onChangeText={setFamilyName}
                  placeholderTextColor="#94a3b8"
                />
              </View>
              <View style={styles.modalButtons}>
                <Pressable 
                  style={({ pressed }) => [
                    styles.modalButton,
                    styles.modalButtonCancel,
                    pressed && styles.modalButtonPressed
                  ]}
                  onPress={() => setAddFamilyModal(false)}
                >
                  <Text style={styles.modalButtonText}>İptal</Text>
                </Pressable>
                <Pressable 
                  style={({ pressed }) => [
                    styles.modalButton,
                    pressed && styles.modalButtonPressed
                  ]}
                  onPress={addFamilyMember}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <LinearGradient
                      colors={['#667eea', '#764ba2']}
                      style={styles.modalButtonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Text style={styles.modalButtonTextConfirm}>Ekle</Text>
                    </LinearGradient>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Yeni Teslimat Modal */}
      <Modal visible={newDeliveryModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <LinearGradient
              colors={['#f093fb', '#f5576c']}
              style={styles.modalHeader}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.modalHeaderIconWrapper}>
                <Ionicons name="bicycle" size={28} color="#fff" />
              </View>
              <Text style={styles.modalTitle}>Yeni Teslimat</Text>
            </LinearGradient>
            <View style={styles.modalBody}>
              <View style={styles.modalInputWrapper}>
                <Ionicons name="person" size={20} color="#f093fb" style={styles.modalInputIcon} />
                <TextInput
                  style={styles.modalInput}
                  placeholder="Alıcı Adı"
                  value={deliveryName}
                  onChangeText={setDeliveryName}
                  placeholderTextColor="#94a3b8"
                />
              </View>
              <View style={styles.modalInputWrapper}>
                <Ionicons name="call" size={20} color="#f093fb" style={styles.modalInputIcon} />
                <TextInput
                  style={styles.modalInput}
                  placeholder="Alıcı Telefon"
                  value={deliveryPhone}
                  onChangeText={setDeliveryPhone}
                  keyboardType="phone-pad"
                  placeholderTextColor="#94a3b8"
                />
              </View>
              <View style={styles.modalInputWrapper}>
                <Ionicons name="location" size={20} color="#f093fb" style={styles.modalInputIcon} />
                <TextInput
                  style={styles.modalInput}
                  placeholder="Teslimat Adresi (örn: İstanbul, Kadıköy, Bağdat Caddesi No:123)"
                  value={deliveryAddress}
                  onChangeText={setDeliveryAddress}
                  onBlur={() => {
                    if (deliveryAddress.trim().length > 10) {
                      geocodeDeliveryAddress(deliveryAddress);
                    }
                  }}
                  placeholderTextColor="#94a3b8"
                  multiline
                  numberOfLines={2}
                />
                {geocodingAddress && (
                  <ActivityIndicator size="small" color="#f093fb" style={{ marginLeft: 8 }} />
                )}
              </View>
              <Pressable 
                style={({ pressed }) => [
                  styles.locationButtonFull,
                  pressed && styles.locationButtonPressed
                ]}
                onPress={getCurrentLocationForDelivery}
                android_ripple={{ color: 'rgba(240, 147, 251, 0.3)' }}
              >
                <LinearGradient
                  colors={['#f093fb', '#f5576c']}
                  style={styles.locationButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="locate" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.locationButtonText}>Mevcut Konumu Kullan</Text>
                </LinearGradient>
              </Pressable>
              <View style={styles.modalButtons}>
                <Pressable 
                  style={({ pressed }) => [
                    styles.modalButton,
                    styles.modalButtonCancel,
                    pressed && styles.modalButtonPressed
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setNewDeliveryModal(false);
                  }}
                  android_ripple={{ color: 'rgba(148, 163, 184, 0.3)' }}
                >
                  <Text style={styles.modalButtonText}>İptal</Text>
                </Pressable>
                <Pressable 
                  style={({ pressed }) => [
                    styles.modalButton,
                    pressed && styles.modalButtonPressed,
                    loading && styles.modalButtonDisabled
                  ]}
                  onPress={createDelivery}
                  disabled={loading}
                  android_ripple={{ color: 'rgba(240, 147, 251, 0.3)' }}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <LinearGradient
                      colors={['#f093fb', '#f5576c']}
                      style={styles.modalButtonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Text style={styles.modalButtonTextConfirm}>Oluştur</Text>
                    </LinearGradient>
                  )}
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>


    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a'
  },
  header: {
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 20 : 20,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  headerTextBlock: {
    flex: 1
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 12
  },
  brandLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontFamily: 'Poppins-Bold',
    marginBottom: 4
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.8,
    fontFamily: 'Poppins-Bold',
    marginBottom: 4
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.95)',
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
    letterSpacing: 0.3
  },
  tabsContainer: {
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  tabsScrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8
  },
  tab: {
    marginRight: 8,
    borderRadius: 16,
    overflow: 'hidden'
  },
  tabActive: {
  },
  tabPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }]
  },
  tabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
    borderRadius: 16
  },
  tabInactive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: '#334155',
    borderRadius: 16
  },
  tabText: {
    fontSize: 14,
    color: '#cbd5e1',
    fontWeight: '500',
    fontFamily: 'Poppins-Medium'
  },
  tabTextActive: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.5,
    fontFamily: 'Poppins-Bold'
  },
  content: {
    flex: 1
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 8
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  sectionIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#f1f5f9',
    letterSpacing: 0.5,
    fontFamily: 'Poppins-Bold'
  },
  addButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6
  },
  addButtonPressed: {
    transform: [{ scale: 0.9 }],
    opacity: 0.9
  },
  addButtonGradient: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loaderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60
  },
  loaderText: {
    marginTop: 16,
    fontSize: 17,
    color: '#64748b',
    fontWeight: '500',
    fontFamily: 'Poppins-Medium'
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f2f5'
  },
  loadingText: {
    marginTop: 20,
    fontSize: 18,
    color: '#667eea',
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold'
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32
  },
  emptyIconWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#f093fb',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#f1f5f9',
    marginBottom: 10,
    letterSpacing: 0.5,
    fontFamily: 'Poppins-Bold'
  },
  emptyText: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: 'Poppins-Regular',
    paddingHorizontal: 20
  },
  emptyButton: {
    borderRadius: 16,
    overflow: 'hidden'
  },
  emptyButtonPressed: {
    transform: [{ scale: 0.95 }]
  },
  emptyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    gap: 8,
    borderRadius: 16
  },
  emptyButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.8,
    fontFamily: 'Poppins-Bold'
  },
  memberCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155'
  },
  memberCardGradient: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1e293b'
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16
  },
  memberAvatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  memberDetails: {
    marginLeft: 16,
    flex: 1
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12
  },
  memberName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f1f5f9',
    letterSpacing: 0.3,
    fontFamily: 'Poppins-Bold',
    flex: 1
  },
  newBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8
  },
  newBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'Poppins-Bold',
    letterSpacing: 0.5
  },
  memberMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
    paddingVertical: 4
  },
  metaIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#f8f9ff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e8eaf6'
  },
  memberPhone: {
    fontSize: 15,
    color: '#64748b',
    fontWeight: '500',
    fontFamily: 'Poppins-Medium'
  },
  memberRelation: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500',
    fontFamily: 'Poppins-Medium'
  },
  memberLocation: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e8eaf6'
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  locationStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  locationStatusText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f1f5f9',
    fontFamily: 'Poppins-SemiBold'
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    marginRight: 8
  },
  statusDotActive: {
    backgroundColor: '#10b981'
  },
  locationTime: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
    fontFamily: 'Poppins-Medium'
  },
  shareButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6
  },
  shareButtonPressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.9
  },
  shareButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 8,
    borderRadius: 12
  },
  shareButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.5,
    fontFamily: 'Poppins-Bold'
  },
  deliveryCard: {
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155'
  },
  deliveryCardGradient: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1e293b'
  },
  deliveryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16
  },
  deliveryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: 14
  },
  deliveryIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f093fb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6
  },
  deliveryInfo: {
    flex: 1
  },
  deliveryNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10
  },
  deliveryName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f1f5f9',
    letterSpacing: 0.3,
    fontFamily: 'Poppins-Bold',
    flex: 1
  },
  urgentBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center'
  },
  deliveryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12
  },
  statuspending: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a'
  },
  statusin_progress: {
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: '#93c5fd'
  },
  statusdelivered: {
    backgroundColor: '#d1fae5',
    borderWidth: 1,
    borderColor: '#6ee7b7'
  },
  statuscancelled: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5'
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: 0.5,
    fontFamily: 'Poppins-Bold'
  },
  deliveryPhone: {
    fontSize: 15,
    color: '#64748b',
    fontWeight: '500',
    fontFamily: 'Poppins-Medium'
  },
  deliveryLocation: {
    marginBottom: 12
  },
  locationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a'
  },
  deliveryAddress: {
    fontSize: 13,
    color: '#475569',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    flex: 1,
    fontWeight: '600',
    letterSpacing: 0.3
  },
  deliveryCurrentLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#f0fdf4',
    borderRadius: 6
  },
  deliveryCurrentText: {
    fontSize: 11,
    color: '#059669',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  deliveryActionButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#f093fb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6
  },
  deliveryActionButtonPressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.9
  },
  deliveryActionButtonDisabled: {
    opacity: 0.5
  },
  deliveryActionGradient: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center'
  },
  deliveryActionText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.8,
    fontFamily: 'Poppins-Bold'
  },
  phoneSearchCard: {
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155'
  },
  phoneSearchCardGradient: {
    padding: 24,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155'
  },
  phoneSearchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 16
  },
  phoneSearchIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    overflow: 'hidden'
  },
  phoneSearchIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  phoneSearchHeaderText: {
    flex: 1
  },
  phoneSearchTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f1f5f9',
    letterSpacing: 0.3,
    fontFamily: 'Poppins-Bold',
    marginBottom: 4
  },
  phoneSearchSubtitle: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
    fontFamily: 'Poppins-Medium'
  },
  phoneSearchInputContainer: {
    gap: 12
  },
  phoneSearchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#334155',
    paddingHorizontal: 16,
    paddingVertical: 4
  },
  phoneSearchInputIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f0f9ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  phoneSearchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 18,
    color: '#f1f5f9',
    fontWeight: '700',
    fontFamily: 'Poppins-Bold',
    letterSpacing: 1
  },
  phoneSearchClearButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8
  },
  phoneSearchButton: {
    borderRadius: 16,
    overflow: 'hidden',
    height: 56,
    shadowColor: '#4facfe',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6
  },
  phoneSearchButtonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9
  },
  phoneSearchButtonDisabled: {
    opacity: 0.5
  },
  phoneSearchButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 16,
    gap: 8
  },
  phoneSearchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Poppins-Bold',
    letterSpacing: 0.5
  },
  phoneSearchHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fde68a'
  },
  phoneSearchHintText: {
    fontSize: 13,
    color: '#92400e',
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold'
  },
  phoneSearchEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32
  },
  phoneSearchEmptyIconWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24
  },
  phoneSearchEmptyTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
    letterSpacing: 0.5,
    fontFamily: 'Poppins-Bold'
  },
  phoneSearchEmptyText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: 'Poppins-Regular',
    paddingHorizontal: 20
  },
  phoneResultCard: {
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155'
  },
  phoneResultCardGradient: {
    padding: 24,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155'
  },
  phoneResultHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    gap: 16
  },
  phoneResultAvatar: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center'
  },
  phoneResultInfo: {
    flex: 1
  },
  phoneResultName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#f1f5f9',
    letterSpacing: 0.3,
    fontFamily: 'Poppins-Bold',
    marginBottom: 8
  },
  phoneResultPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  phoneResultPhone: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold'
  },
  phoneResultActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12
  },
  phoneResultActiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff'
  },
  phoneResultActiveText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Poppins-Bold',
    letterSpacing: 0.5
  },
  phoneResultLocationSection: {
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e8eaf6'
  },
  phoneResultLocationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    gap: 16
  },
  phoneResultLocationIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  phoneResultLocationInfo: {
    flex: 1
  },
  phoneResultLocationLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: 'Poppins-Bold',
    marginBottom: 8
  },
  phoneResultLocationCoords: {
    fontSize: 16,
    color: '#f1f5f9',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8
  },
  phoneResultLocationTime: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
    fontFamily: 'Poppins-Medium'
  },
  phoneResultActions: {
    marginTop: 8
  },
  phoneResultActionButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#4facfe',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6
  },
  phoneResultActionButtonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9
  },
  phoneResultActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 8,
    borderRadius: 16
  },
  phoneResultActionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Poppins-Bold',
    letterSpacing: 0.5
  },
  phoneResultNoLocation: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20
  },
  phoneResultNoLocationText: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 16,
    fontFamily: 'Poppins-Medium',
    lineHeight: 22
  },
  resultCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  resultCardGradient: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#dbeafe'
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20
  },
  resultAvatar: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center'
  },
  resultInfo: {
    marginLeft: 16,
    flex: 1
  },
  resultNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12
  },
  resultName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.3,
    fontFamily: 'Poppins-Bold',
    flex: 1
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10b981',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12
  },
  activePulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff'
  },
  activeBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'Poppins-Bold',
    letterSpacing: 0.5
  },
  resultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4
  },
  resultPhone: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
    fontFamily: 'Poppins-Medium'
  },
  resultLocation: {
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e8eaf6'
  },
  resultLocationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  resultLocationText: {
    fontSize: 14,
    color: '#475569',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '600',
    flex: 1
  },
  resultTime: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
    fontFamily: 'Poppins-Medium'
  },
  shareButtonLarge: {
    borderRadius: 14,
    marginTop: 16,
    overflow: 'hidden'
  },
  shareButtonLargeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 8,
    borderRadius: 14
  },
  shareButtonTextLarge: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.8,
    fontFamily: 'Poppins-Bold'
  },
  routeCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155'
  },
  routeCardGradient: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1e293b'
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14
  },
  routeIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  routeInfo: {
    flex: 1
  },
  routeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10
  },
  routeName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f1f5f9',
    letterSpacing: 0.3,
    fontFamily: 'Poppins-Bold',
    flex: 1
  },
  favoriteBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fde68a'
  },
  routeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4
  },
  routeInfoText: {
    fontSize: 15,
    color: '#64748b',
    fontWeight: '500',
    fontFamily: 'Poppins-Medium'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%'
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 28,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28
  },
  modalHeaderIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)'
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.8,
    fontFamily: 'Poppins-Bold',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6
  },
  modalBody: {
    padding: 24
  },
  modalInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#334155',
    paddingHorizontal: 16,
    marginBottom: 16
  },
  modalInputIcon: {
    marginRight: 12
  },
  modalInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#f1f5f9',
    fontWeight: '500',
    fontFamily: 'Poppins-Medium'
  },
  locationInputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16
  },
  locationInput: {
    flex: 1,
    marginBottom: 0
  },
  locationButton: {
    borderRadius: 16,
    overflow: 'hidden'
  },
  locationButtonFull: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16
  },
  locationButtonPressed: {
    transform: [{ scale: 0.95 }]
  },
  locationButtonGradient: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: 16
  },
  locationButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Poppins-Bold'
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8
  },
  modalButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden'
  },
  modalButtonPressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.9
  },
  modalButtonDisabled: {
    opacity: 0.6
  },
  modalButtonCancel: {
    backgroundColor: '#334155',
    borderWidth: 2,
    borderColor: '#475569'
  },
  modalButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#cbd5e1',
    paddingVertical: 16,
    paddingHorizontal: 20,
    textAlign: 'center',
    fontFamily: 'Poppins-Bold'
  },
  modalButtonTextConfirm: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    textAlign: 'center',
    fontFamily: 'Poppins-Bold'
  },
  groupWarningCard: {
    backgroundColor: '#fef3c7',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#fbbf24'
  },
  groupWarningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10
  },
  groupWarningTitle: {
    color: '#92400e',
    fontWeight: '800',
    fontSize: 18,
    fontFamily: 'Poppins-Bold',
    letterSpacing: 0.3
  },
  groupWarningText: {
    color: '#92400e',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
    fontFamily: 'Poppins-Medium'
  },
  groupWarningButton: {
    borderRadius: 12,
    overflow: 'hidden'
  },
  groupWarningButtonPressed: {
    transform: [{ scale: 0.95 }]
  },
  groupWarningButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 8,
    borderRadius: 12
  },
  groupWarningButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    fontFamily: 'Poppins-Bold',
    letterSpacing: 0.5
  },
  groupWarningNoGroups: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  groupWarningNoGroupsText: {
    flex: 1,
    color: '#64748b',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Poppins-Medium'
  },
  selectedGroupCard: {
    backgroundColor: '#d1fae5',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#6ee7b7'
  },
  selectedGroupInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  selectedGroupIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  selectedGroupText: {
    flex: 1
  },
  selectedGroupLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: 'Poppins-Bold',
    marginBottom: 4
  },
  selectedGroupName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#065f46',
    fontFamily: 'Poppins-Bold',
    letterSpacing: 0.3
  },
  groupTrackButton: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6
  },
  groupTrackButtonPressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.9
  },
  groupTrackButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
    borderRadius: 12
  },
  groupTrackButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    fontFamily: 'Poppins-Bold',
    letterSpacing: 0.3
  }
});

