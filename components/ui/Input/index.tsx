import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Animated, Pressable, StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const Input = React.forwardRef<TextInput, InputProps>(
  (
    {
      label,
      error,
      leftIcon,
      rightIcon,
      onRightIconPress,
      containerStyle,
      style,
      leftElement,
      rightElement,
      ...props
    },
    ref
  ) => {
    const theme = useTheme();
    const [isFocused, setIsFocused] = React.useState(false);
    const borderAnim = React.useRef(new Animated.Value(0)).current;
    const scaleAnim = React.useRef(new Animated.Value(1)).current;

    React.useEffect(() => {
      Animated.timing(borderAnim, {
        toValue: isFocused ? 1 : 0,
        duration: theme.animation.fast,
        useNativeDriver: false,
      }).start();
    }, [isFocused, borderAnim, theme.animation.fast]);

    React.useEffect(() => {
      if (error) {
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.02,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }),
        ]).start();
      }
    }, [error, scaleAnim]);

    const borderColor = borderAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [theme.colors.border.default, theme.colors.primary.main],
    });

    return (
      <Animated.View
        style={[
          styles.container,
          containerStyle,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        {label && (
          <Text style={[styles.label, { color: theme.colors.text.secondary }]}>
            {label}
          </Text>
        )}
        <Animated.View
          style={[
            styles.inputWrapper,
            {
              backgroundColor: theme.colors.surface.default,
              borderColor: error
                ? theme.colors.semantic.danger
                : borderColor,
              borderWidth: isFocused ? 2 : error ? 1.5 : 1.5,
            },
          ]}
        >
          {(leftIcon || leftElement) && (
            <View style={styles.left}>
              {leftElement || (
                <Ionicons
                  name={leftIcon!}
                  size={20}
                  color={theme.colors.text.tertiary}
                />
              )}
            </View>
          )}
          <TextInput
            ref={ref}
            placeholderTextColor={theme.colors.text.disabled}
            style={[
              styles.input,
              {
                color: theme.colors.text.primary,
              },
              ...((leftIcon || leftElement) ? [styles.inputWithLeft] : []),
              ...((rightIcon || rightElement) ? [styles.inputWithRight] : []),
              style,
            ]}
            autoCapitalize="none"
            autoCorrect={false}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            {...props}
          />
          {(rightIcon || rightElement) && (
            <Pressable
              onPress={onRightIconPress}
              style={styles.right}
            >
              {rightElement || (
                <Ionicons
                  name={rightIcon!}
                  size={20}
                  color={theme.colors.text.tertiary}
                />
              )}
            </Pressable>
          )}
        </Animated.View>
        {error && (
          <Animated.View style={{ opacity: error ? 1 : 0 }}>
            <Text style={[styles.error, { color: theme.colors.semantic.danger }]}>
              {error}
            </Text>
          </Animated.View>
        )}
      </Animated.View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 48,
  },
  input: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingTop: 17,
    paddingBottom: 7,
    fontSize: 16,
    minHeight: 48,
    fontWeight: '400',
    width: '100%',
    textAlignVertical: 'center',
  },
  inputWithLeft: {
    paddingLeft: 52,
  },
  inputWithRight: {
    paddingRight: 52,
  },
  left: {
    position: 'absolute',
    left: 16,
    top: 0,
    bottom: 0,
    width: 28,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  right: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  error: {
    marginTop: 6,
    fontSize: 12,
  },
});

Input.displayName = 'Input';
export default Input;

