import * as Linking from 'expo-linking';
import { Slot, SplashScreen, usePathname, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { MessageProvider } from '../components/MessageProvider';
import SubscriptionModal, { useSubscriptionModal } from '../components/SubscriptionModal';
import '../utils/errorHandler';
import { initializeOneSignal } from '../utils/onesignal';

SplashScreen.preventAutoHideAsync();

export default function RootLayout(): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = React.useState(false);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const subscriptionModal = useSubscriptionModal();

  React.useEffect(() => {
    initializeOneSignal();
    
    // Handle deep links when app is opened from notification
    const handleInitialURL = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        handleDeepLink(initialUrl);
      }
    };
    
    handleInitialURL();
    
    // Listen for deep links while app is running
    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });
    
    return () => {
      subscription.remove();
    };
  }, []);
  
  const handleDeepLink = (url: string) => {
    try {
      console.log('[DeepLink] Handling URL:', url);
      
      if (url.startsWith('bavaxe://') || url.includes('bavaxe')) {
        const parsed = Linking.parse(url);
        const path = parsed.path || '';
        const params = parsed.queryParams || {};
        
        // Wait for app to be ready before navigating
        if (!ready) {
          setTimeout(() => handleDeepLink(url), 500);
          return;
        }
        
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
          router.push('/(tabs)/settings');
        } else if (path.includes('blog') || path.includes('article')) {
          const articleId = params.id || params.articleId;
          if (articleId) {
            router.push(`/blog/${articleId}`);
          } else {
            router.push('/blog');
          }
        } else if (path.includes('payment') || path.includes('subscription')) {
          router.push('/(tabs)/settings');
        } else {
          router.push('/(tabs)');
        }
      }
    } catch (error) {
      console.error('[DeepLink] Error handling deep link:', error);
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
              setOneSignalExternalUserId(workerId);
              markUserActive();
            }
          } else if (token) {
            setIsAuthenticated(true);
            const workerId = await SecureStore.getItemAsync('workerId');
            if (workerId) {
              const { setOneSignalExternalUserId } = await import('../utils/onesignal');
              const { markUserActive } = await import('../utils/onesignalSegments');
              setOneSignalExternalUserId(workerId);
              markUserActive();
            }
          }
        }
      } catch (error) {
        console.error('[RootLayout] Root layout init error:', error);
      } finally {
        if (isMounted) {
          setReady(true);
          setTimeout(() => {
            SplashScreen.hideAsync();
          }, 100);
        }
      }
    })();
    
    return () => {
      isMounted = false;
    };
  }, [pathname, router]);

  React.useEffect(() => {
    if (ready && isAuthenticated && !pathname.startsWith('/auth')) {
      const timer = setTimeout(() => {
        subscriptionModal.checkAndShow();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [ready, isAuthenticated, pathname, subscriptionModal]);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ alignItems: 'center', gap: 20 }}>
          <View style={{ width: 80, height: 80, borderRadius: 20, backgroundColor: '#06b6d4', alignItems: 'center', justifyContent: 'center', shadowColor: '#06b6d4', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 12 }}>
            <Text style={{ fontSize: 32, fontWeight: '900', color: '#fff' }}>B</Text>
          </View>
          <ActivityIndicator size="large" color="#06b6d4" />
          <Text style={{ color: '#94a3b8', fontSize: 14, fontWeight: '600', marginTop: 8 }}>Yükleniyor...</Text>
        </View>
      </View>
    );
  }
  
  return (
    <ErrorBoundary>
      <MessageProvider>
        <Slot />
        <SubscriptionModal
          visible={subscriptionModal.visible}
          onClose={subscriptionModal.hide}
          onSubscriptionChange={subscriptionModal.setSubscription}
        />
      </MessageProvider>
    </ErrorBoundary>
  );
}


