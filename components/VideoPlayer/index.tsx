/**
 * Premium Video Player Component
 * Professional video player with controls and preview
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FadeInView } from '../ui/FadeInView';
import { useTheme } from '../ui/theme';

// Conditionally import expo-av (requires native module)
let VideoComponent: any = null;
type AVPlaybackStatus = any;

try {
  const expoAv = require('expo-av');
  VideoComponent = expoAv.Video;
} catch (error) {
  console.warn('expo-av not available, VideoPlayer will show placeholder');
}

interface VideoPlayerProps {
  source: any; // require() or { uri: string }
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  showControls?: boolean;
  resizeMode?: any;
  style?: any;
  onPlaybackStatusUpdate?: (status: AVPlaybackStatus) => void;
  preview?: boolean; // Show preview overlay
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  source,
  autoPlay = false,
  loop = true,
  muted = true,
  showControls = true,
  resizeMode = 'cover',
  style,
  onPlaybackStatusUpdate,
  preview = false,
}) => {
  const theme = useTheme();
  const videoRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(muted);
  const [showPreview, setShowPreview] = useState(preview);
  const [isLoading, setIsLoading] = useState(true);

  const handlePlayPause = async () => {
    if (videoRef.current) {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }
      setIsPlaying(!isPlaying);
      setShowPreview(false);
    }
  };

  const handleMuteToggle = async () => {
    if (videoRef.current) {
      await videoRef.current.setIsMutedAsync(!isMuted);
      setIsMuted(!isMuted);
    }
  };

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsPlaying(status.isPlaying);
      setIsLoading(status.isBuffering);
      
      // Auto-hide loading after video starts playing
      if (status.isPlaying && isLoading) {
        setIsLoading(false);
      }
      
      if (onPlaybackStatusUpdate) {
        onPlaybackStatusUpdate(status);
      }
    } else if (status.error) {
      setIsLoading(false);
      console.error('Video playback error:', status.error);
    }
  };

  // If VideoComponent is not available, show placeholder
  if (!VideoComponent) {
    return (
      <View style={[styles.container, style, { backgroundColor: theme.colors.bg.secondary, alignItems: 'center', justifyContent: 'center' }]}>
        <Ionicons name="videocam-outline" size={48} color={theme.colors.text.tertiary} />
        <Text style={{ color: theme.colors.text.tertiary, marginTop: 8 }}>Video player unavailable</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <VideoComponent
        ref={videoRef}
        source={source}
        style={styles.video}
        resizeMode={resizeMode}
        isLooping={loop}
        isMuted={isMuted}
        shouldPlay={autoPlay}
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        useNativeControls={false}
      />

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <Ionicons name="hourglass-outline" size={32} color="#ffffff" />
        </View>
      )}

      {showPreview && !isPlaying && (
        <FadeInView style={styles.previewOverlay}>
          <Pressable
            style={styles.playButton}
            onPress={handlePlayPause}
          >
            <View style={[styles.playButtonCircle, { backgroundColor: theme.colors.primary.main }]}>
              <Ionicons name="play" size={40} color="#ffffff" />
            </View>
          </Pressable>
        </FadeInView>
      )}

      {showControls && (
        <View style={styles.controlsOverlay}>
          <Pressable
            style={styles.controlButton}
            onPress={handlePlayPause}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={24}
              color="#ffffff"
            />
          </Pressable>

          <Pressable
            style={styles.controlButton}
            onPress={handleMuteToggle}
          >
            <Ionicons
              name={isMuted ? 'volume-mute' : 'volume-high'}
              size={24}
              color="#ffffff"
            />
          </Pressable>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  previewOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  playButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  controlsOverlay: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'row',
    gap: 12,
    zIndex: 4,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default VideoPlayer;

