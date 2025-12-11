/**
 * Network Guard Component
 * Blocks app access when internet is not available
 */

import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNetwork } from '../hooks/useNetwork';
import NoInternetScreen from './NoInternetScreen';

interface NetworkGuardProps {
  children: React.ReactNode;
}

export function NetworkGuard({ children }: NetworkGuardProps) {
  // Use professional network hook for real-time monitoring
  const network = useNetwork();
  const [isRetrying, setIsRetrying] = React.useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await network.refresh();
    } catch (error) {
      console.error('[NetworkGuard] Retry error:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  // Show loading only on initial check
  if (network.isChecking && !network.hasConnection) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.gradient}>
          <View style={styles.content}>
            <ActivityIndicator size="large" color="#06b6d4" />
            <Text style={styles.checkingText}>Bağlantı kontrol ediliyor...</Text>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // Show offline screen if no internet connection
  if (!network.hasConnection) {
    return (
      <NoInternetScreen
        onRetry={handleRetry}
        isRetrying={isRetrying}
        message="İnternet bağlantınızı kontrol edin ve tekrar deneyin."
      />
    );
  }

  // Show backend error screen if internet exists but backend is unreachable
  if (network.hasConnection && !network.isBackendReachable) {
    return (
      <NoInternetScreen
        onRetry={handleRetry}
        isRetrying={isRetrying}
        showBackendError={true}
        message="Sunucuya bağlanılamıyor. Lütfen internet bağlantınızı kontrol edin ve tekrar deneyin."
      />
    );
  }

  // Allow app to continue - backend status shown in header
  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 400,
    width: '100%',
  },
  iconContainer: {
    marginBottom: 24,
    padding: 20,
    borderRadius: 50,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
    fontFamily: 'Poppins-Bold',
  },
  description: {
    fontSize: 16,
    color: '#cbd5e1',
    marginBottom: 8,
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: 'Poppins-Regular',
  },
  subDescription: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'Poppins-Regular',
  },
  checkingText: {
    fontSize: 16,
    color: '#cbd5e1',
    marginTop: 16,
    textAlign: 'center',
    fontFamily: 'Poppins-Regular',
  },
  retryButton: {
    width: '100%',
    maxWidth: 300,
    borderRadius: 16,
    overflow: 'hidden',
  },
  retryButtonPressed: {
    opacity: 0.9,
  },
  retryButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
  },
  debugText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 16,
    textAlign: 'center',
    fontFamily: 'Poppins-Regular',
  },
});

