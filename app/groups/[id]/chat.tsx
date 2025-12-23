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
    deleted?: boolean;
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
    const scrollY = useRef(new Animated.Value(0)).current;

    const groupId = params.id;
    const groupName = params.name || 'Grup Sohbet';

    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [sending, setSending] = useState(false);
    const [userId, setUserId] = useState('');
    const [hasMore, setHasMore] = useState(true);
    const [memberCount, setMemberCount] = useState(0);

    // Load user ID
    useEffect(() => {
        loadUserId();
        loadGroupInfo();
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

    const loadGroupInfo = async () => {
        try {
            const response = await authFetch(`/groups/${groupId}`);
            if (response.ok) {
                const data = await response.json();
                setMemberCount(data.group?.memberCount || 0);
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

            if (data.success && data.messages) {
                const messagesWithOwn = data.messages.map((msg: any) => ({
                    ...msg,
                    isOwn: msg.senderId === userId,
                }));

                const tempMessages = messages.filter(msg => msg.id.startsWith('temp-'));
                const mergedMessages = [...messagesWithOwn, ...tempMessages];

                setMessages(mergedMessages);
                setHasMore(data.pagination?.hasMore || false);

                if (!silent || mergedMessages.length > messages.length) {
                    setTimeout(() => {
                        flatListRef.current?.scrollToEnd({ animated: true });
                    }, 100);
                }
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

            const response = await authFetch(`/groups/${groupId}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ messageText }),
            });

            if (!response.ok) {
                if (response.status === 404) {
                    console.log('[Chat] Send endpoint not yet implemented, keeping optimistic message');
                    showError('Backend API henüz hazır değil - mesaj lokal olarak gösteriliyor');
                    return;
                }
                throw new Error('Failed to send message');
            }

            const data = await response.json();

            if (data.success && data.message) {
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

            if (!error.message?.includes('404')) {
                showError(error.message || 'Mesaj gönderilemedi');
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

    // Header opacity based on scroll
    const headerOpacity = scrollY.interpolate({
        inputRange: [0, 50],
        outputRange: [1, 0.95],
        extrapolate: 'clamp',
    });

    const renderHeader = () => (
        <Animated.View style={[styles.headerInList, { opacity: headerOpacity }]}>
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
                            <View style={styles.onlineIndicator} />
                            <Text style={styles.participantCount}>
                                {memberCount > 0 ? `${memberCount} üye` : 'Grup Sohbeti'}
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
        </Animated.View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />

            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                {loading && messages.length === 0 ? (
                    <View style={styles.loadingContainer}>
                        <Text style={styles.loadingText}>Mesajlar yükleniyor...</Text>
                    </View>
                ) : (
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        renderItem={renderMessage}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.messageList}
                        showsVerticalScrollIndicator={false}
                        ListHeaderComponent={renderHeader}
                        ListEmptyComponent={<EmptyChat />}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={onRefresh}
                                tintColor="#8b5cf6"
                                colors={['#8b5cf6']}
                            />
                        }
                        onScroll={Animated.event(
                            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                            { useNativeDriver: true }
                        )}
                        scrollEventThrottle={16}
                        onContentSizeChange={() => {
                            if (messages.length > 0) {
                                flatListRef.current?.scrollToEnd({ animated: false });
                            }
                        }}
                    />
                )}

                {/* Input - Sticky at bottom */}
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
});
