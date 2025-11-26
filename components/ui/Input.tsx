import React from 'react';
import { StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import theme from './theme';

interface Props extends React.ComponentProps<typeof TextInput> {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  rightElement?: React.ReactNode;
  leftElement?: React.ReactNode;
}

export const Input = React.forwardRef<TextInput, Props>(({ label, error, containerStyle, style, rightElement, leftElement, ...props }, ref) => {
  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.inputWrapper}>
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
          {...props}
        />
        {leftElement ? <View style={styles.left}>{leftElement}</View> : null}
        {rightElement ? <View style={styles.right}>{rightElement}</View> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { marginBottom: 10 },
  label: { color: theme.colors.text, marginBottom: 6, fontWeight: '600', fontSize: 13 },
  inputWrapper: { position: 'relative', justifyContent: 'center' },
  input: {
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 46,
    fontWeight: '400',
  },
  inputWithRight: {
    paddingRight: 48,
  },
  inputWithLeft: {
    paddingLeft: 42,
  },
  right: {
    position: 'absolute',
    right: 12,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  left: {
    position: 'absolute',
    left: 14,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  error: { marginTop: 6, color: theme.colors.danger, fontSize: 12 },
});

export default Input;
