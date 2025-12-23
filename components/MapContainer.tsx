import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from './ui/theme/ThemeContext';


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
      ? (theme.colors.gradients.background.slice(0, 2) as [string, string])
      : variant === 'dark'
      ? (theme.colors.gradients.background.slice(0, 2) as [string, string])
      : (theme.colors.gradients.primary.slice(0, 2) as [string, string]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }, style]}>
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

