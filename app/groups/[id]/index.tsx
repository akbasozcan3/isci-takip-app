
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    Pressable,
    ScrollView,
    Share,
    StatusBar,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { UnifiedHeader } from '../../../components/UnifiedHeader';
import { authFetch } from '../../../utils/auth';
import { Toast, useToast } from '../../../components/Toast';

const { width } = Dimensions.get('window');

interface Member {
    userId: string;
    displayName: string;
    role: 'admin' | 'member';
    photoUrl?: string; // Optional
}

interface GroupDetails {
    id: string;
    name: string;
    code: string;
    address: string;
    memberCount: number;
    createdAt: number;
    createdBy: string;
}

export default function GroupDetailScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const { showSuccess, showError, toast, hideToast } = useToast();

    const [group, setGroup] = useState<GroupDetails | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, [id]);

    const loadData = async () => {
        try {
            setLoading(true);
            const storedUserId = await SecureStore.getItemAsync('workerId');
            setUserId(storedUserId);

            // Fetch Group Info (using code endpoint if id matches, or we might need a specific by-id endpoint if not public)
            // Actually, we usually have /groups/user/:userId to get list. 
            // Let's assume we can hit /groups/user/:userId and find it, OR add a specific GET /groups/:groupId endpoint?
            // Checking groupController... getGroupInfoByCode exists. getGroupById is internal.
            // But getMembers works with groupId.

            // We will use existing endpoints:
            // 1. Get List to find group details (or add endpoint if strictly needed, but let's try to be efficient)
            // Actually, let's fetch members first, if 403 then we know we can't see it.

            const membersRes = await authFetch(`/groups/${id}/members`);
            if (membersRes.ok) {
                const membersData = await membersRes.json();
                const membersList = membersData.data || membersData;
                setMembers(Array.isArray(membersList) ? membersList : []);

                // Determine admin status
                const currentUserMember = Array.isArray(membersList)
                    ? membersList.find((m: Member) => m.userId === storedUserId)
                    : null;

                if (currentUserMember?.role === 'admin') {
                    setIsAdmin(true);
                }
            }

            // We need Group Info (Name, Code). 
            // If we are a member, we can find it in our user's group list.
            if (storedUserId) {
                const groupsRes = await authFetch(`/groups/user/${storedUserId}`);
                if (groupsRes.ok) {
                    const groupsData = await groupsRes.json();
                    const myGroups = Array.isArray(groupsData) ? groupsData : (groupsData.data || []);
                    const foundGroup = myGroups.find((g: any) => g.id === id);
                    if (foundGroup) {
                        setGroup(foundGroup);
                    }
                }
            }

        } catch (error) {
            console.error('Failed to load group details:', error);
            showError('Grup bilgileri yüklenemedi');
        } finally {
            setLoading(false);
        }
    };

    const shareGroupCode = async () => {
        if (!group) return;
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await Share.share({
                message: `Aile Takip uygulamasında "${group.name}" grubuna katıl! Grup Kodu: ${group.code}`,
            });
        } catch (error) {
            console.error(error);
        }
    };

    const leaveGroup = () => {
        if (!group) return;
        Alert.alert(
            'Gruptan Ayrıl',
            'Bu gruptan ayrılmak istediğinize emin misiniz?',
            [
                { text: 'İptal', style: 'cancel' },
                {
                    text: 'Ayrıl',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const res = await authFetch(`/groups/${group.id}/leave`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ userId })
                            });
                            if (res.ok) {
                                router.replace('/(tabs)/groups');
                            } else {
                                showError('Gruptan ayrılınamadı');
                            }
                        } catch (e) {
                            showError('Bir hata oluştu');
                        }
                    }
                }
            ]
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0EA5E9" />
            </View>
        );
    }

    if (!group) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={{ color: '#fff' }}>Grup bulunamadı</Text>
                <Pressable onPress={() => router.back()} style={{ marginTop: 20, padding: 10 }}>
                    <Text style={{ color: '#0EA5E9' }}>Geri Dön</Text>
                </Pressable>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
            <UnifiedHeader
                title={group.name}
                showBack={true}
                onBackPress={() => router.back()}
                rightIcon={isAdmin ? "settings-outline" : "share-social-outline"}
                onRightPress={isAdmin ? () => { } : shareGroupCode}
            />

            <ScrollView contentContainerStyle={styles.content}>
                {/* Header Card */}
                <LinearGradient
                    colors={['#1e293b', '#0f172a']}
                    style={styles.headerCard}
                >
                    <View style={styles.groupInfo}>
                        <View style={styles.groupIcon}>
                            <Ionicons name="people" size={32} color="#0EA5E9" />
                        </View>
                        <View>
                            <Text style={styles.groupName}>{group.name}</Text>
                            <Text style={styles.groupAddress}>{group.address}</Text>
                        </View>
                    </View>

                    <View style={styles.codeContainer}>
                        <Text style={styles.codeLabel}>Grup Kodu:</Text>
                        <Pressable onPress={shareGroupCode} style={styles.codeBox}>
                            <Text style={styles.codeText}>{group.code}</Text>
                            <Ionicons name="copy-outline" size={16} color="#94a3b8" />
                        </Pressable>
                    </View>
                </LinearGradient>

                {/* Action Grid */}
                <View style={styles.actionGrid}>
                    <Pressable
                        style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.9 }]}
                        onPress={() => {
                            // Open Map with this group selected
                            // Since we are in separate screen, we might need to navigate to groups tab with param?
                            // Or better, navigate to a dedicated map page if distinct from /group-map
                            // Actually, the main Map is /group-map.tsx? No, that's global?
                            // Let's rely on FullScreenMap in other places, or link to (tabs)/track
                            router.push({ pathname: '/(tabs)/track' });
                        }}
                    >
                        <LinearGradient colors={['#0EA5E9', '#0284c7']} style={styles.actionGradient}>
                            <Ionicons name="map" size={24} color="#fff" />
                            <Text style={styles.actionText}>Canlı Harita</Text>
                        </LinearGradient>
                    </Pressable>

                    <Pressable
                        style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.9 }]}
                        onPress={() => router.push({ pathname: `/groups/${group.id}/chat`, params: { name: group.name } })}
                    >
                        <LinearGradient colors={['#8b5cf6', '#7c3aed']} style={styles.actionGradient}>
                            <Ionicons name="chatbubbles" size={24} color="#fff" />
                            <Text style={styles.actionText}>Mesajlaş</Text>
                        </LinearGradient>
                    </Pressable>
                </View>

                {/* Members List */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Üyeler ({members.length})</Text>
                    {isAdmin && (
                        <Pressable onPress={shareGroupCode}>
                            <Text style={styles.linkText}>+ Davet Et</Text>
                        </Pressable>
                    )}
                </View>

                <View style={styles.membersList}>
                    {members.map((member) => (
                        <View key={member.userId} style={styles.memberRow}>
                            <View style={styles.memberAvatar}>
                                <Text style={styles.avatarText}>
                                    {member.displayName ? member.displayName.substring(0, 2).toUpperCase() : '??'}
                                </Text>
                            </View>
                            <View style={styles.memberInfo}>
                                <Text style={styles.memberName}>{member.displayName}</Text>
                                <Text style={styles.memberRole}>
                                    {member.role === 'admin' ? 'Yönetici' : 'Üye'}
                                </Text>
                            </View>
                            {member.role === 'admin' && (
                                <Ionicons name="shield-checkmark" size={16} color="#10b981" />
                            )}
                        </View>
                    ))}
                </View>

                <Pressable
                    onPress={leaveGroup}
                    style={({ pressed }) => [styles.leaveButton, pressed && { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}
                >
                    <Ionicons name="log-out-outline" size={20} color="#ef4444" />
                    <Text style={styles.leaveText}>Gruptan Ayrıl</Text>
                </Pressable>
            </ScrollView>

            <Toast
                message={toast.message}
                type={toast.type}
                visible={toast.visible}
                onHide={hideToast}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: '#0f172a',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        padding: 16,
        paddingBottom: 40,
    },
    headerCard: {
        padding: 20,
        borderRadius: 24,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    groupInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        gap: 16,
    },
    groupIcon: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(14, 165, 233, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(14, 165, 233, 0.3)',
    },
    groupName: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#fff',
        fontFamily: 'Poppins-Bold',
    },
    groupAddress: {
        fontSize: 13,
        color: '#94a3b8',
        marginTop: 4,
        maxWidth: 200,
        fontFamily: 'Poppins-Regular',
    },
    codeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(0,0,0,0.2)',
        padding: 12,
        borderRadius: 12,
    },
    codeLabel: {
        color: '#94a3b8',
        fontSize: 14,
        fontFamily: 'Poppins-Medium',
    },
    codeBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    codeText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 1,
        fontFamily: 'Poppins-Bold',
    },
    actionGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    actionButton: {
        flex: 1,
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    actionGradient: {
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 100,
    },
    actionText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
        fontFamily: 'Poppins-SemiBold',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        fontFamily: 'Poppins-Bold',
    },
    linkText: {
        color: '#0EA5E9',
        fontSize: 14,
        fontWeight: '600',
        fontFamily: 'Poppins-SemiBold',
    },
    membersList: {
        backgroundColor: '#1e293b',
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 24,
    },
    memberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
        gap: 12,
    },
    memberAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#334155',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    memberInfo: {
        flex: 1,
    },
    memberName: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '500',
        fontFamily: 'Poppins-Medium',
    },
    memberRole: {
        color: '#94a3b8',
        fontSize: 12,
        marginTop: 2,
        fontFamily: 'Poppins-Regular',
    },
    leaveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#ef4444',
    },
    leaveText: {
        color: '#ef4444',
        fontWeight: '600',
        fontSize: 15,
        fontFamily: 'Poppins-SemiBold',
    },
});
