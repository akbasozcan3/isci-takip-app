import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  message: string;
  type: ToastType;
  visible: boolean;
  onHide: () => void;
  duration?: number;
}

export function Toast({ message, type, visible, onHide, duration = 3000 }: ToastProps) {
  const translateY = React.useRef(new Animated.Value(50)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;
  const scale = React.useRef(new Animated.Value(0.8)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        hideToast();
      }, duration);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [visible, duration]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 50,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.8,
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
        return { 
          bg: '#10b981', 
          icon: 'checkmark-circle' as const,
          shadowColor: '#10b981',
        };
      case 'error':
        return { 
          bg: '#ef4444', 
          icon: 'close-circle' as const,
          shadowColor: '#ef4444',
        };
      case 'warning':
        return { 
          bg: '#f59e0b', 
          icon: 'warning' as const,
          shadowColor: '#f59e0b',
        };
      case 'info':
      default:
        return { 
          bg: '#06b6d4', 
          icon: 'information-circle' as const,
          shadowColor: '#06b6d4',
        };
    }
  };

  const config = getConfig();

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: config.bg,
          transform: [{ translateY }, { scale }],
          opacity,
          shadowColor: config.shadowColor,
        },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name={config.icon} size={22} color="#fff" />
        </View>
        <Text style={styles.message}>{message}</Text>
        <Pressable onPress={hideToast} style={styles.closeButton}>
          <Ionicons name="close" size={18} color="#fff" />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 50,
    left: 20,
    right: 20,
    zIndex: 9999,
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignSelf: 'center',
    maxWidth: 400,
    width: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 22,
    textAlign: 'center',
    fontFamily: 'Poppins-SemiBold',
    letterSpacing: 0.2,
  },
  closeButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
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
    // Font hatalarını filtrele - Toast'ta gösterme
    if (message.includes('ExpoFontLoader') || 
        message.includes('ionicons') || 
        message.includes('Call to function')) {
      return;
    }
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
