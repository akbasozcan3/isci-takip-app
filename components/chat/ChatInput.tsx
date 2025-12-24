import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState, useRef, useEffect } from 'react';
import { Pressable, StyleSheet, TextInput, View, Platform, Keyboard, Text } from 'react-native';

interface ChatInputProps {
    onSend: (message: string) => void;
    disabled?: boolean;
    onTyping?: (text: string) => void;
    autoFocus?: boolean;
}

export function ChatInput({ onSend, disabled = false, onTyping, autoFocus = false }: ChatInputProps) {
    const [message, setMessage] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<TextInput>(null);

    useEffect(() => {
        if (autoFocus && Platform.OS === 'ios') {
            // Delay auto-focus on iOS for better UX
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

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onSend(trimmed);
        setMessage('');

        // Keep keyboard open after sending
        if (Platform.OS === 'ios') {
            inputRef.current?.focus();
        }
    };

    const handleFocus = () => {
        setIsFocused(true);
    };

    const handleBlur = () => {
        setIsFocused(false);
    };

    const charCount = message.length;
    const maxChars = 500;
    const showCounter = charCount > maxChars * 0.8; // Show when 80% full

    return (
        <View style={styles.container}>
            <View style={[
                styles.inputWrapper,
                isFocused && styles.inputWrapperFocused
            ]}>
                <TextInput
                    ref={inputRef}
                    style={styles.input}
                    placeholder="Mesaj yazın..."
                    placeholderTextColor="#64748b"
                    value={message}
                    onChangeText={handleChangeText}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    multiline
                    maxLength={maxChars}
                    returnKeyType="send"
                    blurOnSubmit={false}
                    onSubmitEditing={handleSend}
                    textAlignVertical="center"
                />
                {showCounter && (
                    <Text style={[
                        styles.charCounter,
                        charCount >= maxChars && styles.charCounterMax
                    ]}>
                        {charCount}/{maxChars}
                    </Text>
                )}
            </View>

            <Pressable
                onPress={handleSend}
                disabled={!message.trim() || disabled}
                style={({ pressed }) => [
                    styles.sendButton,
                    pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] },
                ]}
            >
                <LinearGradient
                    colors={message.trim() && !disabled ? ['#6366f1', '#8b5cf6'] : ['#475569', '#64748b']}
                    style={styles.sendButtonGradient}
                >
                    <Ionicons name="send" size={20} color="#fff" />
                </LinearGradient>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 16,
        paddingVertical: 12,
        paddingBottom: Platform.OS === 'ios' ? 12 : 16,
        backgroundColor: 'rgba(15, 23, 42, 0.98)',
        borderTopWidth: 1,
        borderTopColor: 'rgba(99, 102, 241, 0.2)',
        gap: 10,
    },
    inputWrapper: {
        flex: 1,
        backgroundColor: 'rgba(30, 41, 59, 0.8)',
        borderRadius: 24,
        borderWidth: 1.5,
        borderColor: 'rgba(99, 102, 241, 0.2)',
        paddingHorizontal: 16,
        paddingVertical: 12,
        maxHeight: 120,
        minHeight: 48,
        justifyContent: 'center',
        transition: 'all 0.2s ease',
    },
    inputWrapperFocused: {
        borderColor: 'rgba(99, 102, 241, 0.5)',
        backgroundColor: 'rgba(30, 41, 59, 0.95)',
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    input: {
        fontSize: 15,
        color: '#fff',
        fontFamily: 'Poppins-Regular',
        minHeight: 24,
        paddingTop: Platform.OS === 'ios' ? 0 : 2,
        paddingBottom: 0,
    },
    charCounter: {
        position: 'absolute',
        bottom: 4,
        right: 12,
        fontSize: 10,
        color: '#64748b',
        fontFamily: 'Poppins-Medium',
    },
    charCounterMax: {
        color: '#ef4444',
    },
    sendButton: {
        borderRadius: 24,
        overflow: 'hidden',
    },
    sendButtonGradient: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 6,
    },
});
