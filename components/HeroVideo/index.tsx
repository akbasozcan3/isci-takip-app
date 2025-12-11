/**
 * Hero Video Component
 * Premium hero section with video background
 */

import React from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { VideoPlayer } from '../VideoPlayer';
import { FadeInView } from '../ui/FadeInView';
import { useTheme } from '../ui/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface HeroVideoProps {
  videoSource: any;
  title?: string;
  subtitle?: string;
  height?: number;
  showOverlay?: boolean;
  style?: any;
}

export const HeroVideo: React.FC<HeroVideoProps> = ({
  videoSource,
  title,
  subtitle,
  height = 400,
  showOverlay = true,
  style,
}) => {
  const theme = useTheme();

  return (
    <View style={[styles.container, { height }, style]}>
      <VideoPlayer
        source={videoSource}
        autoPlay={true}
        loop={true}
        muted={true}
        showControls={false}
        resizeMode="cover"
        style={styles.video}
      />

      {showOverlay && (title || subtitle) && (
        <View style={styles.overlay}>
          <FadeInView delay={300} style={styles.content}>
            {title && (
              <Text
                style={[
                  styles.title,
                  {
                    color: theme.colors.text.primary,
                  },
                ]}
              >
                {title}
              </Text>
            )}
            {subtitle && (
              <Text
                style={[
                  styles.subtitle,
                  {
                    color: theme.colors.text.secondary,
                  },
                ]}
              >
                {subtitle}
              </Text>
            )}
          </FadeInView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
    maxWidth: SCREEN_WIDTH * 0.9,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 24,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

export default HeroVideo;

