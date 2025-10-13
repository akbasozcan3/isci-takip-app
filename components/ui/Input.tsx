import React from 'react';
import { StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import theme from './theme';

interface Props extends React.ComponentProps<typeof TextInput> {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export const Input = React.forwardRef<TextInput, Props>(({ label, error, containerStyle, style, ...props }, ref) => {
  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={theme.colors.textMuted}
        style={[styles.input, style]}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { marginBottom: 12 },
  label: { color: theme.colors.text, marginBottom: 6, fontWeight: '700' },
  input: {
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  error: { marginTop: 6, color: theme.colors.danger, fontSize: 12 },
});

export default Input;
