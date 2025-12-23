import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

export interface ActivityItem {
    id: string;
    type: 'message' | 'join' | 'leave' | 'create' | 'admin' | 'delete';
    groupId: string;
    groupName: string;
    userName: string;
    message?: string;
    timestamp: string;
}

interface GroupActivityFeedProps {
    activities: ActivityItem[];
    onActivityPress?: (activity: ActivityItem) => void;
}

const getActivityIcon = (type: string): string => {
    switch (type) {
        case 'message': return 'chatbubble';
        case 'join': return 'person-add';
        case 'leave': return 'log-out';
        case 'create': return 'add-circle';
        case 'admin': return 'shield-checkmark';
        case 'delete': return 'trash';
        default: return 'information-circle';
    }
};

const getActivityColor = (type: string): [string, string] => {
    switch (type) {
        case 'message': return ['#8b5cf6', '#7c3aed'];
        case 'join': return ['#10b981', '#059669'];
        case 'leave': return ['#ef4444', '#dc2626'];
        case 'create': return ['#0EA5E9', '#0891b2'];
        case 'admin': return ['#f59e0b', '#d97706'];
        case 'delete': return ['#dc2626', '#b91c1c'];
        default: return ['#6366f1', '#4f46e5'];
    }
};

const getActivityText = (activity: ActivityItem): string => {
    switch (activity.type) {
        case 'message':
            return activity.message
                ? `${activity.message.substring(0, 40)}${activity.message.length > 40 ? '...' : ''}`
                : 'Yeni mesaj gönderdi';
        case 'join':
            return 'Gruba katıldı';
        case 'leave':
            return 'Gruptan ayrıldı';
        case 'create':
            return 'Grup oluşturdu';
        case 'admin':
            return 'Admin oldu';
        case 'delete':
            return 'Grup silindi';
        default:
            return 'Aktivite gerçekleşti';
    }
};

const formatTimeAgo = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Şimdi';
    if (minutes < 60) return `${minutes}dk`;
    if (hours < 24) return `${hours}sa`;
    if (days < 7) return `${days}g`;
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
};

export function GroupActivityFeed({ activities, onActivityPress }: GroupActivityFeedProps) {
    const scaleAnims = React.useRef<{ [key: string]: Animated.Value }>({}).current;

    const getScaleAnim = (id: string) => {
        if (!scaleAnims[id]) {
            scaleAnims[id] = new Animated.Value(0);
            Animated.spring(scaleAnims[id], {
                toValue: 1,
                friction: 8,
                tension: 40,
                useNativeDriver: true,
            }).start();
        }
        return scaleAnims[id];
    };

    if (activities.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <Ionicons name="time-outline" size={48} color="#64748b" />
                <Text style={styles.emptyText}>Henüz aktivite yok</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Ionicons name="time" size={20} color="#8b5cf6" />
                <Text style={styles.headerTitle}>Son Aktiviteler</Text>
            </View>

            {activities.slice(0, 5).map((activity) => {
                const colors = getActivityColor(activity.type);
                const scale = getScaleAnim(activity.id);

                return (
                    <Animated.View
                        key={activity.id}
                        style={[styles.activityItem, { transform: [{ scale }] }]}
                    >
                        <Pressable
                            onPress={() => {
                                if (onActivityPress) {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    onActivityPress(activity);
                                }
                            }}
                            style={({ pressed }) => [
                                styles.activityContent,
                                pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }
                            ]}
                        >
                            <LinearGradient
                                colors={colors}
                                style={styles.iconWrapper}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <Ionicons name={getActivityIcon(activity.type) as any} size={24} color="#fff" />
                            </LinearGradient>

                            <View style={styles.activityDetails}>
                                <View style={styles.activityHeader}>
                                    <Text style={styles.groupName} numberOfLines={1}>
                                        {activity.groupName}
                                    </Text>
                                    <Text style={styles.timestamp}>
                                        {formatTimeAgo(activity.timestamp)}
                                    </Text>
                                </View>

                                <Text style={styles.userName} numberOfLines={1}>
                                    {activity.userName}
                                </Text>

                                <Text style={styles.activityText} numberOfLines={2}>
                                    {getActivityText(activity)}
                                </Text>
                            </View>
                        </Pressable>
                    </Animated.View>
                );
            })}

            {activities.length > 5 && (
                <Text style={styles.moreText}>+{activities.length - 5} daha fazla aktivite</Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 24,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#fff',
        fontFamily: 'Poppins-Bold',
    },
    activityItem: {
        marginBottom: 12,
    },
    activityContent: {
        flexDirection: 'row',
        backgroundColor: 'rgba(30, 41, 59, 0.6)',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.15)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    iconWrapper: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    activityDetails: {
        flex: 1,
    },
    activityHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 4,
    },
    groupName: {
        fontSize: 15,
        fontWeight: '900',
        color: '#fff',
        flex: 1,
        marginRight: 8,
        fontFamily: 'Poppins-Bold',
    },
    timestamp: {
        fontSize: 11,
        color: '#64748b',
        fontFamily: 'Poppins-Medium',
    },
    userName: {
        fontSize: 13,
        fontWeight: '600',
        color: '#8b5cf6',
        marginBottom: 4,
        fontFamily: 'Poppins-SemiBold',
    },
    activityText: {
        fontSize: 13,
        color: '#94a3b8',
        lineHeight: 18,
        fontFamily: 'Poppins-Regular',
    },
    moreText: {
        fontSize: 13,
        color: '#64748b',
        textAlign: 'center',
        marginTop: 12,
        fontStyle: 'italic',
        fontFamily: 'Poppins-Regular',
    },
    emptyContainer: {
        alignItems: 'center',
        padding: 32,
        backgroundColor: 'rgba(30, 41, 59, 0.4)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(100, 116, 139, 0.2)',
    },
    emptyText: {
        fontSize: 14,
        color: '#64748b',
        marginTop: 12,
        fontFamily: 'Poppins-Regular',
    },
});
