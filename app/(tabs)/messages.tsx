import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useProfile } from '../../contexts/ProfileContext';
import { UnifiedHeader } from '../../components/UnifiedHeader';
import { authFetch } from '../../utils/auth';
import { initializeSocket, getSocket } from '../../utils/socketService';
import { useNetworkStatus } from '../../utils/networkStatus';

interface Group {
    id: string;
    code: string;
    name: string;
    address: string;
    memberCount: number;
}

interface Message {
    id: string;
    senderId: string;
    senderName: string;
    messageText: string;
    createdAt: string;
}

interface ConversationItem {
    group: Group;
    lastMessage?: Message;
    unreadCount: number;
}

const SkeletonConversation = () => (
    <View style={styles.conversationCard}>
        <View style={styles.skeletonAvatar} />
        <View style={{ flex: 1 }}>
            <View style={[styles.skeletonLine, { width: '60%', marginBottom: 8 }]} />
            <View style={[styles.skeletonLine, { width: '80%' }]} />
        </View>
    </View>
);

export default function MessagesScreen() {
    const router = useRouter();
    const { userName } = useProfile();
    const [conversations, setConversations] = React.useState<ConversationItem[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [userId, setUserId] = React.useState('');
    const [socketConnected, setSocketConnected] = React.useState(false);
    const networkState = useNetworkStatus();

    // Combined connection status
    const isFullyConnected = networkState.isConnected && networkState.isInternetReachable && socketConnected;
    const connectionStatus = !networkState.isConnected
        ? '📡 İnternet bağlantısı yok'
        : !networkState.isInternetReachable
            ? '🌐 İnternet erişilemiyor'
            : !socketConnected
                ? '🔌 Sunucuya bağlanıyor...'
                : '✅ Bağlı';

    React.useEffect(() => {
        const loadUserId = async () => {
            try {
                const stored = await SecureStore.getItemAsync('workerId');
                if (stored) setUserId(stored);
            } catch (error) {
                console.error('[Messages] Error loading userId:', error);
            }
        };
        loadUserId();
    }, []);

    const loadConversations = React.useCallback(async (silent = false) => {
        if (!userId) {
            setLoading(false);
            return;
        }

        if (!silent) setLoading(true);

        try {
            // Fetch all groups user is part of
            const groupsRes = await authFetch(`/groups/user/${userId}`);

            if (!groupsRes.ok) {
                if (groupsRes.status === 404) {
                    console.log('[Messages] Groups endpoint not implemented');
                    setConversations([]);
                    setLoading(false);
                    return;
                }
                throw new Error('Failed to load groups');
            }

            const groupsData = await groupsRes.json();
            const groups: Group[] = Array.isArray(groupsData) ? groupsData : (groupsData.data || groupsData.groups || []);

            // For each group, fetch last message and unread count
            const conversationPromises = groups.map(async (group) => {
                try {
                    // Fetch last message (sort=desc to get newest)
                    const messagesRes = await authFetch(`/groups/${group.id}/messages?limit=1&sort=desc`);
                    let lastMessage = undefined;

                    if (messagesRes.ok) {
                        const messagesData = await messagesRes.json();
                        const messages = messagesData.messages || [];
                        lastMessage = messages[0];
                    }

                    // Fetch unread count
                    let unreadCount = 0;
                    try {
                        const unreadRes = await authFetch(`/groups/${group.id}/unread-count`);
                        if (unreadRes.ok) {
                            const unreadData = await unreadRes.json();
                            unreadCount = unreadData.unreadCount || unreadData.count || 0;
                        }
                    } catch (unreadErr) {
                        console.warn('[Messages] Failed to load unread count for group:', group.id);
                    }

                    return {
                        group,
                        lastMessage,
                        unreadCount,
                    };
                } catch (err) {
                    console.warn('[Messages] Failed to load messages for group:', group.id);
                }

                return {
                    group,
                    lastMessage: undefined,
                    unreadCount: 0,
                };
            });

            const conversationsData = await Promise.all(conversationPromises);

            // Sort by last message time (newest first)
            conversationsData.sort((a, b) => {
                if (!a.lastMessage) return 1;
                if (!b.lastMessage) return -1;
                return new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime();
            });

            setConversations(conversationsData);
        } catch (error: any) {
            console.error('[Messages] Load error:', error);
            setConversations([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [userId]);

    React.useEffect(() => {
        if (userId) {
            loadConversations();
        }
    }, [userId]);

    // Initialize Socket.IO for real-time updates
    React.useEffect(() => {
        if (!userId) return;

        const setupSocket = async () => {
            try {
                const socket = await initializeSocket();
                if (socket) {
                    setSocketConnected(socket.connected);

                    // Listen for new messages in any group
                    socket.on('new_message', (data: any) => {
                        console.log('[Messages] New message received:', data);
                        // Update last message for the group
                        setConversations((prev) => {
                            return prev.map((conv) => {
                                if (conv.group.id === data.groupId) {
                                    return {
                                        ...conv,
                                        lastMessage: {
                                            id: data.id,
                                            senderId: data.senderId,
                                            senderName: data.sender?.name || data.senderName || 'Unknown',
                                            messageText: data.message || data.messageText,
                                            createdAt: new Date(data.createdAt).toISOString(),
                                        },
                                        unreadCount: data.senderId !== userId ? conv.unreadCount + 1 : conv.unreadCount,
                                    };
                                }
                                return conv;
                            }).sort((a, b) => {
                                // Sort by last message time
                                if (!a.lastMessage) return 1;
                                if (!b.lastMessage) return -1;
                                return new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime();
                            });
                        });
                    });

                    socket.on('connect', () => {
                        setSocketConnected(true);
                        console.log('[Messages] Socket connected');
                    });

                    socket.on('disconnect', () => {
                        setSocketConnected(false);
                        console.log('[Messages] Socket disconnected');
                    });
                }
            } catch (error) {
                console.error('[Messages] Socket setup error:', error);
            }
        };

        setupSocket();

        return () => {
            const socket = getSocket();
            if (socket) {
                socket.off('new_message');
                socket.off('connect');
                socket.off('disconnect');
            }
        };
    }, [userId]);

    // Reload on focus
    useFocusEffect(
        React.useCallback(() => {
            if (userId) {
                loadConversations(true);
            }
        }, [userId])
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadConversations(true);
    };

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (hours < 1) return 'Şimdi';
        if (hours < 24) return `${hours}sa`;
        if (days < 7) return `${days}g`;
        return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />

            <UnifiedHeader
                title="Mesajlar"
                subtitle="Grup sohbetleriniz"
                gradientColors={['#8b5cf6', '#7c3aed']}
                brandLabel="MESAJLAR"
                profileName={userName}
                showProfile={true}
                showNetwork={true}
            />

            <ScrollView
                style={styles.content}
                contentContainerStyle={{ paddingBottom: 20 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {loading ? (
                    <>
                        <SkeletonConversation />
                        <SkeletonConversation />
                        <SkeletonConversation />
                    </>
                ) : conversations.length === 0 ? (
                    <View style={styles.emptyState}>
                        <LinearGradient
                            colors={['rgba(139, 92, 246, 0.2)', 'rgba(139, 92, 246, 0.05)']}
                            style={styles.iconWrapper}
                        >
                            <Ionicons name="chatbubbles" size={64} color="#8b5cf6" />
                        </LinearGradient>
                        <Text style={styles.emptyTitle}>Henüz Mesaj Yok</Text>
                        <Text style={styles.emptySubtitle}>
                            Gruplarınızla mesajlaşmak için{'\n'}
                            bir grubun "Sohbet" butonuna tıklayın
                        </Text>

                        <Pressable
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                router.push('/(tabs)/groups');
                            }}
                            style={({ pressed }) => [
                                styles.button,
                                pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }
                            ]}
                        >
                            <LinearGradient
                                colors={['#8b5cf6', '#7c3aed']}
                                style={styles.buttonGradient}
                            >
                                <Ionicons name="people" size={20} color="#fff" />
                                <Text style={styles.buttonText}>Gruplara Git</Text>
                            </LinearGradient>
                        </Pressable>
                    </View>
                ) : (
                    conversations.map((conv) => (
                        <Pressable
                            key={conv.group.id}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                router.push({
                                    pathname: `/groups/${conv.group.id}/chat`,
                                    params: { id: conv.group.id, name: conv.group.name }
                                });
                            }}
                            style={({ pressed }) => [
                                styles.conversationCard,
                                pressed && { backgroundColor: 'rgba(139, 92, 246, 0.1)', transform: [{ scale: 0.98 }] }
                            ]}
                        >
                            {/* Group Avatar */}
                            <LinearGradient
                                colors={['#8b5cf6', '#7c3aed']}
                                style={styles.avatar}
                            >
                                <Ionicons name="people" size={28} color="#fff" />
                            </LinearGradient>

                            {/* Content */}
                            <View style={styles.conversationContent}>
                                <View style={styles.conversationHeader}>
                                    <Text style={styles.groupName} numberOfLines={1}>
                                        {conv.group.name}
                                    </Text>
                                    {conv.lastMessage && (
                                        <Text style={styles.timestamp}>
                                            {formatTimestamp(conv.lastMessage.createdAt)}
                                        </Text>
                                    )}
                                </View>

                                <View style={styles.conversationFooter}>
                                    {conv.lastMessage ? (
                                        <Text style={[styles.lastMessage, conv.unreadCount > 0 && { fontWeight: '600', color: '#e2e8f0' }]} numberOfLines={1}>
                                            <Text style={styles.senderName}>
                                                {conv.lastMessage.senderId === userId ? 'Sen' : conv.lastMessage.senderName}:
                                            </Text>{' '}
                                            {conv.lastMessage.messageText}
                                        </Text>
                                    ) : (
                                        <Text style={[styles.lastMessage, { fontStyle: 'italic' }]}>
                                            Henüz mesaj yok
                                        </Text>
                                    )}

                                    {conv.unreadCount > 0 && (
                                        <View style={styles.unreadBadge}>
                                            <Text style={styles.unreadText}>
                                                {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                                            </Text>
                                        </View>
                                    )}
                                </View>

                                {/* Group Info */}
                                <View style={styles.groupInfo}>
                                    <Ionicons name="people" size={12} color="#64748b" />
                                    <Text style={styles.memberCount}>{conv.group.memberCount} üye</Text>
                                </View>
                            </View>
                        </Pressable>
                    ))
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    conversationCard: {
        flexDirection: 'row',
        backgroundColor: 'rgba(30, 41, 59, 0.6)',
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.2)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    conversationContent: {
        flex: 1,
        justifyContent: 'space-between',
    },
    conversationHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 6,
    },
    groupName: {
        fontSize: 17,
        fontWeight: '900',
        color: '#fff',
        flex: 1,
        marginRight: 8,
        fontFamily: 'Poppins-Bold',
    },
    timestamp: {
        fontSize: 12,
        color: '#64748b',
        fontFamily: 'Poppins-Medium',
    },
    conversationFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    lastMessage: {
        fontSize: 14,
        color: '#94a3b8',
        flex: 1,
        marginRight: 8,
        fontFamily: 'Poppins-Regular',
    },
    senderName: {
        fontWeight: '600',
        color: '#cbd5e1',
        fontFamily: 'Poppins-SemiBold',
    },
    unreadBadge: {
        backgroundColor: '#8b5cf6',
        borderRadius: 12,
        minWidth: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
    },
    unreadText: {
        fontSize: 11,
        fontWeight: '900',
        color: '#fff',
        fontFamily: 'Poppins-Bold',
    },
    groupInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    memberCount: {
        fontSize: 12,
        color: '#64748b',
        fontFamily: 'Poppins-Regular',
    },
    skeletonAvatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(148, 163, 184, 0.1)',
        marginRight: 14,
    },
    skeletonLine: {
        height: 14,
        backgroundColor: 'rgba(148, 163, 184, 0.1)',
        borderRadius: 7,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 80,
        paddingHorizontal: 32,
    },
    iconWrapper: {
        width: 140,
        height: 140,
        borderRadius: 70,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        borderWidth: 2,
        borderColor: 'rgba(139, 92, 246, 0.3)',
    },
    emptyTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: '#fff',
        marginBottom: 12,
        fontFamily: 'Poppins-Bold',
        letterSpacing: 0.3,
    },
    emptySubtitle: {
        fontSize: 15,
        color: '#94a3b8',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 36,
        fontFamily: 'Poppins-Regular',
    },
    button: {
        borderRadius: 16,
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
    buttonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 28,
        paddingVertical: 16,
        borderRadius: 16,
        gap: 10,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        fontFamily: 'Poppins-Bold',
    },
});
