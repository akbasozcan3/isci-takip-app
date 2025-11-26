import React from 'react';
import { Image, ImageStyle, StyleSheet, View } from 'react-native';

// Professional Brand Logo Component
// Modern design with elegant container and proper visibility

type Props = {
  size?: number;
  style?: ImageStyle;
  withSoftContainer?: boolean;
  variant?: 'default' | 'compact' | 'large';
};

export function BrandLogo({ 
  size = 80, 
  style, 
  withSoftContainer = false,
  variant = 'default' 
}: Props) {
  // Adjust size based on variant
  const adjustedSize = variant === 'compact' ? size * 0.7 : variant === 'large' ? size * 1.3 : size;

  const img = (
    <Image
      source={require('../app/(tabs)/assets/logo/Bavaxe.png')}
      resizeMode="contain"
      style={[
        styles.image,
        {
          width: adjustedSize,
          height: adjustedSize,
        },
        style
      ]}
    />
  );

  if (!withSoftContainer) {
    return (
      <View style={styles.baseContainer}>
        {img}
      </View>
    );
  }

  // Modern container with white background for better visibility
  return (
    <View style={styles.containerWrapper}>
      <View
        style={[
          styles.whiteContainer,
          {
            width: adjustedSize + 24,
            height: adjustedSize + 24,
            borderRadius: (adjustedSize + 24) / 2,
          }
        ]}
      >
        <View
          style={[
            styles.innerContainer,
            {
              width: adjustedSize,
              height: adjustedSize,
            }
          ]}
        >
          {img}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  baseContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  containerWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  whiteContainer: {
    backgroundColor: 'transparent',
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  innerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  image: {
    width: '100%',
    height: '100%',
    tintColor: undefined, // Keep original logo colors
  },
});

export default BrandLogo;
