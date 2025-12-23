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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChatInput } from '../../../components/chat/ChatInput';
import { EmptyChat } from '../../../components/chat/EmptyChat';
import { MessageBubble } from '../../../components/chat/MessageBubble';
import { useToast } from '../../../components/Toast';
import { authFetch } from '../../../utils/auth';

interface Message {
    id: string;
    senderId: string;
    senderName: string;
    senderAvatar?: string;
    messageText: string;
    createdAt: string;
    isOwn: boolean;
}

interface ChatScreenParams {
    id: string;
    name: string;
}

export default function GroupChatScreen() {
    const params = useLocalSearchParams<ChatScreenParams>();
    const router = useRouter();
    const { showError, showSuccess } = useToast();
    const flatListRef = useRef<FlatList>(null);

    const groupId = params.id;
    const groupName = params.name || 'Grup Sohbet';

    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [sending, setSending] = useState(false);
    const [userId, setUserId] = useState('');
    const [hasMore, setHasMore] = useState(true);

    // Load user ID
    useEffect(() => {
        loadUserId();
    }, []);

    // Load messages on mount
    useEffect(() => {
        if (userId) {
            loadMessages();
        }
    }, [userId]);

    // Poll for new messages every 3 seconds
    useEffect(() => {
        if (!userId) return;

        const interval = setInterval(() => {
            loadMessages(true); // Silent refresh
        }, 3000);

        return () => clearInterval(interval);
    }, [userId, messages]);

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

    const loadMessages = async (silent = false) => {
        if (!groupId) return;

        try {
            if (!silent) setLoading(true);

            const response = await authFetch(`/groups/${groupId}/messages?limit=50`);

            if (!response.ok) {
                // If endpoint doesn't exist (404), keep existing messages (including optimistic ones)
                if (response.status === 404) {
                    console.log('[Chat] Messages endpoint not yet implemented');
                    if (!silent) setLoading(false);
                    return; // Don't clear messages - keep optimistic ones
                }
                throw new Error('Failed to load messages');
            }

            const data = await response.json();

            if (data.success && data.messages) {
                // Mark own messages
                const messagesWithOwn = data.messages.map((msg: any) => ({
                    ...msg,
                    isOwn: msg.senderId === userId,
                }));

                // Preserve temporary/optimistic messages (those starting with 'temp-')
                const tempMessages = messages.filter(msg => msg.id.startsWith('temp-'));

                // Merge: backend messages + optimistic messages
                const mergedMessages = [...messagesWithOwn, ...tempMessages];

                setMessages(mergedMessages);
                setHasMore(data.pagination?.hasMore || false);

                // Auto-scroll to bottom on first load or new message
                if (!silent || mergedMessages.length > messages.length) {
                    setTimeout(() => {
                        flatListRef.current?.scrollToEnd({ animated: true });
                    }, 100);
                }
            }
        } catch (error: any) {
            console.error('[Chat] Load messages error:', error);

            // Don't show error for missing endpoint or during silent refresh
            if (!error.message?.includes('404') && !silent) {
                showError(error.message || 'Mesajlar yüklenemedi');
            }

            // Don't clear messages on error - keep existing ones
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const sendMessage = async (messageText: string) => {
        if (!groupId || !userId) return;

        try {
            setSending(true);

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

            // Scroll to bottom
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 50);

            // Send to backend
            const response = await authFetch(`/groups/${groupId}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ messageText }),
            });

            if (!response.ok) {
                // If endpoint doesn't exist, keep optimistic message with info
                if (response.status === 404) {
                    console.log('[Chat] Send endpoint not yet implemented, keeping optimistic message');
                    showError('Backend API henüz hazır değil - mesaj lokal olarak gösteriliyor');
                    return;
                }
                throw new Error('Failed to send message');
            }

            const data = await response.json();

            if (data.success && data.message) {
                // Replace optimistic message with real one
                setMessages((prev) =>
                    prev.map((msg) =>
                        msg.id === optimisticMessage.id
                            ? { ...data.message, isOwn: true }
                            : msg
                    )
                );
            }

            Keyboard.dismiss();
        } catch (error: any) {
            console.error('[Chat] Send message error:', error);

            // Don't remove optimistic message if endpoint missing
            if (!error.message?.includes('404')) {
                showError(error.message || 'Mesaj gönderilemedi');
                // Remove optimistic message on real error
                setMessages((prev) => prev.filter((msg) => !msg.id.startsWith('temp-')));
            }
        } finally {
            setSending(false);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadMessages();
    }, []);

    const renderMessage = ({ item }: { item: Message }) => (
        <MessageBubble message={item} />
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />

            {/* Header */}
            <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.header}>
                <View style={styles.headerContent}>
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
                        <Text style={styles.participantCount}>Grup Sohbeti</Text>
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

            {/* Messages */}
            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 75}
            >
                {loading && messages.length === 0 ? (
                    <View style={styles.loadingContainer}>
                        <Text style={styles.loadingText}>Mesajlar yükleniyor...</Text>
                    </View>
                ) : messages.length === 0 ? (
                    <EmptyChat />
                ) : (
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        renderItem={renderMessage}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.messageList}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={onRefresh}
                                tintColor="#8b5cf6"
                                colors={['#8b5cf6']}
                            />
                        }
                        onContentSizeChange={() => {
                            if (messages.length > 0) {
                                flatListRef.current?.scrollToEnd({ animated: false });
                            }
                        }}
                    />
                )}

                {/* Input */}
                <ChatInput onSend={sendMessage} disabled={sending} />
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    header: {
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 8 : 8,
        paddingHorizontal: 16,
        paddingBottom: 16,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.15)',
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
    participantCount: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.8)',
        fontFamily: 'Poppins-Regular',
        marginTop: 2,
    },
    infoButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    keyboardView: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        color: '#94a3b8',
        fontSize: 14,
        fontFamily: 'Poppins-Regular',
    },
    messageList: {
        paddingVertical: 12,
        flexGrow: 1,
    },
});
