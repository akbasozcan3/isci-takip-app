import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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

  const handleDigitPress = (index: number) => {
    inputRef.current?.focus();
    if (index < digits.length) {
      const newValue = digits.slice(0, index).join('');
      onChangeText(newValue);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.digitsContainer}>
        {digits.map((digit, index) => (
          <Pressable
            key={`digit-${index}`}
            onPress={() => handleDigitPress(index)}
            style={[
              styles.digitBox,
              {
                backgroundColor: verified
                  ? theme.colors.semantic.success + '33'
                  : digit
                  ? theme.colors.primary.main + '33'
                  : theme.colors.surface.default,
                borderColor: verified
                  ? theme.colors.semantic.success
                  : digit
                  ? theme.colors.primary.main
                  : theme.colors.border.default,
              },
              verified && digit && styles.digitVerified,
              digit && !verified && styles.digitFilled,
            ]}
          >
            <Text
              style={[
                styles.digitText,
                {
                  color: verified
                    ? theme.colors.semantic.success
                    : theme.colors.text.primary,
                },
              ]}
            >
              {digit}
            </Text>
          </Pressable>
        ))}
        {emptyDigits.map((_, index) => (
          <View
            key={`empty-${index}`}
            style={[
              styles.digitBox,
              {
                backgroundColor: theme.colors.surface.default,
                borderColor: theme.colors.border.default,
              },
            ]}
          >
            <Text style={[styles.digitText, { color: theme.colors.text.primary }]}>
              {''}
            </Text>
          </View>
        ))}
      </View>
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
          <ActivityIndicator size="small" color={theme.colors.primary.main} />
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
    justifyContent: 'space-between',
    gap: 10,
  },
  digitBox: {
    flex: 1,
    height: 68,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 50,
  },
  digitFilled: {
  },
  digitVerified: {
  },
  digitText: {
    fontSize: 32,
    fontWeight: '900',
    fontFamily: 'Poppins-ExtraBold',
    letterSpacing: 1,
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
