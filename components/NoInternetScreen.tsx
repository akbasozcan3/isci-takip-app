/**
 * No Internet Screen Component
 * Trendyol-style offline screen with retry functionality
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

interface NoInternetScreenProps {
  onRetry: () => void | Promise<void>;
  isRetrying?: boolean;
  message?: string;
  showBackendError?: boolean;
}

export default function NoInternetScreen({
  onRetry,
  isRetrying = false,
  message,
  showBackendError = false,
}: NoInternetScreenProps) {
  const handleRetry = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await onRetry();
  };

  const title = showBackendError
    ? 'Sunucuya Bağlanılamıyor'
    : 'Bağlantı Sorunu';
  
  const subtitle = message || (showBackendError
    ? 'Sunucuya bağlanılamıyor. Lütfen internet bağlantınızı kontrol edin ve tekrar deneyin.'
    : 'İnternet bağlantınızı kontrol edin ve tekrar deneyin.');

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0f172a', '#1e293b']}
        style={styles.gradient}
      >
        <View style={styles.content}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Ionicons
              name={showBackendError ? 'server-outline' : 'wifi-outline'}
              size={120}
              color="#64748b"
            />
            <View style={styles.iconBadge}>
              <Ionicons name="close" size={24} color="#ef4444" />
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Subtitle */}
          <Text style={styles.subtitle}>{subtitle}</Text>

          {/* Tips */}
          <View style={styles.tipsContainer}>
            <View style={styles.tipItem}>
              <Ionicons name="checkmark-circle" size={20} color="#06b6d4" />
              <Text style={styles.tipText}>Wi-Fi veya mobil veri açık mı?</Text>
            </View>
            <View style={styles.tipItem}>
              <Ionicons name="checkmark-circle" size={20} color="#06b6d4" />
              <Text style={styles.tipText}>Uçak modu kapalı mı?</Text>
            </View>
            <View style={styles.tipItem}>
              <Ionicons name="checkmark-circle" size={20} color="#06b6d4" />
              <Text style={styles.tipText}>Sinyal gücünüz yeterli mi?</Text>
            </View>
          </View>

          {/* Retry Button */}
          <TouchableOpacity
            style={[styles.retryButton, isRetrying && styles.retryButtonDisabled]}
            onPress={handleRetry}
            disabled={isRetrying}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#06b6d4', '#0ea5a4']}
              style={styles.retryButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {isRetrying ? (
                <View style={styles.retryButtonContent}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.retryButtonText}>Kontrol Ediliyor...</Text>
                </View>
              ) : (
                <View style={styles.retryButtonContent}>
                  <Ionicons name="refresh" size={20} color="#fff" />
                  <Text style={styles.retryButtonText}>Tekrar Dene</Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 32,
  },
  iconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#0f172a',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
    fontFamily: 'Poppins-Bold',
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
    fontFamily: 'Poppins-Medium',
    paddingHorizontal: 20,
  },
  tipsContainer: {
    width: '100%',
    maxWidth: 400,
    marginBottom: 32,
    gap: 12,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  tipText: {
    fontSize: 14,
    color: '#cbd5e1',
    fontFamily: 'Poppins-Medium',
    flex: 1,
  },
  retryButton: {
    width: '100%',
    maxWidth: 300,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  retryButtonDisabled: {
    opacity: 0.7,
  },
  retryButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Poppins-Bold',
  },
});

