import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

interface ChatInputProps {
    onSend: (message: string) => void;
    disabled?: boolean;
}

export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
    const [message, setMessage] = useState('');

    const handleSend = () => {
        const trimmed = message.trim();
        if (!trimmed || disabled) return;

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onSend(trimmed);
        setMessage('');
    };

    return (
        <View style={styles.container}>
            <View style={styles.inputWrapper}>
                <TextInput
                    style={styles.input}
                    placeholder="Mesaj yazın..."
                    placeholderTextColor="#64748b"
                    value={message}
                    onChangeText={setMessage}
                    multiline
                    maxLength={500}
                    editable={!disabled}
                    returnKeyType="send"
                    onSubmitEditing={handleSend}
                />
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
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderTopWidth: 1,
        borderTopColor: 'rgba(99, 102, 241, 0.2)',
        gap: 10,
    },
    inputWrapper: {
        flex: 1,
        backgroundColor: 'rgba(30, 41, 59, 0.8)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.2)',
        paddingHorizontal: 16,
        paddingVertical: 10,
        maxHeight: 100,
    },
    input: {
        fontSize: 15,
        color: '#fff',
        fontFamily: 'Poppins-Regular',
        minHeight: 24,
    },
    sendButton: {
        borderRadius: 22,
        overflow: 'hidden',
    },
    sendButtonGradient: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
    },
});
