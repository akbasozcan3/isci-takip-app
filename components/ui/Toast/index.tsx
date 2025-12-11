/**
 * Toast Component
 * Premium toast notifications with animations
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose?: () => void;
  visible: boolean;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  duration = 3000,
  onClose,
  visible,
}) => {
  const theme = useTheme();
  const slideAnim = React.useRef(new Animated.Value(-100)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      if (duration > 0) {
        const timer = setTimeout(() => {
          hide();
        }, duration);
        return () => clearTimeout(timer);
      }
    } else {
      hide();
    }
  }, [visible, duration]);

  const hide = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose?.();
    });
  };

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          backgroundColor: theme.colors.semantic.success,
          icon: 'checkmark-circle' as const,
        };
      case 'error':
        return {
          backgroundColor: theme.colors.semantic.danger,
          icon: 'close-circle' as const,
        };
      case 'warning':
        return {
          backgroundColor: theme.colors.semantic.warning,
          icon: 'warning' as const,
        };
      default:
        return {
          backgroundColor: theme.colors.primary.main,
          icon: 'information-circle' as const,
        };
    }
  };

  const typeStyles = getTypeStyles();

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <View
        style={[
          styles.toast,
          {
            backgroundColor: typeStyles.backgroundColor,
          },
        ]}
      >
        <Ionicons
          name={typeStyles.icon}
          size={24}
          color="#ffffff"
          style={styles.icon}
        />
        <Text style={styles.message}>{message}</Text>
        {onClose && (
          <Pressable onPress={hide} style={styles.closeButton}>
            <Ionicons name="close" size={20} color="#ffffff" />
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  icon: {
    marginRight: 12,
  },
  message: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    marginLeft: 12,
    padding: 4,
  },
});

export default Toast;

