/**
 * Professional Video Banner Component
 * Premium video banner with auto-play, loop, and responsive design
 */

import { Ionicons } from '@expo/vector-icons';
import { Video } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { FadeInView } from '../ui/FadeInView';

interface VideoBannerProps {
  source: any; // require() or { uri: string }
  height?: number;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  showControls?: boolean;
  showOverlay?: boolean;
  overlayContent?: React.ReactNode;
  onPress?: () => void;
  style?: any;
  resizeMode?: any; // 'contain' | 'cover' | 'stretch' - expo-av ResizeMode type
}

export const VideoBanner: React.FC<VideoBannerProps> = ({
  source,
  height = 400,
  autoPlay = true,
  loop = true,
  muted = true,
  showControls = false,
  showOverlay = false,
  overlayContent,
  onPress,
  style,
  resizeMode = 'cover',
}) => {
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isMuted, setIsMuted] = useState(muted);
  const [retryCount, setRetryCount] = useState(0);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Timeout mechanism: if video doesn't load within 15 seconds, show error
  useEffect(() => {
    if (isLoading && !hasError) {
      loadingTimeoutRef.current = setTimeout(() => {
        setIsLoading(false);
        setHasError(true);
      }, 15000); // 15 seconds timeout
    }

    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [isLoading, hasError]);

  const handlePlayPause = async () => {
    if (videoRef.current) {
      try {
        if (isPlaying) {
          await videoRef.current.pauseAsync();
        } else {
          await videoRef.current.playAsync();
        }
        setIsPlaying(!isPlaying);
      } catch (error) {
      }
    }
  };

  const handleMuteToggle = async () => {
    if (videoRef.current) {
      try {
        await videoRef.current.setIsMutedAsync(!isMuted);
        setIsMuted(!isMuted);
      } catch (error) {
      }
    }
  };

  const handlePlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      // Clear timeout when video loads successfully
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      setIsPlaying(status.isPlaying);
      setIsLoading(status.isBuffering);
      
      if (status.didJustFinish && loop) {
        videoRef.current?.replayAsync();
      }
    } else if (status.error) {
      // Clear timeout when error occurs
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      
      // Extract error message/string for checking - try multiple ways
      let errorMessage = '';
      if (typeof status.error === 'string') {
        errorMessage = status.error;
      } else if (status.error?.message) {
        errorMessage = status.error.message;
      } else if (status.error?.toString) {
        errorMessage = status.error.toString();
      } else {
        // Try to stringify the entire error object
        try {
          errorMessage = JSON.stringify(status.error);
        } catch {
          errorMessage = String(status.error);
        }
      }
      
      // Normalize error message to lowercase for easier matching
      const errorMessageLower = errorMessage.toLowerCase();
      
      // Check for HTTP error codes (404, 403, 500, etc.) - don't retry these
      const isHttpError = /(404|403|500|502|503|504)/.test(errorMessage) ||
        errorMessage.includes('Response code:') ||
        errorMessage.includes('InvalidResponseCodeException') ||
        errorMessageLower.includes('httpdatasource') ||
        errorMessageLower.includes('invalidresponse');
      
      // Check for network/connection errors that might be retryable
      // Also check for SocketTimeoutException specifically
      const isNetworkError = errorMessageLower.includes('network') ||
        errorMessageLower.includes('timeout') ||
        errorMessageLower.includes('socket') ||
        errorMessageLower.includes('connection') ||
        errorMessageLower.includes('econnrefused') ||
        errorMessage.includes('SocketTimeoutException') ||
        errorMessage.includes('HttpDataSourceException');
      
      // For HTTP errors (like 404), silently handle - don't log as error
      if (isHttpError) {
        // HTTP errors are expected when video doesn't exist, use debug level
        if (__DEV__) {
          console.debug('[VideoBanner] HTTP error (video not found), showing error state');
        }
        setIsLoading(false);
        setHasError(true);
        return;
      }
      
      
      // For network errors, retry up to 2 times
      if (isNetworkError && retryCount < 2) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          videoRef.current?.replayAsync().catch(() => {
            setIsLoading(false);
            setHasError(true);
          });
        }, 2000);
      } else {
        // Unknown error or max retries reached
        setIsLoading(false);
        setHasError(true);
      }
    }
  };

  const handleError = (error: any) => {
    // Clear timeout when error occurs
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
    
    // Extract error message for logging
    let errorMessage = '';
    if (typeof error === 'string') {
      errorMessage = error;
    } else if (error?.message) {
      errorMessage = error.message;
    } else if (error?.toString) {
      errorMessage = error.toString();
    } else {
      try {
        errorMessage = JSON.stringify(error);
      } catch {
        errorMessage = String(error);
      }
    }
    
    // Check if it's an HTTP error (404, etc.)
    const isHttpError = /(404|403|500|502|503|504)/.test(errorMessage) ||
      errorMessage.includes('Response code:') ||
      errorMessage.includes('InvalidResponseCodeException') ||
      errorMessage.toLowerCase().includes('httpdatasource');
    
    // For HTTP errors, silently handle - don't log as error
    if (isHttpError) {
      if (__DEV__) {
        console.debug('[VideoBanner] HTTP error in handleError (video not found)');
      }
    } else {
    }
    
    setIsLoading(false);
    setHasError(true);
  };

  const handleLoadStart = () => {
    // Don't reset loading state if we already have an error
    if (!hasError) {
      setIsLoading(true);
    }
  };

  const containerStyle = [
    styles.container,
    { height },
    style,
  ];

  if (hasError) {
    // If we have overlay content, show it with a nice gradient background instead of error message
    if (overlayContent && showOverlay) {
      return (
        <View style={containerStyle}>
          <View style={styles.videoContainer}>
            <LinearGradient
              colors={['#0f172a', '#1e293b', '#334155', '#475569']}
              style={styles.errorGradientBackground}
            >
              {/* Shine Effect Overlay */}
              <LinearGradient
                colors={['transparent', 'rgba(6,182,212,0.1)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.shineOverlay}
                pointerEvents="none"
              />
              {/* Professional Gradient Overlay (same as normal video) */}
              <LinearGradient
                colors={['rgba(15,23,42,0.4)', 'rgba(15,23,42,0.7)', 'rgba(15,23,42,0.95)']}
                style={styles.gradientOverlay}
                pointerEvents="none"
              />
              {/* Overlay Content */}
              <FadeInView style={styles.overlay}>
                {overlayContent}
              </FadeInView>
            </LinearGradient>
          </View>
        </View>
      );
    }
    
    // Fallback: Show error message if no overlay content
    return (
      <View style={[containerStyle, styles.errorContainer]}>
        <LinearGradient
          colors={['#0f172a', '#1e293b', '#334155']}
          style={styles.errorGradient}
        >
          <View style={styles.errorContent}>
            <View style={styles.errorIconContainer}>
              <Ionicons name="videocam-outline" size={64} color="#0EA5E9" />
            </View>
            <Text style={styles.errorTitle}>Video Yüklenemedi</Text>
            <Text style={styles.errorSubtext}>
              Video dosyası bulunamadı veya yüklenemedi
            </Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <Pressable 
        style={styles.videoContainer}
        onPress={onPress}
      >
        <Video
          ref={videoRef}
          source={source}
          style={styles.video}
          resizeMode={resizeMode}
          isLooping={loop}
          isMuted={isMuted}
          shouldPlay={autoPlay}
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
          useNativeControls={false}
          onLoadStart={handleLoadStart}
          onLoad={() => {
            if (loadingTimeoutRef.current) {
              clearTimeout(loadingTimeoutRef.current);
              loadingTimeoutRef.current = null;
            }
            setIsLoading(false);
          }}
          onError={handleError}
        />

        {/* Professional Gradient Overlay */}
        <LinearGradient
          colors={['rgba(15,23,42,0.4)', 'rgba(15,23,42,0.7)', 'rgba(15,23,42,0.95)']}
          style={styles.gradientOverlay}
          pointerEvents="none"
        />

        {/* Shine Effect Overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.1)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.shineOverlay}
          pointerEvents="none"
        />

        {/* Loading Overlay */}
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#0EA5E9" />
            <Text style={styles.loadingText}>Video yükleniyor...</Text>
          </View>
        )}

        {/* Controls Overlay */}
        {showControls && !isLoading && (
          <View style={styles.controlsOverlay}>
            <Pressable
              style={styles.controlButton}
              onPress={handlePlayPause}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <LinearGradient
                colors={['rgba(6,182,212,0.9)', 'rgba(124,58,237,0.9)']}
                style={styles.controlButtonCircle}
              >
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={24}
                  color="#ffffff"
                />
              </LinearGradient>
            </Pressable>

            <Pressable
              style={styles.controlButton}
              onPress={handleMuteToggle}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <View style={styles.controlButtonCircle}>
                <Ionicons
                  name={isMuted ? 'volume-mute' : 'volume-high'}
                  size={20}
                  color="#ffffff"
                />
              </View>
            </Pressable>
          </View>
        )}

        {/* Custom Overlay Content */}
        {showOverlay && overlayContent && (
          <FadeInView style={styles.overlay}>
            {overlayContent}
          </FadeInView>
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    borderRadius: 0,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  videoContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
  },
  shineOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 6,
    opacity: 0.3,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    fontFamily: 'Poppins-SemiBold',
  },
  controlsOverlay: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    flexDirection: 'row',
    gap: 12,
    zIndex: 20,
  },
  controlButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 15,
    pointerEvents: 'box-none',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  errorGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorGradientBackground: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  errorContent: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  errorIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(6, 182, 212, 0.3)',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
    fontFamily: 'Poppins-Bold',
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    fontFamily: 'Poppins-Regular',
    marginBottom: 24,
  },
  errorOverlayContent: {
    width: '100%',
    marginTop: 24,
  },
});

export default VideoBanner;

