import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    RefreshControl,
    StatusBar,
    StyleSheet,
    Text,
    View,
    Animated,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChatInput } from '../../../components/chat/ChatInput';
import { EmptyChat } from '../../../components/chat/EmptyChat';
import { MessageBubble } from '../../../components/chat/MessageBubble';
import { useToast } from '../../../components/Toast';
import { authFetch } from '../../../utils/auth';
import { initializeSocket, getSocket, joinGroupRoom, leaveGroupRoom, sendTypingIndicator } from '../../../utils/socketService';
import { useNetworkStatus } from '../../../utils/networkStatus';

interface Message {
    id: string;
    senderId: string;
    senderName: string;
    senderAvatar?: string;
    messageText: string;
    createdAt: string;
    isOwn: boolean;
    deleted?: boolean;
}

interface ChatScreenParams {
    id: string;
    name: string;
}

export default function GroupChatScreen() {
    const params = useLocalSearchParams<ChatScreenParams>();
    const router = useRouter();
    const { showError, showSuccess, showInfo } = useToast();
    const flatListRef = useRef<FlatList>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const groupId = params.id;
    const groupName = params.name || 'Grup Sohbet';

    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [sending, setSending] = useState(false);
    const [userId, setUserId] = useState('');
    const [hasMore, setHasMore] = useState(true);
    const [memberCount, setMemberCount] = useState(0);
    const [isTyping, setIsTyping] = useState(false);
    const [typingUsers, setTypingUsers] = useState<string[]>([]);
    const [socketConnected, setSocketConnected] = useState(false);
    const networkState = useNetworkStatus();

    // Combined connection status
    const isFullyConnected = networkState.isConnected && networkState.isInternetReachable && socketConnected;

    // Load user ID
    useEffect(() => {
        loadUserId();
        loadGroupInfo();
    }, []);

    // Initialize Socket.IO
    useEffect(() => {
        if (!userId || !groupId) return;

        const setupSocket = async () => {
            try {
                const socket = await initializeSocket();
                if (socket) {
                    setSocketConnected(socket.connected);

                    // Join group room
                    joinGroupRoom(groupId);

                    // Listen for new messages
                    socket.on('new_message', (data: any) => {
                        console.log('[Chat] New message received:', data);
                        if (data.groupId === groupId) {
                            const newMessage: Message = {
                                id: data.id,
                                senderId: data.senderId,
                                senderName: data.sender?.name || data.senderName || 'Unknown',
                                senderAvatar: data.senderAvatar,
                                messageText: data.message || data.messageText,
                                createdAt: new Date(data.createdAt).toISOString(),
                                isOwn: data.senderId === userId,
                                deleted: data.deleted || false,
                            };

                            setMessages((prev) => {
                                // Remove temp message if exists
                                const filtered = prev.filter(m => !m.id.startsWith('temp-'));
                                // Check if message already exists
                                if (filtered.some(m => m.id === newMessage.id)) {
                                    return prev;
                                }
                                return [...filtered, newMessage];
                            });

                            // Auto scroll to bottom
                            setTimeout(() => {
                                flatListRef.current?.scrollToEnd({ animated: true });
                            }, 100);
                        }
                    });

                    // Listen for typing indicators
                    socket.on('user_typing', (data: any) => {
                        if (data.groupId === groupId && data.userId !== userId) {
                            if (data.isTyping) {
                                setTypingUsers((prev) => {
                                    if (!prev.includes(data.userName)) {
                                        return [...prev, data.userName];
                                    }
                                    return prev;
                                });
                            } else {
                                setTypingUsers((prev) => prev.filter(u => u !== data.userName));
                            }
                        }
                    });

                    // Listen for connection status
                    socket.on('connect', () => {
                        setSocketConnected(true);
                        joinGroupRoom(groupId);
                        showSuccess('Bağlantı kuruldu');
                    });

                    socket.on('disconnect', () => {
                        setSocketConnected(false);
                        showInfo('Bağlantı kesildi');
                    });
                }
            } catch (error) {
                console.error('[Chat] Socket setup error:', error);
            }
        };

        setupSocket();

        return () => {
            const socket = getSocket();
            if (socket) {
                leaveGroupRoom(groupId);
                socket.off('new_message');
                socket.off('user_typing');
                socket.off('connect');
                socket.off('disconnect');
            }
        };
    }, [userId, groupId]);

    // Load messages on mount
    useEffect(() => {
        if (userId) {
            loadMessages();
        }
    }, [userId]);

    const loadUserId = async () => {
        try {
            const stored = await SecureStore.getItemAsync('workerId');
            if (stored) {
                setUserId(stored);
            }
        } catch (error) {
            console.error('[Chat] Failed to load user ID:', error);
        }
    };

    const loadGroupInfo = async () => {
        try {
            const response = await authFetch(`/groups/${groupId}`);
            if (response.ok) {
                const data = await response.json();
                const groupData = data.data || data.group || data;
                setMemberCount(groupData?.memberCount || 0);
            }
        } catch (error) {
            console.error('[Chat] Failed to load group info:', error);
        }
    };

    const loadMessages = async (silent = false) => {
        if (!groupId) return;

        try {
            if (!silent) setLoading(true);

            const response = await authFetch(`/groups/${groupId}/messages?limit=50`);

            if (!response.ok) {
                if (response.status === 404) {
                    console.log('[Chat] Messages endpoint not yet implemented');
                    if (!silent) setLoading(false);
                    return;
                }
                throw new Error('Failed to load messages');
            }

            const data = await response.json();
            const messagesData = data.data?.messages || data.messages || [];

            const messagesWithOwn = messagesData.map((msg: any) => ({
                ...msg,
                isOwn: msg.senderId === userId,
            }));

            setMessages(messagesWithOwn);
            setHasMore(data.data?.pagination?.hasMore || data.pagination?.hasMore || false);

            if (!silent) {
                setTimeout(() => {
                    flatListRef.current?.scrollToEnd({ animated: false });
                }, 100);
            }
        } catch (error: any) {
            console.error('[Chat] Load messages error:', error);

            if (!error.message?.includes('404') && !silent) {
                showError(error.message || 'Mesajlar yüklenemedi');
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const sendMessage = async (messageText: string) => {
        if (!groupId || !userId) return;

        try {
            setSending(true);

            // Stop typing indicator
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = null;
            }
            sendTypingIndicator(groupId, false);

            // Optimistic UI update
            const optimisticMessage: Message = {
                id: `temp-${Date.now()}`,
                senderId: userId,
                senderName: 'Sen',
                messageText,
                createdAt: new Date().toISOString(),
                isOwn: true,
            };

            setMessages((prev) => [...prev, optimisticMessage]);

            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 50);

            // Send via HTTP (Socket.IO will broadcast to others)
            const response = await authFetch(`/groups/${groupId}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ messageText }),
            });

            if (!response.ok) {
                throw new Error('Failed to send message');
            }

            const data = await response.json();
            const sentMessage = data.data?.message || data.message;

            if (sentMessage) {
                // Replace optimistic message with real one
                setMessages((prev) =>
                    prev.map((msg) =>
                        msg.id === optimisticMessage.id
                            ? { ...sentMessage, isOwn: true }
                            : msg
                    )
                );
            }

            // Don't dismiss keyboard - keep it open for continuous messaging
        } catch (error: any) {
            console.error('[Chat] Send message error:', error);
            showError(error.message || 'Mesaj gönderilemedi');
            // Remove optimistic message on error
            setMessages((prev) => prev.filter((msg) => !msg.id.startsWith('temp-')));
        } finally {
            setSending(false);
        }
    };

    const handleTyping = (text: string) => {
        if (!text.trim()) {
            sendTypingIndicator(groupId, false);
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = null;
            }
            return;
        }

        // Send typing indicator
        sendTypingIndicator(groupId, true);

        // Clear existing timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // Stop typing after 3 seconds of inactivity
        typingTimeoutRef.current = setTimeout(() => {
            sendTypingIndicator(groupId, false);
        }, 3000);
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadMessages();
    }, []);

    const handleDeleteMessage = async (messageId: string) => {
        try {
            // Optimistic UI update
            setMessages(prev => prev.map(msg =>
                msg.id === messageId ? { ...msg, deleted: true } : msg
            ));

            // Send delete request to backend
            const response = await authFetch(`/groups/${groupId}/messages/${messageId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                // Revert on error
                setMessages(prev => prev.map(msg =>
                    msg.id === messageId ? { ...msg, deleted: false } : msg
                ));
                showError('Mesaj silinemedi');
            }
        } catch (error) {
            console.error('[Chat] Delete message error:', error);
            // Revert on error
            setMessages(prev => prev.map(msg =>
                msg.id === messageId ? { ...msg, deleted: false } : msg
            ));
            showError('Mesaj silinemedi');
        }
    };

    const renderMessage = ({ item }: { item: Message }) => (
        <MessageBubble message={item} onDelete={handleDeleteMessage} />
    );

    const renderHeader = () => (
        <View style={styles.headerInList}>
            <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.headerGradient}>
                <View style={styles.headerTop}>
                    <Pressable
                        onPress={() => router.back()}
                        style={({ pressed }) => [
                            styles.backButton,
                            pressed && { opacity: 0.7 },
                        ]}
                    >
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </Pressable>

                    <View style={styles.headerCenter}>
                        <Text style={styles.groupName}>{groupName}</Text>
                        <View style={styles.statusRow}>
                            <View style={[
                                styles.onlineIndicator,
                                !isFullyConnected && { backgroundColor: '#ef4444' }
                            ]} />
                            <Text style={styles.participantCount}>
                                {!networkState.isConnected
                                    ? '📡 İnternet yok'
                                    : !networkState.isInternetReachable
                                        ? '🌐 Bağlantı zayıf'
                                        : !socketConnected
                                            ? '🔌 Bağlanıyor...'
                                            : memberCount > 0
                                                ? `${memberCount} üye`
                                                : 'Grup Sohbeti'}
                            </Text>
                        </View>
                    </View>

                    <Pressable
                        onPress={() => router.push(`/groups/${groupId}`)}
                        style={({ pressed }) => [
                            styles.infoButton,
                            pressed && { opacity: 0.7 },
                        ]}
                    >
                        <Ionicons name="information-circle-outline" size={24} color="#fff" />
                    </Pressable>
                </View>
            </LinearGradient>
        </View>
    );

    const renderTypingIndicator = () => {
        if (typingUsers.length === 0) return null;

        return (
            <View style={styles.typingContainer}>
                <View style={styles.typingBubble}>
                    <Text style={styles.typingText}>
                        {typingUsers.length === 1
                            ? `${typingUsers[0]} yazıyor...`
                            : `${typingUsers.length} kişi yazıyor...`}
                    </Text>
                    <View style={styles.typingDots}>
                        <View style={[styles.typingDot, { animationDelay: '0s' }]} />
                        <View style={[styles.typingDot, { animationDelay: '0.2s' }]} />
                        <View style={[styles.typingDot, { animationDelay: '0.4s' }]} />
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />

            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                {loading && messages.length === 0 ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#6366f1" />
                        <Text style={styles.loadingText}>Mesajlar yükleniyor...</Text>
                    </View>
                ) : (
                    <View style={{ flex: 1 }}>
                        <FlatList
                            ref={flatListRef}
                            data={messages}
                            renderItem={renderMessage}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={styles.messageList}
                            showsVerticalScrollIndicator={false}
                            ListHeaderComponent={renderHeader}
                            ListEmptyComponent={<EmptyChat />}
                            ListFooterComponent={renderTypingIndicator}
                            refreshControl={
                                <RefreshControl
                                    refreshing={refreshing}
                                    onRefresh={onRefresh}
                                    tintColor="#8b5cf6"
                                    colors={['#8b5cf6']}
                                />
                            }
                            scrollEventThrottle={16}
                            onContentSizeChange={() => {
                                if (messages.length > 0 && !loading) {
                                    flatListRef.current?.scrollToEnd({ animated: false });
                                }
                            }}
                        />
                    </View>
                )}

                {/* Input - Sticky at bottom */}
                <ChatInput
                    onSend={sendMessage}
                    onTyping={handleTyping}
                />
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    keyboardView: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
    },
    loadingText: {
        color: '#94a3b8',
        fontSize: 14,
        fontFamily: 'Poppins-Regular',
    },
    messageList: {
        flexGrow: 1,
        paddingBottom: 12,
    },
    headerInList: {
        marginBottom: 16,
    },
    headerGradient: {
        borderRadius: 24,
        marginHorizontal: 12,
        marginTop: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerCenter: {
        flex: 1,
    },
    groupName: {
        fontSize: 18,
        fontWeight: '900',
        color: '#fff',
        fontFamily: 'Poppins-Bold',
        letterSpacing: 0.3,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 6,
    },
    onlineIndicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#10b981',
    },
    participantCount: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.9)',
        fontFamily: 'Poppins-Medium',
    },
    infoButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    typingContainer: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    typingBubble: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(30, 41, 59, 0.6)',
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 8,
        alignSelf: 'flex-start',
        gap: 8,
    },
    typingText: {
        fontSize: 13,
        color: '#94a3b8',
        fontFamily: 'Poppins-Medium',
        fontStyle: 'italic',
    },
    typingDots: {
        flexDirection: 'row',
        gap: 4,
    },
    typingDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#6366f1',
    },
});
