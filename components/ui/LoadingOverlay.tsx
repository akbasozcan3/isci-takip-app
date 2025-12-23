/**
 * LoadingOverlay Component
 * Global loading overlay with optional message
 */

import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

interface LoadingOverlayProps {
    visible: boolean;
    message?: string;
    transparent?: boolean;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
    visible,
    message,
    transparent = false
}) => {
    if (!visible) return null;

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={styles.overlay}>
                <Animated.View
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(200)}
                    style={styles.container}
                >
                    <LinearGradient
                        colors={['#1e293b', '#0f172a']}
                        style={styles.gradient}
                    >
                        <ActivityIndicator size="large" color="#0EA5E9" />
                        {message && <Text style={styles.message}>{message}</Text>}
                    </LinearGradient>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    container: {
        borderRadius: 16,
        overflow: 'hidden',
        minWidth: 120,
        minHeight: 120
    },
    gradient: {
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16
    },
    message: {
        color: '#fff',
        fontSize: 14,
        fontFamily: 'Poppins-Medium',
        textAlign: 'center',
        marginTop: 8
    }
});
