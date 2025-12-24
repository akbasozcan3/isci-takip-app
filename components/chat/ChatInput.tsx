import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState, useRef, useEffect } from 'react';
import { Pressable, StyleSheet, TextInput, View, Platform, Keyboard, Text } from 'react-native';
import { VoiceRecorder } from './VoiceRecorder';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
    FadeIn,
    FadeOut,
    ZoomIn,
    ZoomOut
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ChatInputProps {
    onSend: (message: string) => void;
    disabled?: boolean;
    onTyping?: (text: string) => void;
    autoFocus?: boolean;
    onVoiceRecord?: () => void;
    onVoiceSend?: (audioUri: string, duration: number) => void;
}

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

export function ChatInput({ onSend, disabled = false, onTyping, autoFocus = false, onVoiceRecord, onVoiceSend }: ChatInputProps) {
    const insets = useSafeAreaInsets();
    const [message, setMessage] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const inputRef = useRef<TextInput>(null);

    // Reanimated values
    const focusedScale = useSharedValue(1);

    useEffect(() => {
        if (autoFocus && Platform.OS === 'ios') {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 500);
        }
    }, [autoFocus]);

    const handleChangeText = (text: string) => {
        setMessage(text);
        onTyping?.(text);
    };

    const handleSend = () => {
        const trimmed = message.trim();
        if (!trimmed || disabled) return;

        // Additional validation
        if (trimmed.length < 1) {
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onSend(trimmed);
        setMessage('');

        if (Platform.OS === 'ios') {
            inputRef.current?.focus();
        }
    };

    const handleFocus = () => {
        setIsFocused(true);
        focusedScale.value = withSpring(1.02);
    };

    const handleBlur = () => {
        setIsFocused(false);
        focusedScale.value = withSpring(1);
    };

    const charCount = message.length;
    const maxChars = 500;
    const showCounter = charCount > maxChars * 0.8;
    const hasText = message.trim().length > 0;

    const inputAnimatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: focusedScale.value }],
            borderColor: withTiming(isFocused ? 'rgba(139, 92, 246, 0.5)' : 'rgba(255, 255, 255, 0.1)'),
            backgroundColor: withTiming(isFocused ? 'rgba(30, 41, 59, 0.95)' : 'rgba(30, 41, 59, 0.7)'),
        };
    });

    return (
        <AnimatedBlurView
            intensity={30}
            tint="dark"
            style={[
                styles.container,
                { paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 12 : 16) + 12 }
            ]}
        >
            <Animated.View style={[styles.inputWrapper, inputAnimatedStyle]}>
                <TextInput
                    ref={inputRef}
                    style={styles.input}
                    placeholder="Mesaj yazın..."
                    placeholderTextColor="rgba(148, 163, 184, 0.8)"
                    value={message}
                    onChangeText={handleChangeText}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    multiline
                    maxLength={maxChars}
                    returnKeyType="default" // Changed from 'send' to support multiline enter
                    blurOnSubmit={false}
                    textAlignVertical="center"
                />

                {showCounter && (
                    <Animated.Text
                        entering={FadeIn}
                        exiting={FadeOut}
                        style={[
                            styles.charCounter,
                            charCount >= maxChars && styles.charCounterMax
                        ]}
                    >
                        {charCount}/{maxChars}
                    </Animated.Text>
                )}
            </Animated.View>

            <AnimateSendButton
                show={hasText && !disabled}
                onPress={handleSend}
                onVoiceSend={onVoiceSend}
            />
        </AnimatedBlurView>
    );
}

function AnimateSendButton({ show, onPress, onVoiceSend }: { show: boolean, onPress: () => void, onVoiceSend?: (uri: string, duration: number) => void }) {
    return (
        <View style={styles.actionButtonContainer}>
            {/* Always render the button structure to maintain layout, but animate presence */}
            {show ? (
                <Animated.View entering={ZoomIn.springify()} exiting={ZoomOut.springify()}>
                    <Pressable
                        onPress={onPress}
                        style={({ pressed }) => [
                            styles.sendButton,
                            pressed && { opacity: 0.9, transform: [{ scale: 0.92 }] },
                        ]}
                    >
                        <LinearGradient
                            colors={['#7c3aed', '#6366f1']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.sendButtonGradient}
                        >
                            <Ionicons name="send" size={20} color="#fff" style={{ marginLeft: 2 }} />
                        </LinearGradient>
                    </Pressable>
                </Animated.View>
            ) : (
                <Animated.View entering={ZoomIn.springify()} exiting={ZoomOut.springify()}>
                    {onVoiceSend ? (
                        <VoiceRecorder
                            onSend={onVoiceSend}
                            onCancel={() => { }}
                        />
                    ) : (
                        <View style={styles.placeholderIcon}>
                            <Ionicons name="mic-outline" size={24} color="#94a3b8" />
                        </View>
                    )}
                </Animated.View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 16,
        paddingVertical: 12,
        // paddingBottom is handled inline for safe area
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.05)',
        gap: 12,
    },
    inputWrapper: {
        flex: 1,
        borderRadius: 24,
        borderWidth: 1,
        paddingHorizontal: 18,
        paddingVertical: 10, // Slightly reduced for cleaner look
        maxHeight: 120,
        minHeight: 48,
        justifyContent: 'center',
    },
    input: {
        fontSize: 16,
        color: '#fff',
        fontFamily: 'Poppins-Regular',
        minHeight: 24,
        paddingTop: 0,
        paddingBottom: 0,
        lineHeight: 22,
    },
    charCounter: {
        position: 'absolute',
        bottom: 8,
        right: 16,
        fontSize: 10,
        color: '#94a3b8',
        fontFamily: 'Poppins-Medium',
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        paddingHorizontal: 4,
        borderRadius: 4,
        overflow: 'hidden',
    },
    charCounterMax: {
        color: '#f87171',
    },
    actionButtonContainer: {
        width: 48,
        height: 48,
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    sendButton: {
        borderRadius: 24,
        overflow: 'hidden',
        shadowColor: '#7c3aed',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    sendButtonGradient: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    placeholderIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    }
});
