import { useFonts } from 'expo-font';
import * as Linking from 'expo-linking';
import { Slot, SplashScreen, usePathname, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import { LogBox, View } from 'react-native';
import AppFlow from '../components/AppFlow';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { MessageProvider } from '../components/MessageProvider';
import { NetworkGuard } from '../components/NetworkGuard';
import { ProfileProvider } from '../contexts/ProfileContext';
import SubscriptionModal, { useSubscriptionModal } from '../components/SubscriptionModal';
import { ThemeProvider } from '../components/ui/theme/ThemeProvider';
import '../utils/errorHandler';
import { initializeOneSignal } from '../utils/onesignal';
import { registerBackgroundStepTask } from '../services/backgroundStepTracker';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

LogBox.ignoreAllLogs(true);
LogBox.ignoreLogs([
  'ExpoFontLoader',
  'ionicons',
  'keep awake',
  'KeepAwake',
  'VideoBanner',
  'HttpDataSource',
  'Response code:',
  'InvalidResponseCodeException',
  'Warning:',
  'Error:',
]);

export default function RootLayout(): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const subscriptionModal = useSubscriptionModal();


  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('./assets/Poppins-Regular.ttf'),
    'Poppins-Medium': require('./assets/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('./assets/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('./assets/Poppins-Bold.ttf'),
    'Poppins-Black': require('./assets/Poppins-Black.ttf'),
    'Poppins-Light': require('./assets/Poppins-Light.ttf'),
    'Poppins-ExtraLight': require('./assets/Poppins-ExtraLight.ttf'),
    'Poppins-Thin': require('./assets/Poppins-Thin.ttf'),
    'Poppins-Italic': require('./assets/Poppins-Italic.ttf'),
  });

  React.useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  React.useEffect(() => {
    const init = async () => {


      try {
        // Check API connection and fallback if needed
        const { checkApiConnection } = await import('../utils/api');
        await checkApiConnection();

        await initializeOneSignal();
        await registerBackgroundStepTask();

        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          handleDeepLink(initialUrl);
        }
      } catch (error: any) {
      }
    };

    init();

    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  React.useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);



  const handleDeepLink = (url: string) => {
    try {

      if (url.startsWith('bavaxe://') || url.includes('bavaxe')) {
        const parsed = Linking.parse(url);
        const path = parsed.path || '';
        const params = parsed.queryParams || {};

        // Route based on path
        if (path.includes('track') || path.includes('location')) {
          router.push('/(tabs)/track');
        } else if (path.includes('groups') || path.includes('group')) {
          const groupId = params.groupId || params.id;
          if (groupId) {
            router.push(`/(tabs)/groups?groupId=${groupId}`);
          } else {
            router.push('/(tabs)/groups');
          }
        } else if (path.includes('notifications')) {
          router.push('/notifications');
        } else if (path.includes('profile') || path.includes('settings')) {
          router.push('/(tabs)/profile');
        } else if (path.includes('blog') || path.includes('article')) {
          const articleId = params.id || params.articleId;
          if (articleId) {
            router.push(`/blog/${articleId}`);
          } else {
            router.push('/blog');
          }
        } else if (path.includes('payment') || path.includes('subscription')) {
          router.push('/(tabs)/profile');
        } else {
          router.push('/(tabs)');
        }
      }
    } catch (error) {
    }
  };

  React.useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const token = await SecureStore.getItemAsync('auth_token');
        const isAuthPage = pathname.startsWith('/auth');
        const isResetPasswordPage = pathname.startsWith('/auth/reset-password');
        const isAllowedAuthPage = isResetPasswordPage;

        if (isMounted) {
          if (!token && !isAuthPage) {
            router.replace('/auth/login');
            setIsAuthenticated(false);
          } else if (token && isAuthPage && !isAllowedAuthPage) {
            router.replace('/(tabs)');
            setIsAuthenticated(true);
            const workerId = await SecureStore.getItemAsync('workerId');
            if (workerId) {
              const { setOneSignalExternalUserId } = await import('../utils/onesignal');
              const { markUserActive } = await import('../utils/onesignalSegments');
              await setOneSignalExternalUserId(workerId);
              markUserActive();

              // Sync OneSignal Player ID with backend (throttled in helper)
              // Only sync once per session to prevent rate limiting
              setTimeout(async () => {
                try {
                  const { getPlayerId, sendPlayerIdToBackend } = await import('../utils/onesignalHelpers');
                  const playerId = await getPlayerId();
                  if (playerId) {
                    await sendPlayerIdToBackend(playerId, workerId);
                  }
                } catch (onesignalError) {
                }
              }, 2000);
            }
          } else if (token) {
            setIsAuthenticated(true);
            const workerId = await SecureStore.getItemAsync('workerId');
            if (workerId) {
              const { setOneSignalExternalUserId } = await import('../utils/onesignal');
              const { markUserActive } = await import('../utils/onesignalSegments');
              await setOneSignalExternalUserId(workerId);
              markUserActive();

              // Sync OneSignal Player ID with backend (throttled in helper)
              // Only sync once per session to prevent rate limiting
              setTimeout(async () => {
                try {
                  const { getPlayerId, sendPlayerIdToBackend } = await import('../utils/onesignalHelpers');
                  const playerId = await getPlayerId();
                  if (playerId) {
                    await sendPlayerIdToBackend(playerId, workerId);
                  }
                } catch (onesignalError) {
                }
              }, 2000);
            }
          }
        }
      } catch (error) {
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [pathname, router]);

  React.useEffect(() => {
    if (isAuthenticated && !pathname.startsWith('/auth')) {
      const timer = setTimeout(() => {
        subscriptionModal.checkAndShow();
      }, 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isAuthenticated, pathname, subscriptionModal]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ProfileProvider>
      <ErrorBoundary>
        <ThemeProvider>
          <NetworkGuard>
            <AppFlow>
              <MessageProvider>
                <Slot />
                <SubscriptionModal
                  visible={subscriptionModal.visible}
                  onClose={subscriptionModal.hide}
                  onSubscriptionChange={subscriptionModal.setSubscription}
                />
              </MessageProvider>
            </AppFlow>
          </NetworkGuard>
        </ThemeProvider>
      </ErrorBoundary>
    </ProfileProvider>
  );
}
