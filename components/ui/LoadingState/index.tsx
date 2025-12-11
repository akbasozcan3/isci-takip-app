import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';

interface LoadingStateProps {
  message?: string;
  size?: 'small' | 'large';
  fullScreen?: boolean;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Yükleniyor...',
  size = 'large',
  fullScreen = false,
}) => {
  const theme = useTheme();

  const content = (
    <View style={styles.container}>
      <ActivityIndicator
        size={size}
        color={theme.colors.primary.main}
        style={styles.spinner}
      />
      {message && (
        <Text style={[styles.message, { color: theme.colors.text.secondary }]}>
          {message}
        </Text>
      )}
    </View>
  );

  if (fullScreen) {
    return (
      <View style={[styles.fullScreen, { backgroundColor: theme.colors.bg.primary }]}>
        {content}
      </View>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  fullScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    marginBottom: 16,
  },
  message: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});

