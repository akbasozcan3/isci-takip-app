import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface MessageBubbleProps {
    message: {
        id: string;
        senderId: string;
        senderName: string;
        senderAvatar?: string;
        messageText: string;
        createdAt: string;
        isOwn: boolean;
    };
}

export function MessageBubble({ message }: MessageBubbleProps) {
    const isOwn = message.isOwn;
    const timestamp = new Date(message.createdAt).toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
    });

    return (
        <View style={[styles.container, isOwn ? styles.ownContainer : styles.otherContainer]}>
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
                        <Ionicons name="checkmark-done" size={14} color="rgba(255,255,255,0.8)" style={{ marginLeft: 4 }} />
                    </View>
                </LinearGradient>
            ) : (
                <View style={styles.otherBubble}>
                    <Text style={styles.senderName}>{message.senderName}</Text>
                    <Text style={styles.otherMessageText}>{message.messageText}</Text>
                    <Text style={styles.otherTimestamp}>{timestamp}</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        marginVertical: 4,
        paddingHorizontal: 16,
    },
    ownContainer: {
        justifyContent: 'flex-end',
    },
    otherContainer: {
        justifyContent: 'flex-start',
    },
    ownBubble: {
        maxWidth: '75%',
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
        maxWidth: '75%',
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
});
