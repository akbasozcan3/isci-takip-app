/**
 * Network Guard Component
 * Blocks app access when internet is not available
 */

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { checkNetworkStatus, waitForNetwork } from '../utils/network';

interface NetworkGuardProps {
  children: React.ReactNode;
}

export function NetworkGuard({ children }: NetworkGuardProps) {
  const [isChecking, setIsChecking] = React.useState(true);
  const [isConnected, setIsConnected] = React.useState(false);
  const [isRetrying, setIsRetrying] = React.useState(false);

  React.useEffect(() => {
    checkConnection();
    
    // Only check periodically if connected, otherwise stop checking
    // This prevents infinite loop when backend is unreachable
    let interval: ReturnType<typeof setInterval> | null = null;
    
    const startPeriodicCheck = () => {
      if (interval) clearInterval(interval);
      interval = setInterval(() => {
        // Only check if we think we're connected, otherwise user needs to retry manually
        if (isConnected) {
          checkConnection();
        }
      }, 30000); // Check every 30 seconds when connected
    };
    
    // Start periodic check only after initial connection is established
    if (isConnected) {
      startPeriodicCheck();
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isConnected]);

  const checkConnection = async () => {
    try {
      setIsChecking(true);
      const status = await checkNetworkStatus(true);
      
      if (status.isConnected && status.isBackendReachable) {
        setIsConnected(true);
        setIsChecking(false);
      } else {
        setIsConnected(false);
        setIsChecking(false);
        // Log for debugging
        console.log('[NetworkGuard] Connection failed:', {
          isConnected: status.isConnected,
          isBackendReachable: status.isBackendReachable
        });
      }
    } catch (error: any) {
      // Silently handle timeout errors
      if (error?.name !== 'AbortError' && error?.message && !error.message.includes('Aborted')) {
        console.error('[NetworkGuard] Connection check error:', error);
      }
      setIsConnected(false);
      setIsChecking(false);
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      const connected = await waitForNetwork(5, 2000);
      if (connected) {
        setIsConnected(true);
        await checkConnection();
      } else {
        setIsConnected(false);
      }
    } catch (error) {
      console.error('[NetworkGuard] Retry error:', error);
      setIsConnected(false);
    } finally {
      setIsRetrying(false);
    }
  };

  if (isChecking) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.gradient}>
          <View style={styles.content}>
            <ActivityIndicator size="large" color="#06b6d4" />
            <Text style={styles.checkingText}>İnternet bağlantısı kontrol ediliyor...</Text>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  if (!isConnected) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.gradient}>
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Ionicons name="cloud-offline" size={80} color="#ef4444" />
            </View>
            <Text style={styles.title}>İnternet Bağlantısı Gerekli</Text>
            <Text style={styles.description}>
              Bu uygulamayı kullanmak için aktif bir internet bağlantısı gereklidir.
            </Text>
            <Text style={styles.subDescription}>
              Lütfen Wi-Fi veya mobil veri bağlantınızı kontrol edin ve tekrar deneyin.
            </Text>
            <Text style={styles.debugText}>
              Backend: {(() => {
                try {
                  const { getApiBase } = require('../utils/api');
                  return getApiBase();
                } catch {
                  return 'N/A';
                }
              })()}
            </Text>
            
            <Pressable
              onPress={handleRetry}
              disabled={isRetrying}
              style={({ pressed }) => [
                styles.retryButton,
                (pressed || isRetrying) && styles.retryButtonPressed,
              ]}
            >
              <LinearGradient
                colors={['#06b6d4', '#0ea5a4']}
                style={styles.retryButtonGradient}
              >
                {isRetrying ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="refresh" size={20} color="#fff" />
                    <Text style={styles.retryButtonText}>Tekrar Dene</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

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

