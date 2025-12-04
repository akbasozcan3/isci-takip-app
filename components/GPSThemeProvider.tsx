import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import theme from './ui/theme';

interface GPSThemeProviderProps {
  children: React.ReactNode;
  variant?: 'default' | 'gps' | 'success' | 'danger';
}

export const GPSThemeProvider: React.FC<GPSThemeProviderProps> = ({ children, variant = 'default' }) => {
  const gradientColors: [string, string] = 
    variant === 'gps' ? theme.colors.gradient.gps as [string, string] :
    variant === 'success' ? theme.colors.gradient.success as [string, string] :
    variant === 'danger' ? theme.colors.gradient.danger as [string, string] :
    theme.colors.gradient.primary as [string, string];

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={gradientColors}
        start={[0, 0]}
        end={[1, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.95)' }} />
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
});

