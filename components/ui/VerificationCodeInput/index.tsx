import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

interface VerificationCodeInputProps {
  value: string;
  onChangeText: (text: string) => void;
  length?: number;
  loading?: boolean;
  verified?: boolean;
  autoFocus?: boolean;
}

export const VerificationCodeInput: React.FC<VerificationCodeInputProps> = ({
  value,
  onChangeText,
  length = 6,
  loading = false,
  verified = false,
  autoFocus = false,
}) => {
  const theme = useTheme();
  const inputRef = React.useRef<TextInput>(null);
  const digits = value.split('').slice(0, length);
  const emptyDigits = Array(length - digits.length).fill('');

  React.useEffect(() => {
    if (autoFocus && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [autoFocus]);

  const handleTextChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, length);
    onChangeText(cleaned);
  };

  const handleDigitPress = () => {
    inputRef.current?.focus();
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={handleDigitPress}
        style={styles.digitsContainer}
      >
        {digits.map((digit, index) => (
          <View
            key={`digit-${index}`}
            style={[
              styles.digitBox,
              {
                backgroundColor: verified
                  ? theme.colors.success + '15'
                  : digit
                    ? theme.colors.primary + '15'
                    : theme.colors.surface,
                borderColor: verified
                  ? theme.colors.success
                  : digit
                    ? theme.colors.primary
                    : theme.colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.digitText,
                {
                  color: verified
                    ? theme.colors.success
                    : theme.colors.text,
                },
              ]}
            >
              {digit}
            </Text>
          </View>
        ))}
        {emptyDigits.map((_, index) => (
          <View
            key={`empty-${index}`}
            style={[
              styles.digitBox,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[styles.digitText, { color: 'transparent' }]}>
              0
            </Text>
          </View>
        ))}
      </TouchableOpacity>
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={value}
        onChangeText={handleTextChange}
        keyboardType="number-pad"
        maxLength={length}
        autoFocus={autoFocus}
        autoComplete="off"
        selectTextOnFocus
      />
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  digitsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  digitBox: {
    width: 42,
    height: 52,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitText: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: 'Poppins-Bold',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: -30,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});

export default VerificationCodeInput;
