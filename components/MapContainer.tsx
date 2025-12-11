import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from './ui/theme/ThemeContext';

const Maps: any = Platform.OS === 'web' ? null : require('react-native-maps');
const MapView: any = Platform.OS === 'web' ? View : Maps?.default;

interface MapContainerProps {
  children: React.ReactNode;
  style?: ViewStyle;
  showGradient?: boolean;
  variant?: 'default' | 'gps' | 'dark';
}

export const MapContainer: React.FC<MapContainerProps> = ({
  children,
  style,
  showGradient = true,
  variant = 'gps',
}) => {
  const theme = useTheme();
  const gradientColors: [string, string] =
    variant === 'gps'
      ? (theme.colors.gradient.gps as [string, string])
      : variant === 'dark'
      ? (theme.colors.gradient.dark as [string, string])
      : (theme.colors.gradient.primary as [string, string]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg.primary }, style]}>
      {showGradient && (
        <LinearGradient
          colors={gradientColors}
          start={[0, 0]}
          end={[1, 1]}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View style={styles.content}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  content: {
    flex: 1,
    position: 'relative',
  },
});

export default MapContainer;

