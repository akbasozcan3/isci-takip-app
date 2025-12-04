import React from 'react';
import { Animated, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import theme from './theme';

interface Props extends React.ComponentProps<typeof TextInput> {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  rightElement?: React.ReactNode;
  leftElement?: React.ReactNode;
}

export const Input = React.forwardRef<TextInput, Props>(({ label, error, containerStyle, style, rightElement, leftElement, ...props }, ref) => {
  const [isFocused, setIsFocused] = React.useState(false);
  const borderAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    Animated.timing(borderAnim, {
      toValue: isFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isFocused]);

  React.useEffect(() => {
    if (error) {
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.02, duration: 100, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]).start();
    }
  }, [error]);

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(148, 163, 184, 0.5)', theme.colors.primary],
  });

  return (
    <Animated.View style={[styles.container, containerStyle, { transform: [{ scale: scaleAnim }] }]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Animated.View 
        style={[
          styles.inputWrapper, 
          { 
            borderColor,
            shadowColor: isFocused ? theme.colors.primary : 'rgba(0, 0, 0, 0.3)',
            shadowOffset: { width: 0, height: isFocused ? 4 : 2 },
            shadowOpacity: isFocused ? 0.4 : 0.2,
            shadowRadius: isFocused ? 12 : 4,
            elevation: isFocused ? 6 : 2,
            borderWidth: isFocused ? 2 : 1.5,
          }
        ]}
      >
        <TextInput
          ref={ref}
          placeholderTextColor={theme.colors.textMuted}
          style={[
            styles.input,
            rightElement ? styles.inputWithRight : null,
            leftElement ? styles.inputWithLeft : null,
            style,
          ]}
          autoCapitalize="none"
          autoCorrect={false}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        {leftElement ? <View style={styles.left}>{leftElement}</View> : null}
        {rightElement ? <View style={styles.right}>{rightElement}</View> : null}
      </Animated.View>
      {error ? (
        <Animated.View style={{ opacity: error ? 1 : 0 }}>
          <Text style={styles.error}>{error}</Text>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: { marginBottom: 10 },
  label: { color: theme.colors.text, marginBottom: 5, fontWeight: '600', fontSize: 12 },
  inputWrapper: { 
    position: 'relative', 
    justifyContent: 'center', 
    borderWidth: 1.5, 
    borderRadius: 12,
    backgroundColor: '#1e293b',
    overflow: 'hidden',
    minHeight: 44,
  },
  input: {
    backgroundColor: 'transparent',
    color: theme.colors.text,
    borderWidth: 0,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
    fontSize: 14,
    minHeight: 44,
    fontWeight: '400',
    width: '100%',
    lineHeight: 20,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  inputWithRight: {
    paddingRight: 50,
  },
  inputWithLeft: {
    paddingLeft: 50,
  },
  right: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  left: {
    position: 'absolute',
    left: 12,
    top: '50%',
    marginTop: -16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  error: { marginTop: 6, color: theme.colors.danger, fontSize: 12 },
});

export default Input;
