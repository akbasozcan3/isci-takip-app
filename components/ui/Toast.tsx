/**
 * Toast Notification System
 * Global toast notifications with queue management
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
    FadeInUp,
    FadeOutUp,
    Layout
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
}

interface ToastContextValue {
    showSuccess: (message: string, duration?: number) => void;
    showError: (message: string, duration?: number) => void;
    showWarning: (message: string, duration?: number) => void;
    showInfo: (message: string, duration?: number) => void;
    hideToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((type: ToastType, message: string, duration = 3000) => {
        const id = Date.now().toString();
        const toast: Toast = { id, type, message, duration };

        setToasts(prev => [...prev, toast]);

        // Haptic feedback
        if (type === 'success') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (type === 'error') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } else {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }

        // Auto dismiss
        if (duration > 0) {
            setTimeout(() => {
                hideToast(id);
            }, duration);
        }
    }, []);

    const hideToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    const value: ToastContextValue = {
        showSuccess: (message, duration) => showToast('success', message, duration),
        showError: (message, duration) => showToast('error', message, duration),
        showWarning: (message, duration) => showToast('warning', message, duration),
        showInfo: (message, duration) => showToast('info', message, duration),
        hideToast
    };

    return (
        <ToastContext.Provider value={value}>
            {children}
            <View style={styles.container} pointerEvents="box-none">
                {toasts.map(toast => (
                    <ToastItem
                        key={toast.id}
                        toast={toast}
                        onDismiss={() => hideToast(toast.id)}
                    />
                ))}
            </View>
        </ToastContext.Provider>
    );
};

interface ToastItemProps {
    toast: Toast;
    onDismiss: () => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
    const config = {
        success: {
            icon: 'checkmark-circle' as const,
            color: '#10b981',
            bgColor: 'rgba(16, 185, 129, 0.15)',
            borderColor: 'rgba(16, 185, 129, 0.3)'
        },
        error: {
            icon: 'close-circle' as const,
            color: '#ef4444',
            bgColor: 'rgba(239, 68, 68, 0.15)',
            borderColor: 'rgba(239, 68, 68, 0.3)'
        },
        warning: {
            icon: 'warning' as const,
            color: '#f59e0b',
            bgColor: 'rgba(245, 158, 11, 0.15)',
            borderColor: 'rgba(245, 158, 11, 0.3)'
        },
        info: {
            icon: 'information-circle' as const,
            color: '#0EA5E9',
            bgColor: 'rgba(14, 165, 233, 0.15)',
            borderColor: 'rgba(14, 165, 233, 0.3)'
        }
    }[toast.type];

    return (
        <Animated.View
            entering={FadeInUp.springify()}
            exiting={FadeOutUp}
            layout={Layout.springify()}
            style={[
                styles.toast,
                {
                    backgroundColor: config.bgColor,
                    borderColor: config.borderColor
                }
            ]}
        >
            <Ionicons name={config.icon} size={20} color={config.color} />
            <Text style={styles.message}>{toast.message}</Text>
            <Pressable onPress={onDismiss} hitSlop={8}>
                <Ionicons name="close" size={18} color="#94a3b8" />
            </Pressable>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 60,
        left: 16,
        right: 16,
        zIndex: 9999,
        gap: 8
    },
    toast: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8
    },
    message: {
        flex: 1,
        color: '#fff',
        fontSize: 14,
        fontFamily: 'Poppins-Medium',
        lineHeight: 20
    }
});
