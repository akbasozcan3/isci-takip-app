import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import React, { useRef } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View, Pressable, Alert } from 'react-native';

interface MessageBubbleProps {
    message: {
        id: string;
        senderId: string;
        senderName: string;
        senderAvatar?: string;
        messageText: string;
        createdAt: string;
        isOwn: boolean;
        deleted?: boolean;
        read?: boolean;
        readBy?: string[];
        status?: 'pending' | 'sent' | 'delivered' | 'read';
    };
    onDelete?: (messageId: string, deleteForEveryone: boolean) => void;
    totalMembers?: number;
}

export function MessageBubble({ message, onDelete, totalMembers = 0 }: MessageBubbleProps) {
    const isOwn = message.isOwn;
    const translateX = useRef(new Animated.Value(0)).current;
    const [showDeleteMenu, setShowDeleteMenu] = React.useState(false);

    const handleLongPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        Alert.alert(
            'Mesajı Sil',
            'Bu mesajı nasıl silmek istersiniz?',
            [
                {
                    text: 'İptal',
                    style: 'cancel'
                },
                {
                    text: 'Benden Sil',
                    onPress: () => {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        onDelete?.(message.id, false);
                    }
                },
                ...(isOwn ? [{
                    text: 'Herkesten Sil',
                    style: 'destructive' as const,
                    onPress: () => {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                        onDelete?.(message.id, true);
                    }
                }] : [])
            ],
            { cancelable: true }
        );
    };

    const timestamp = new Date(message.createdAt).toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
    });

    // Determine read receipt icon and color based on status
    const getReadReceiptIcon = () => {
        if (!isOwn) return null;

        // Use status field if available
        if (message.status) {
            switch (message.status) {
                case 'pending':
                    return {
                        name: 'time-outline' as const,
                        color: 'rgba(255,255,255,0.5)',
                    };
                case 'sent':
                    return {
                        name: 'checkmark' as const,
                        color: 'rgba(255,255,255,0.6)',
                    };
                case 'delivered':
                    return {
                        name: 'checkmark-done' as const,
                        color: 'rgba(255,255,255,0.6)',
                    };
                case 'read':
                    return {
                        name: 'checkmark-done' as const,
                        color: '#0EA5E9', // Blue for read
                    };
            }
        }

        // Fallback to old logic for backward compatibility
        const readByCount = message.readBy?.length || 0;
        const isRead = message.read || readByCount > 0;
        const isReadByAll = totalMembers > 0 && readByCount >= totalMembers - 1;

        if (isReadByAll || isRead) {
            return {
                name: 'checkmark-done' as const,
                color: '#0EA5E9',
            };
        } else if (readByCount > 0) {
            return {
                name: 'checkmark-done' as const,
                color: 'rgba(255,255,255,0.6)',
            };
        } else {
            return {
                name: 'checkmark' as const,
                color: 'rgba(255,255,255,0.6)',
            };
        }
    };

    const readReceipt = getReadReceiptIcon();

    // Swipe to delete gesture (only for own messages)
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => isOwn,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return isOwn && Math.abs(gestureState.dx) > 5;
            },
            onPanResponderMove: (_, gestureState) => {
                if (isOwn && gestureState.dx < 0) {
                    translateX.setValue(Math.max(gestureState.dx, -80));
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dx < -60) {
                    // Swipe threshold reached - show delete confirmation
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    confirmDelete();
                }
                // Snap back
                Animated.spring(translateX, {
                    toValue: 0,
                    useNativeDriver: true,
                    tension: 100,
                    friction: 8,
                }).start();
            },
        })
    ).current;

    const confirmDelete = () => {
        Alert.alert(
            'Mesajı Sil',
            'Bu mesajı silmek istediğinizden emin misiniz?',
            [
                {
                    text: 'İptal',
                    style: 'cancel',
                },
                {
                    text: 'Sil',
                    style: 'destructive',
                    onPress: () => {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        onDelete?.(message.id);
                    },
                },
            ]
        );
    };

    if (message.deleted) {
        return (
            <View style={[styles.container, isOwn ? styles.ownContainer : styles.otherContainer]}>
                <View style={styles.deletedBubble}>
                    <Ionicons name="trash-outline" size={14} color="#64748b" />
                    <Text style={styles.deletedText}>Mesaj silindi</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, isOwn ? styles.ownContainer : styles.otherContainer]}>
            <Pressable onLongPress={handleLongPress} delayLongPress={500}>
                <Animated.View
                    style={[
                        styles.bubbleWrapper,
                        isOwn && { transform: [{ translateX }] },
                    ]}
                    {...(isOwn ? panResponder.panHandlers : {})}
                >
                    {isOwn ? (
                        <LinearGradient
                            colors={['#6366f1', '#8b5cf6']}
                            style={styles.ownBubble}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        >
                            <Text style={styles.ownMessageText}>{message.messageText}</Text>
                            <View style={styles.ownTimestampRow}>
                                <Text style={styles.ownTimestamp}>{timestamp}</Text>
                                {readReceipt && (
                                    <Ionicons
                                        name={readReceipt.name}
                                        size={14}
                                        color={readReceipt.color}
                                        style={{ marginLeft: 4 }}
                                    />
                                )}
                            </View>
                        </LinearGradient>
                    ) : (
                        <View style={styles.otherBubble}>
                            <Text style={styles.senderName}>{message.senderName}</Text>
                            <Text style={styles.otherMessageText}>{message.messageText}</Text>
                            <Text style={styles.otherTimestamp}>{timestamp}</Text>
                        </View>
                    )}
                </Animated.View>
            </Pressable>

            {/* Delete button (shown when swiping) */}
            {
                isOwn && (
                    <Animated.View
                        style={[
                            styles.deleteButton,
                            {
                                opacity: translateX.interpolate({
                                    inputRange: [-80, -40, 0],
                                    outputRange: [1, 0.5, 0],
                                    extrapolate: 'clamp',
                                }),
                            },
                        ]}
                    >
                        <Ionicons name="trash" size={20} color="#ef4444" />
                    </Animated.View>
                )
            }
        </View >
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        marginVertical: 4,
        paddingHorizontal: 16,
        position: 'relative',
    },
    ownContainer: {
        justifyContent: 'flex-end',
    },
    otherContainer: {
        justifyContent: 'flex-start',
    },
    bubbleWrapper: {
        maxWidth: '75%',
    },
    ownBubble: {
        borderRadius: 18,
        borderBottomRightRadius: 4,
        paddingHorizontal: 14,
        paddingVertical: 10,
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 3,
    },
    otherBubble: {
        backgroundColor: 'rgba(30, 41, 59, 0.8)',
        borderRadius: 18,
        borderBottomLeftRadius: 4,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.15)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
    },
    senderName: {
        fontSize: 13,
        fontWeight: '700',
        color: '#6366f1',
        marginBottom: 4,
        fontFamily: 'Poppins-Bold',
    },
    ownMessageText: {
        fontSize: 15,
        color: '#fff',
        lineHeight: 21,
        fontFamily: 'Poppins-Regular',
        marginBottom: 4,
    },
    otherMessageText: {
        fontSize: 15,
        color: '#e2e8f0',
        lineHeight: 21,
        fontFamily: 'Poppins-Regular',
        marginBottom: 4,
    },
    ownTimestampRow: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-end',
    },
    ownTimestamp: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.7)',
        fontFamily: 'Poppins-Medium',
    },
    otherTimestamp: {
        fontSize: 11,
        color: '#94a3b8',
        alignSelf: 'flex-end',
        fontFamily: 'Poppins-Medium',
    },
    deleteButton: {
        position: 'absolute',
        right: 16,
        top: '50%',
        marginTop: -20,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    deletedBubble: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(30, 41, 59, 0.4)',
        borderRadius: 18,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: 'rgba(100, 116, 139, 0.2)',
        borderStyle: 'dashed',
    },
    deletedText: {
        fontSize: 13,
        color: '#64748b',
        fontStyle: 'italic',
        fontFamily: 'Poppins-Regular',
    },
});
