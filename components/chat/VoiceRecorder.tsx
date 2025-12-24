import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState, useRef, useEffect } from 'react';
import { Pressable, StyleSheet, View, Text, Animated, Platform } from 'react-native';

interface VoiceRecorderProps {
    onSend: (audioUri: string, duration: number) => void;
    onCancel?: () => void;
}

export function VoiceRecorder({ onSend, onCancel }: VoiceRecorderProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const recordingRef = useRef<Audio.Recording | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const slideX = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        return () => {
            stopRecording();
        };
    }, []);

    useEffect(() => {
        if (isRecording) {
            // Pulse animation
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.2,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [isRecording]);

    const startRecording = async () => {
        try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

            const permission = await Audio.requestPermissionsAsync();
            if (!permission.granted) {
                console.log('[VoiceRecorder] Permission denied');
                return;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            recordingRef.current = recording;
            setIsRecording(true);
            setRecordingDuration(0);

            // Start timer
            timerRef.current = setInterval(() => {
                setRecordingDuration((prev) => prev + 1);
            }, 1000);

            console.log('[VoiceRecorder] Recording started');
        } catch (error) {
            console.error('[VoiceRecorder] Failed to start recording:', error);
        }
    };

    const stopRecording = async () => {
        if (!recordingRef.current) return;

        try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }

            await recordingRef.current.stopAndUnloadAsync();
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
            });

            const uri = recordingRef.current.getURI();
            const duration = recordingDuration;

            recordingRef.current = null;
            setIsRecording(false);

            if (uri && duration > 0) {
                onSend(uri, duration);
            }

            console.log('[VoiceRecorder] Recording stopped:', uri, duration);
        } catch (error) {
            console.error('[VoiceRecorder] Failed to stop recording:', error);
        }
    };

    const cancelRecording = async () => {
        if (!recordingRef.current) return;

        try {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }

            await recordingRef.current.stopAndUnloadAsync();
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
            });

            recordingRef.current = null;
            setIsRecording(false);
            setRecordingDuration(0);

            onCancel?.();
            console.log('[VoiceRecorder] Recording cancelled');
        } catch (error) {
            console.error('[VoiceRecorder] Failed to cancel recording:', error);
        }
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (!isRecording) {
        return (
            <Pressable
                onLongPress={startRecording}
                onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
                style={styles.micButton}
            >
                <Ionicons name="mic-outline" size={24} color="#94a3b8" />
            </Pressable>
        );
    }

    return (
        <View style={styles.recordingContainer}>
            <LinearGradient
                colors={['rgba(239, 68, 68, 0.15)', 'rgba(239, 68, 68, 0.05)']}
                style={styles.recordingGradient}
            >
                {/* Slide to cancel */}
                <View style={styles.slideToCancel}>
                    <Ionicons name="chevron-back" size={16} color="#ef4444" />
                    <Text style={styles.slideToCancelText}>Kaydırmak için iptal et</Text>
                </View>

                {/* Recording indicator */}
                <View style={styles.recordingInfo}>
                    <Animated.View
                        style={[
                            styles.recordingDot,
                            {
                                transform: [{ scale: pulseAnim }],
                            },
                        ]}
                    />
                    <Text style={styles.recordingTime}>{formatDuration(recordingDuration)}</Text>
                </View>

                {/* Waveform visualization (simplified) */}
                <View style={styles.waveform}>
                    {[...Array(20)].map((_, i) => (
                        <Animated.View
                            key={i}
                            style={[
                                styles.waveBar,
                                {
                                    height: Math.random() * 20 + 10,
                                    opacity: 0.3 + Math.random() * 0.7,
                                },
                            ]}
                        />
                    ))}
                </View>

                {/* Send button */}
                <Pressable
                    onPress={stopRecording}
                    style={({ pressed }) => [
                        styles.sendVoiceButton,
                        pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] },
                    ]}
                >
                    <LinearGradient
                        colors={['#10b981', '#059669']}
                        style={styles.sendVoiceGradient}
                    >
                        <Ionicons name="send" size={20} color="#fff" />
                    </LinearGradient>
                </Pressable>

                {/* Cancel button */}
                <Pressable
                    onPress={cancelRecording}
                    style={({ pressed }) => [
                        styles.cancelButton,
                        pressed && { opacity: 0.8 },
                    ]}
                >
                    <Ionicons name="close-circle" size={32} color="#ef4444" />
                </Pressable>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    micButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    recordingContainer: {
        flex: 1,
        height: 80,
    },
    recordingGradient: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        gap: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(239, 68, 68, 0.2)',
    },
    slideToCancel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        position: 'absolute',
        left: 16,
        top: 12,
    },
    slideToCancelText: {
        fontSize: 11,
        color: '#ef4444',
        fontFamily: 'Poppins-Medium',
    },
    recordingInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    recordingDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#ef4444',
    },
    recordingTime: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
        fontFamily: 'Poppins-Bold',
        minWidth: 50,
    },
    waveform: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        height: 40,
    },
    waveBar: {
        width: 3,
        backgroundColor: '#ef4444',
        borderRadius: 2,
    },
    sendVoiceButton: {
        borderRadius: 24,
        overflow: 'hidden',
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    sendVoiceGradient: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButton: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
