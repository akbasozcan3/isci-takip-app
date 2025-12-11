import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import {
    Animated,
    Platform,
    Pressable,
    Modal as RNModal,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useTheme } from '../theme';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  showCloseButton?: boolean;
  animationType?: 'fade' | 'slide' | 'none';
  size?: 'sm' | 'md' | 'lg' | 'full';
  variant?: 'default' | 'centered' | 'bottomSheet';
}

export const Modal: React.FC<ModalProps> = ({
  visible,
  onClose,
  title,
  description,
  children,
  showCloseButton = true,
  animationType = 'fade',
  size = 'md',
  variant = 'default',
}) => {
  const theme = useTheme();
  const scaleAnim = React.useRef(new Animated.Value(0.8)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(300)).current;

  React.useEffect(() => {
    if (visible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      if (variant === 'bottomSheet') {
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
      } else {
        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 1,
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
      }
    } else {
      if (variant === 'bottomSheet') {
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: 300,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 0.8,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }),
        ]).start();
      }
    }
  }, [visible]);

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return { maxWidth: 400, padding: theme.spacing.lg };
      case 'lg':
        return { maxWidth: 600, padding: theme.spacing.xl };
      case 'full':
        return { width: '100%', padding: theme.spacing.lg };
      default:
        return { maxWidth: 500, padding: theme.spacing.lg };
    }
  };

  const getVariantStyles = () => {
    if (variant === 'bottomSheet') {
      return {
        container: styles.bottomSheetContainer,
        content: [
          styles.bottomSheetContent,
          {
            backgroundColor: theme.colors.surface.elevated,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            padding: theme.spacing.lg,
            transform: [{ translateY: slideAnim }],
          },
        ],
      };
    }

    if (variant === 'centered') {
      return {
        container: styles.centeredContainer,
        content: [
          styles.centeredContent,
          {
            backgroundColor: theme.colors.surface.elevated,
            borderRadius: theme.radius.xl,
            padding: getSizeStyles().padding,
            maxWidth: getSizeStyles().maxWidth,
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
          },
        ],
      };
    }

    return {
      container: styles.defaultContainer,
      content: [
        styles.defaultContent,
        {
          backgroundColor: theme.colors.surface.elevated,
          borderRadius: theme.radius.xl,
          padding: getSizeStyles().padding,
          maxWidth: getSizeStyles().maxWidth,
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        },
      ],
    };
  };

  const variantStyles = getVariantStyles();

  if (!visible) return null;

  return (
    <RNModal
      visible={visible}
      transparent
      animationType={animationType}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={[styles.overlay, { opacity: opacityAnim }]}
        onPress={onClose}
      >
        <Pressable
          style={variantStyles.content}
          onPress={(e) => e.stopPropagation()}
        >
          {(title || showCloseButton) && (
            <View style={styles.header}>
              {title && (
                <View style={styles.headerContent}>
                  <Text style={[styles.title, { color: theme.colors.text.primary }]}>
                    {title}
                  </Text>
                  {description && (
                    <Text style={[styles.description, { color: theme.colors.text.secondary }]}>
                      {description}
                    </Text>
                  )}
                </View>
              )}
              {showCloseButton && (
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onClose();
                  }}
                  style={({ pressed }) => [
                    styles.closeButton,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Ionicons
                    name="close"
                    size={24}
                    color={theme.colors.text.secondary}
                  />
                </Pressable>
              )}
            </View>
          )}

          {children && (
            <View style={styles.body}>
              {children}
            </View>
          )}
        </Pressable>
      </Pressable>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(4px)',
      },
    }),
  },
  defaultContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomSheetContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  defaultContent: {
    width: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  centeredContent: {
    width: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  bottomSheetContent: {
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerContent: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  closeButton: {
    padding: 4,
    borderRadius: 8,
  },
  body: {
    flex: 1,
  },
});

