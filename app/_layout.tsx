import * as Linking from 'expo-linking';
import { Slot, SplashScreen, usePathname, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { MessageProvider } from '../components/MessageProvider';
import SubscriptionModal, { useSubscriptionModal } from '../components/SubscriptionModal';
import '../utils/errorHandler';
import { initializeOneSignal } from '../utils/onesignal';

export default function RootLayout(): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const subscriptionModal = useSubscriptionModal();

  React.useEffect(() => {
    SplashScreen.hideAsync();
    initializeOneSignal();
    
    const handleInitialURL = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        handleDeepLink(initialUrl);
      }
    };
    
    handleInitialURL();
    
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
  }, [isAuthenticated, pathname, subscriptionModal]);
  
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


