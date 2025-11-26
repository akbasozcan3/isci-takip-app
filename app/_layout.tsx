import { Slot, SplashScreen, usePathname, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { MessageProvider } from '../components/MessageProvider';
import SubscriptionModal, { useSubscriptionModal } from '../components/SubscriptionModal';

// Splash screen'i manuel kontrol için
SplashScreen.preventAutoHideAsync();

export default function RootLayout(): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = React.useState(false);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  
  // Abonelik modal hook'u
  const subscriptionModal = useSubscriptionModal();

  React.useEffect(() => {
    console.log('[RootLayout] Component mounted, pathname:', pathname);
    let isMounted = true;
    
    (async () => {
      try {
        // Auth kontrolü
        const token = await SecureStore.getItemAsync('auth_token');
        const isAuthPage = pathname.startsWith('/auth');
        const isResetPasswordPage = pathname.startsWith('/auth/reset-password');
        const isAllowedAuthPage = isResetPasswordPage;
        
        if (isMounted) {
          if (!token && !isAuthPage) {
            console.log('[RootLayout] No token found, redirecting to login');
            router.replace('/auth/login');
            setIsAuthenticated(false);
          } else if (token && isAuthPage && !isAllowedAuthPage) {
            console.log('[RootLayout] Token found, redirecting to home');
            router.replace('/(tabs)');
            setIsAuthenticated(true);
          } else if (token) {
            setIsAuthenticated(true);
          }
        }
      } catch (error) {
        console.error('[RootLayout] Root layout init error:', error);
      } finally {
        if (isMounted) {
          console.log('[RootLayout] Setting ready to true');
          setReady(true);
          setTimeout(() => {
            console.log('[RootLayout] Hiding splash screen');
            SplashScreen.hideAsync();
          }, 100);
        }
      }
    })();
    
    return () => {
      console.log('[RootLayout] Component unmounting');
      isMounted = false;
    };
  }, [pathname, router]);

  // Kullanıcı giriş yaptıktan sonra abonelik modal'ını kontrol et
  React.useEffect(() => {
    if (ready && isAuthenticated && !pathname.startsWith('/auth')) {
      // Kısa bir gecikme ile modal'ı göster (UX için)
      const timer = setTimeout(() => {
        subscriptionModal.checkAndShow();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [ready, isAuthenticated, pathname]);

  if (!ready) {
    console.log('[RootLayout] Rendering loading screen');
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#06b6d4" />
      </View>
    );
  }
  
  console.log('[RootLayout] Rendering main content with Slot');
  return (
    <ErrorBoundary>
      <MessageProvider>
        <Slot />
        {/* Abonelik Modal - Uygulama açılışında 1 kez gösterilir */}
        <SubscriptionModal
          visible={subscriptionModal.visible}
          onClose={subscriptionModal.hide}
          onSubscriptionChange={subscriptionModal.setSubscription}
        />
      </MessageProvider>
    </ErrorBoundary>
  );
}


