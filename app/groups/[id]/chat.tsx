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
import { UnifiedHeader } from '../../../components/UnifiedHeader';
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
    status?: 'pending' | 'sent' | 'delivered' | 'read';
    audioUri?: string;
    audioDuration?: number;
    messageType?: 'text' | 'voice';
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
    const [lastSendTime, setLastSendTime] = useState(0);
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
                        console.log('[Chat] New message received via socket:', data);
                        if (data.groupId === groupId) {
                            const newMessage: Message = {
                                id: data.id || data._id || `msg-${Date.now()}`,
                                senderId: data.senderId || data.sender?.id || data.sender,
                                senderName: data.sender?.name || data.senderName || 'Unknown',
                                senderAvatar: data.senderAvatar || data.sender?.avatar,
                                messageText: data.message || data.messageText || data.text || '',
                                createdAt: data.createdAt || data.timestamp || new Date().toISOString(),
                                isOwn: (data.senderId || data.sender?.id || data.sender) === userId,
                                deleted: data.deleted || false,
                                status: 'delivered',
                            };

                            console.log('[Chat] Processed new message:', newMessage);

                            setMessages((prev) => {
                                // Remove temp message if exists
                                const filtered = prev.filter(m => !m.id.startsWith('temp-'));
                                // Check if message already exists
                                if (filtered.some(m => m.id === newMessage.id)) {
                                    console.log('[Chat] Message already exists, skipping');
                                    return prev;
                                }
                                console.log('[Chat] Adding new message to state');
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

                    // Listen for message status updates
                    socket.on('message_status', (data: any) => {
                        if (data.groupId === groupId) {
                            setMessages((prev) =>
                                prev.map((msg) =>
                                    msg.id === data.messageId
                                        ? { ...msg, status: data.status }
                                        : msg
                                )
                            );
                        }
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
                socket.off('message_status');
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

            console.log('[Chat] Loading messages for group:', groupId);
            const response = await authFetch(`/groups/${groupId}/messages?limit=50`);

            console.log('[Chat] Messages response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[Chat] Failed to load messages:', response.status, errorText);
                throw new Error(`Mesaj geçmişi yüklenemedi (${response.status})`);
            }

            const data = await response.json();
            console.log('[Chat] Raw messages data:', JSON.stringify(data).substring(0, 200));

            // Handle different response formats
            let messagesData = [];
            if (Array.isArray(data)) {
                messagesData = data;
            } else if (data.data?.messages) {
                messagesData = data.data.messages;
            } else if (data.messages) {
                messagesData = data.messages;
            } else if (data.data && Array.isArray(data.data)) {
                messagesData = data.data;
            }

            console.log('[Chat] Parsed messages count:', messagesData.length);

            const messagesWithOwn = messagesData.map((msg: any) => ({
                id: msg.id || msg._id,
                senderId: msg.senderId || msg.sender?.id || msg.sender,
                senderName: msg.senderName || msg.sender?.name || 'Unknown',
                senderAvatar: msg.senderAvatar || msg.sender?.avatar,
                messageText: msg.messageText || msg.message || msg.text || '',
                createdAt: msg.createdAt || msg.timestamp || new Date().toISOString(),
                isOwn: (msg.senderId || msg.sender?.id || msg.sender) === userId,
                deleted: msg.deleted || false,
                status: msg.status || 'sent',
            }));

            console.log('[Chat] Processed messages:', messagesWithOwn.length);
            setMessages(messagesWithOwn);
            setHasMore(data.data?.pagination?.hasMore || data.pagination?.hasMore || false);

            if (!silent) {
                setTimeout(() => {
                    flatListRef.current?.scrollToEnd({ animated: false });
                }, 100);
            }
        } catch (error: any) {
            console.error('[Chat] Load messages error:', error);

            if (!silent) {
                showError(error.message || 'Mesajlar yüklenemedi');
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const sendMessage = async (messageText: string) => {
        if (!groupId || !userId) return;

        // Spam prevention: minimum 500ms between messages
        const now = Date.now();
        if (now - lastSendTime < 500) {
            showError('Lütfen daha yavaş mesaj gönderin');
            return;
        }

        // Prevent empty messages
        const trimmed = messageText.trim();
        if (!trimmed) {
            showError('Boş mesaj gönderilemez');
            return;
        }

        try {
            setSending(true);
            setLastSendTime(now);

            // Stop typing indicator
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = null;
            }
            sendTypingIndicator(groupId, false);

            // Optimistic UI update with pending status
            const optimisticMessage: Message = {
                id: `temp-${Date.now()}`,
                senderId: userId,
                senderName: 'Sen',
                messageText: trimmed,
                createdAt: new Date().toISOString(),
                isOwn: true,
                status: 'pending',
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
                body: JSON.stringify({ message: trimmed, messageText: trimmed }), // Send both for compatibility
            });

            if (!response.ok) {
                throw new Error('Failed to send message');
            }

            const data = await response.json();
            const sentMessage = data.data?.message || data.message;

            if (sentMessage) {
                // Replace optimistic message with real one and mark as sent
                setMessages((prev) =>
                    prev.map((msg) =>
                        msg.id === optimisticMessage.id
                            ? { ...sentMessage, isOwn: true, status: 'sent' }
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

    const sendVoiceMessage = async (audioUri: string, duration: number) => {
        if (!groupId || !userId) return;

        try {
            console.log('[Chat] Sending voice message:', audioUri, duration);
            setSending(true);

            // Create FormData for file upload
            const formData = new FormData();
            const filename = audioUri.split('/').pop() || 'voice.m4a';

            formData.append('audio', {
                uri: audioUri,
                type: 'audio/m4a',
                name: filename,
            } as any);
            formData.append('duration', duration.toString());
            formData.append('messageType', 'voice');

            // Optimistic UI update
            const optimisticMessage: Message = {
                id: `temp-${Date.now()}`,
                senderId: userId,
                senderName: 'Sen',
                messageText: `🎤 Ses mesajı (${duration}s)`,
                createdAt: new Date().toISOString(),
                isOwn: true,
                status: 'pending',
                audioUri,
                audioDuration: duration,
                messageType: 'voice',
            };

            setMessages((prev) => [...prev, optimisticMessage]);

            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 50);

            // Send to backend
            const response = await authFetch(`/groups/${groupId}/messages`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Ses mesajı gönderilemedi');
            }

            const data = await response.json();
            const sentMessage = data.data?.message || data.message;

            if (sentMessage) {
                setMessages((prev) =>
                    prev.map((msg) =>
                        msg.id === optimisticMessage.id
                            ? { ...sentMessage, isOwn: true, status: 'sent' }
                            : msg
                    )
                );
            }

            console.log('[Chat] Voice message sent successfully');
        } catch (error: any) {
            console.error('[Chat] Send voice message error:', error);
            showError(error.message || 'Ses mesajı gönderilemedi');
            setMessages((prev) => prev.filter((msg) => !msg.id.startsWith('temp-')));
        } finally {
            setSending(false);
        }
    };

    const handleDeleteMessage = async (messageId: string, deleteForEveryone: boolean) => {
        try {
            if (deleteForEveryone) {
                // Delete for everyone - call backend
                const response = await authFetch(`/groups/${groupId}/messages/${messageId}`, {
                    method: 'DELETE',
                });

                if (!response.ok) {
                    throw new Error('Mesaj silinemedi');
                }

                // Update local state - mark as deleted
                setMessages((prev) =>
                    prev.map((msg) =>
                        msg.id === messageId ? { ...msg, deleted: true, messageText: 'Mesaj silindi' } : msg
                    )
                );

                console.log('[Chat] Message deleted for everyone:', messageId);
            } else {
                // Delete for me only - just remove from local state
                setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
                console.log('[Chat] Message deleted for me:', messageId);
            }
        } catch (error: any) {
            console.error('[Chat] Delete message error:', error);
            showError(error.message || 'Mesaj silinemedi');
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


    const renderMessage = ({ item }: { item: Message }) => (
        <MessageBubble message={item} onDelete={handleDeleteMessage} totalMembers={memberCount} />
    );

    const renderHeader = () => (
        <View style={{ marginBottom: 10 }}>
            <UnifiedHeader
                title={groupName || 'Grup Sohbet'}
                subtitle={`${memberCount} aktif üye`}
                brandLabel="SOHBET"
                gradientColors={['#8b5cf6', '#7c3aed']}
                onBackPress={() => router.back()}
                showBackButton={true}
                showProfile={false}
                showNetwork={true}
            />
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
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            <UnifiedHeader
                title={groupName || 'Grup Sohbet'}
                subtitle={`${memberCount} aktif üye`}
                brandLabel="SOHBET"
                gradientColors={['#8b5cf6', '#7c3aed']}
                onBackPress={() => router.back()}
                showBack={true}
                showProfile={false}
                showNetwork={true}
            />

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
                    <View style={styles.listContainer}>
                        {messages.length === 0 && !loading && <EmptyChat />}
                        {messages.length > 0 && (
                            <FlatList
                                ref={flatListRef}
                                data={messages}
                                renderItem={renderMessage}
                                keyExtractor={(item) => item.id}
                                contentContainerStyle={styles.messageList}
                                showsVerticalScrollIndicator={false}
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
                                keyboardDismissMode="interactive"
                                keyboardShouldPersistTaps="handled"
                            />
                        )}
                    </View>
                )}

                <ChatInput
                    onSend={sendMessage}
                    onTyping={handleTyping}
                    onVoiceSend={sendVoiceMessage}
                />
            </KeyboardAvoidingView>
        </View>
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
    listContainer: {
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
        paddingBottom: 20,
        paddingTop: 10,
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
