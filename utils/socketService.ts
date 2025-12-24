import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { getApiBase } from '../utils/api';

let socket: Socket | null = null;

export const initializeSocket = async () => {
    if (socket?.connected) {
        return socket;
    }

    try {
        const token = await SecureStore.getItemAsync('token');
        const API_BASE = getApiBase();

        socket = io(API_BASE, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5,
            auth: token ? { token } : undefined,
            extraHeaders: token ? { Authorization: `Bearer ${token}` } : undefined,
        });

        socket.on('connect', () => {
            console.log('[Socket] Connected:', socket?.id);
        });

        socket.on('disconnect', (reason) => {
            console.log('[Socket] Disconnected:', reason);
        });

        socket.on('connect_error', (error) => {
            console.error('[Socket] Connection error:', error.message);
        });

        return socket;
    } catch (error) {
        console.error('[Socket] Initialize error:', error);
        return null;
    }
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};

export const joinGroupRoom = (groupId: string) => {
    if (socket?.connected) {
        socket.emit('join_group', groupId);
        console.log('[Socket] Joined group:', groupId);
    }
};

export const leaveGroupRoom = (groupId: string) => {
    if (socket?.connected) {
        socket.emit('leave_group', groupId);
        console.log('[Socket] Left group:', groupId);
    }
};

export const sendTypingIndicator = (groupId: string, isTyping: boolean) => {
    if (socket?.connected) {
        socket.emit('typing', { groupId, isTyping });
    }
};

export const sendMessageViaSocket = (groupId: string, messageText: string) => {
    return new Promise((resolve, reject) => {
        if (!socket?.connected) {
            reject(new Error('Socket not connected'));
            return;
        }

        socket.emit('send_message', { groupId, message: messageText });

        socket.once('message_sent', (data) => {
            resolve(data);
        });

        socket.once('message_error', (error) => {
            reject(new Error(error.error || 'Failed to send message'));
        });

        // Timeout after 10 seconds
        setTimeout(() => {
            reject(new Error('Message send timeout'));
        }, 10000);
    });
};
