import { Slot, SplashScreen, usePathname, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { MessageProvider } from '../components/MessageProvider';
// Auth check - redirect to login if not authenticated

// Splash screen'i manuel kontrol için
SplashScreen.preventAutoHideAsync();

export default function RootLayout(): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    console.log('[RootLayout] Component mounted, pathname:', pathname);
    let isMounted = true;
    
    (async () => {
      try {
        // Onboarding yönlendirmesi devre dışı (guide açılmasın)

        // Auth kontrolü
        const token = await SecureStore.getItemAsync('auth_token');
        const isAuthPage = pathname.startsWith('/auth');
        // Reset-password sayfasına giriş yapmış kullanıcılar da erişebilmeli
        const isResetPasswordPage = pathname.startsWith('/auth/reset-password');
        const isAllowedAuthPage = isResetPasswordPage;
        
        if (isMounted) {
          if (!token && !isAuthPage) {
            console.log('[RootLayout] No token found, redirecting to login');
            router.replace('/auth/login');
          } else if (token && isAuthPage && !isAllowedAuthPage) {
            // Giriş yapmış kullanıcılar sadece reset-password sayfasına erişebilir
            // Diğer auth sayfalarına (login, register) erişemezler
            console.log('[RootLayout] Token found, redirecting to home');
            router.replace('/(tabs)');
          }
        }
      } catch (error) {
        console.error('[RootLayout] Root layout init error:', error);
      } finally {
        if (isMounted) {
          console.log('[RootLayout] Setting ready to true');
          setReady(true);
          // Splash screen'i gizle
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
      </MessageProvider>
    </ErrorBoundary>
  );
}


