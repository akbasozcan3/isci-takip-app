import React from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    Pressable,
    ScrollView,
    Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { formatDistance } from '../utils/distance';

interface MemberLocation {
    lat: number;
    lng: number;
    timestamp: number;
}

interface Member {
    userId: string;
    displayName: string;
    email?: string;
    phone?: string;
    location: MemberLocation | null;
    isOnline: boolean;
    distance?: number | null;
    speed?: number | null;
    activity?: {
        type: string;
        icon: string;
    } | null;
}

interface MemberDetailModalProps {
    visible: boolean;
    member: Member | null;
    onClose: () => void;
    onShowOnMap?: () => void;
    onOpenChat?: () => void;
}

export default function MemberDetailModal({
    visible,
    member,
    onClose,
    onShowOnMap,
    onOpenChat,
}: MemberDetailModalProps) {
    if (!member) return null;

    const handleCall = () => {
        if (member.phone) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Linking.openURL(`tel:${member.phone}`);
        }
    };

    const formatTime = (timestamp: number) => {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);

        if (minutes < 1) return 'Şimdi';
        if (minutes < 60) return `${minutes} dk önce`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} saat önce`;
        return `${Math.floor(hours / 24)} gün önce`;
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <Pressable style={styles.backdrop} onPress={onClose} />

                <View style={styles.modalContainer}>
                    {/* Header */}
                    <LinearGradient
                        colors={member.isOnline ? ['#8b5cf6', '#7c3aed'] : ['#475569', '#334155']}
                        style={styles.header}
                    >
                        <View style={styles.headerContent}>
                            <View style={styles.avatar}>
                                <Text style={styles.avatarText}>
                                    {member.displayName.substring(0, 2).toUpperCase()}
                                </Text>
                                {member.isOnline && <View style={styles.onlineDot} />}
                            </View>

                            <View style={styles.headerInfo}>
                                <Text style={styles.memberName}>{member.displayName}</Text>
                                <View style={styles.statusBadge}>
                                    <View style={[styles.statusDot, member.isOnline && styles.statusDotOnline]} />
                                    <Text style={styles.statusText}>
                                        {member.isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        <Pressable onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#fff" />
                        </Pressable>
                    </LinearGradient>

                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        {/* Stats Grid */}
                        <View style={styles.statsGrid}>
                            {/* Distance */}
                            <View style={styles.statCard}>
                                <View style={styles.statIcon}>
                                    <Ionicons name="navigate" size={24} color="#8b5cf6" />
                                </View>
                                <Text style={styles.statLabel}>Mesafe</Text>
                                <Text style={styles.statValue}>
                                    {formatDistance(member.distance)}
                                </Text>
                            </View>

                            {/* Speed */}
                            <View style={styles.statCard}>
                                <View style={styles.statIcon}>
                                    <Ionicons name="speedometer" size={24} color="#0ea5e9" />
                                </View>
                                <Text style={styles.statLabel}>Hız</Text>
                                <Text style={styles.statValue}>
                                    {member.speed ? `${member.speed} km/h` : '-'}
                                </Text>
                            </View>

                            {/* Last Update */}
                            <View style={styles.statCard}>
                                <View style={styles.statIcon}>
                                    <Ionicons name="time" size={24} color="#10b981" />
                                </View>
                                <Text style={styles.statLabel}>Son Güncelleme</Text>
                                <Text style={styles.statValue}>
                                    {member.location ? formatTime(member.location.timestamp) : '-'}
                                </Text>
                            </View>

                            {/* Activity */}
                            {member.activity && (
                                <View style={styles.statCard}>
                                    <View style={styles.statIcon}>
                                        <Text style={styles.activityIcon}>{member.activity.icon}</Text>
                                    </View>
                                    <Text style={styles.statLabel}>Aktivite</Text>
                                    <Text style={styles.statValue}>{member.activity.type}</Text>
                                </View>
                            )}
                        </View>

                        {/* Location Details */}
                        {member.location && (
                            <View style={styles.locationCard}>
                                <View style={styles.locationHeader}>
                                    <Ionicons name="location" size={20} color="#8b5cf6" />
                                    <Text style={styles.locationTitle}>Konum Detayları</Text>
                                </View>
                                <View style={styles.locationDetails}>
                                    <View style={styles.locationRow}>
                                        <Text style={styles.locationLabel}>Enlem:</Text>
                                        <Text style={styles.locationValue}>
                                            {member.location.lat.toFixed(6)}
                                        </Text>
                                    </View>
                                    <View style={styles.locationRow}>
                                        <Text style={styles.locationLabel}>Boylam:</Text>
                                        <Text style={styles.locationValue}>
                                            {member.location.lng.toFixed(6)}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        )}

                        {/* Action Buttons */}
                        <View style={styles.actions}>
                            {onShowOnMap && (
                                <Pressable
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                        onShowOnMap();
                                        onClose();
                                    }}
                                    style={({ pressed }) => [
                                        styles.actionButton,
                                        pressed && styles.actionButtonPressed,
                                    ]}
                                >
                                    <LinearGradient
                                        colors={['#8b5cf6', '#7c3aed']}
                                        style={styles.actionButtonGradient}
                                    >
                                        <Ionicons name="map" size={20} color="#fff" />
                                        <Text style={styles.actionButtonText}>Haritada Göster</Text>
                                    </LinearGradient>
                                </Pressable>
                            )}

                            {member.phone && (
                                <Pressable
                                    onPress={handleCall}
                                    style={({ pressed }) => [
                                        styles.actionButton,
                                        pressed && styles.actionButtonPressed,
                                    ]}
                                >
                                    <LinearGradient
                                        colors={['#10b981', '#059669']}
                                        style={styles.actionButtonGradient}
                                    >
                                        <Ionicons name="call" size={20} color="#fff" />
                                        <Text style={styles.actionButtonText}>Ara</Text>
                                    </LinearGradient>
                                </Pressable>
                            )}

                            {onOpenChat && (
                                <Pressable
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                        onOpenChat();
                                        onClose();
                                    }}
                                    style={({ pressed }) => [
                                        styles.actionButton,
                                        pressed && styles.actionButtonPressed,
                                    ]}
                                >
                                    <LinearGradient
                                        colors={['#0ea5e9', '#0284c7']}
                                        style={styles.actionButtonGradient}
                                    >
                                        <Ionicons name="chatbubble" size={20} color="#fff" />
                                        <Text style={styles.actionButtonText}>Mesaj</Text>
                                    </LinearGradient>
                                </Pressable>
                            )}
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContainer: {
        backgroundColor: '#0f172a',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '85%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        paddingTop: 24,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatar: {
        position: 'relative',
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    avatarText: {
        fontSize: 20,
        fontWeight: '900',
        color: '#fff',
        fontFamily: 'Poppins-ExtraBold',
    },
    onlineDot: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#10b981',
        borderWidth: 3,
        borderColor: '#fff',
    },
    headerInfo: {
        marginLeft: 16,
        flex: 1,
    },
    memberName: {
        fontSize: 20,
        fontWeight: '800',
        color: '#fff',
        fontFamily: 'Poppins-Bold',
        marginBottom: 4,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        alignSelf: 'flex-start',
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#64748b',
        marginRight: 6,
    },
    statusDotOnline: {
        backgroundColor: '#10b981',
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#fff',
        fontFamily: 'Poppins-SemiBold',
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        padding: 20,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 20,
    },
    statCard: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: '#1e293b',
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#334155',
    },
    statIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    activityIcon: {
        fontSize: 24,
    },
    statLabel: {
        fontSize: 12,
        color: '#94a3b8',
        fontFamily: 'Poppins-Medium',
        marginBottom: 4,
    },
    statValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
        fontFamily: 'Poppins-Bold',
    },
    locationCard: {
        backgroundColor: '#1e293b',
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#334155',
    },
    locationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    locationTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
        fontFamily: 'Poppins-Bold',
        marginLeft: 8,
    },
    locationDetails: {
        gap: 8,
    },
    locationRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    locationLabel: {
        fontSize: 14,
        color: '#94a3b8',
        fontFamily: 'Poppins-Medium',
    },
    locationValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
        fontFamily: 'Poppins-SemiBold',
    },
    actions: {
        gap: 12,
        marginBottom: 20,
    },
    actionButton: {
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    actionButtonPressed: {
        opacity: 0.8,
        transform: [{ scale: 0.98 }],
    },
    actionButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        gap: 10,
    },
    actionButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
        fontFamily: 'Poppins-Bold',
    },
});
