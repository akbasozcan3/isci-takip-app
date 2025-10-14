import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  message: string;
  type: ToastType;
  visible: boolean;
  onHide: () => void;
  duration?: number;
}

export function Toast({ message, type, visible, onHide, duration = 3000 }: ToastProps) {
  const translateY = React.useRef(new Animated.Value(-100)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        hideToast();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide();
    });
  };

  if (!visible) return null;

  const getConfig = () => {
    switch (type) {
      case 'success':
        return { bg: '#10b981', icon: 'checkmark-circle' as const };
      case 'error':
        return { bg: '#ef4444', icon: 'close-circle' as const };
      case 'warning':
        return { bg: '#f59e0b', icon: 'warning' as const };
      case 'info':
      default:
        return { bg: '#06b6d4', icon: 'information-circle' as const };
    }
  };

  const config = getConfig();

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: config.bg,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <View style={styles.content}>
        <Ionicons name={config.icon} size={24} color="#fff" />
        <Text style={styles.message}>{message}</Text>
        <Pressable onPress={hideToast} style={styles.closeButton}>
          <Ionicons name="close" size={20} color="#fff" />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    marginHorizontal: 20,
    transform: [{ translateY: -40 }],
    zIndex: 9999,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignSelf: 'center',
    maxWidth: 400,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  message: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
  },
  closeButton: {
    padding: 4,
  },
});

// Hook for easy usage
export function useToast() {
  const [toast, setToast] = React.useState<{
    visible: boolean;
    message: string;
    type: ToastType;
  }>({
    visible: false,
    message: '',
    type: 'info',
  });

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ visible: true, message, type });
  };

  const hideToast = () => {
    setToast((prev) => ({ ...prev, visible: false }));
  };

  return {
    toast,
    showToast,
    hideToast,
    showSuccess: (msg: string) => showToast(msg, 'success'),
    showError: (msg: string) => showToast(msg, 'error'),
    showWarning: (msg: string) => showToast(msg, 'warning'),
    showInfo: (msg: string) => showToast(msg, 'info'),
  };
}
