import AsyncStorage from '@react-native-async-storage/async-storage';
import { Slot, SplashScreen, usePathname, useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { MessageProvider } from '../components/MessageProvider';
import { getToken } from '../utils/auth';

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
        console.log('[RootLayout] Checking onboarding status...');
        const onboardingSeen = await AsyncStorage.getItem('onboardingSeen');
        console.log('[RootLayout] Onboarding seen:', onboardingSeen);
        
        if (isMounted) {
          // İlk açılış - rehbere yönlendir
          if (!onboardingSeen && pathname !== '/guide') {
            console.log('[RootLayout] First time user, redirecting to /guide');
            router.replace('/guide');
          } else {
            console.log('[RootLayout] User has seen onboarding or already on guide page');
          }
        }

        // Auth kontrolü
        const token = await getToken();
        const onAuthRoute = pathname?.startsWith('/auth');
        if (!token && !onAuthRoute && pathname !== '/guide') {
          console.log('[RootLayout] No token, redirecting to /auth/login');
          router.replace('/auth/login' as any);
        }
        if (token && onAuthRoute) {
          console.log('[RootLayout] Has token on auth route, redirecting to root');
          router.replace('/' as any);
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


