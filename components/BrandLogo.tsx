import React from 'react';
import { Image, ImageStyle, View } from 'react-native';

// Centralized brand logo component. Uses the user-provided asset path.
// Note: The provided PNG seems to have a white background. To avoid a hard white box
// on dark screens, we place it on a subtle soft container when desired via the wrapper.
// If you later provide a transparent-background PNG/SVG, this will automatically look even better.

type Props = {
  size?: number;
  style?: ImageStyle;
  withSoftContainer?: boolean;
  tintColor?: string;
};

export function BrandLogo({ size = 80, style, withSoftContainer = false, tintColor }: Props) {
  const img = (
    <Image
      source={require('../app/(tabs)/assets/logo/logo.png')}
      resizeMode="contain"
      style={[{ width: size, height: size, tintColor: tintColor as any }, style]}
    />
  );

  if (!withSoftContainer) return img;

  return (
    <View
      style={{
        width: size + 24,
        height: size + 24,
        borderRadius: (size + 24) / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)'
      }}
    >
      {img}
    </View>
  );
}
