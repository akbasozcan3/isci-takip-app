import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from './ui/theme/ThemeContext';

interface GPSThemeProviderProps {
  children: React.ReactNode;
  variant?: 'default' | 'gps' | 'success' | 'danger';
}

export const GPSThemeProvider: React.FC<GPSThemeProviderProps> = ({ children, variant = 'default' }) => {
  const theme = useTheme();
  const gradientColors: [string, string] = 
    variant === 'gps' ? (theme.colors.gradients.background.slice(0, 2) as [string, string]) :
    variant === 'success' ? (theme.colors.gradients.success.slice(0, 2) as [string, string]) :
    variant === 'danger' ? (theme.colors.gradients.error.slice(0, 2) as [string, string]) :
    (theme.colors.gradients.primary.slice(0, 2) as [string, string]);

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

