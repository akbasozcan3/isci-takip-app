import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { io, Socket } from 'socket.io-client';
import { EmptyState } from '../../components/EmptyState';
import { NetworkStatusIcon } from '../../components/NetworkStatusIcon';
import { SkeletonList } from '../../components/SkeletonLoader';
import { Toast, useToast } from '../../components/Toast';
import { getApiBase } from '../../utils/api';
import { authFetch } from '../../utils/auth';

const API_BASE = getApiBase();

interface GroupRequest {
  id: string;
  userId: string;
  displayName: string;
  status: string;
  requestedAt: number;
}

interface Group {
  id: string;
  code: string;
  name: string;
  address: string;
  memberCount: number;
}

export default function AdminScreen() {
  console.log('[Admin] Component rendering');
  const router = useRouter();
  const { toast, showError, showSuccess, showWarning, showInfo, hideToast } = useToast();
  const [groups, setGroups] = React.useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = React.useState<Group | null>(null);
  const [requests, setRequests] = React.useState<GroupRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [userId, setUserId] = React.useState('');
  const [profileName, setProfileName] = React.useState<string>('');
  const socketRef = React.useRef<Socket | null>(null);

  React.useEffect(() => {
    const loadUserId = async () => {
      try {
        const stored = await SecureStore.getItemAsync('workerId');
        if (stored) {
          setUserId(stored);
          try {
            const r = await authFetch('/users/me');
            if (r.ok) {
              const { user } = await r.json();
              if (user && (user.name || user.email)) setProfileName(user.name || user.email);
            }
          } catch {}
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error loading user ID:', error);
        setLoading(false);
      }
    };
    loadUserId();
  }, []);

  const loadGroups = React.useCallback(async () => {
    if (!userId) {
      console.log('[Admin] Cannot load groups, no userId');
      setLoading(false);
      return;
    }
    
    console.log('[Admin] Loading admin groups for user:', userId);
    setLoading(true);
    try {
      // Timeout ekle (10 saniye)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const { authFetch } = await import('../../utils/auth');
      const response = await authFetch(`/groups/user/${userId}/admin`);
      clearTimeout(timeoutId);
      
      console.log('[Admin] Groups response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        const groupsData = data.data || data;
        console.log('[Admin] Loaded groups:', Array.isArray(groupsData) ? groupsData.length : 0);
        setGroups(Array.isArray(groupsData) ? groupsData : []);
      } else {
        if (response.status === 429) {
          console.warn('[Admin] Rate limit - skipping groups load');
          showWarning('Çok fazla istek. Lütfen birkaç saniye bekleyin.');
          setGroups([]);
        } else {
          console.warn('[Admin] Failed to load groups:', response.status);
          setGroups([]);
        }
      }
    } catch (error: any) {
      console.error('[Admin] Error loading groups:', error);
      setGroups([]);
      setLoading(false);
      
      // Network error handling
      const { isNetworkError } = await import('../../utils/network');
      if (isNetworkError(error)) {
        // Don't show error toast for network errors - NetworkGuard handles it
        console.warn('[Admin] Network error detected, handled by NetworkGuard');
        return;
      }
      
      // Other errors
      if (error?.response?.status === 429) {
        showWarning('Çok fazla istek. Lütfen birkaç saniye bekleyin.');
      } else if (error?.response?.status === 401) {
        showError('Oturum süresi doldu. Lütfen tekrar giriş yapın.');
      } else {
        showError('Gruplar yüklenemedi. Lütfen tekrar deneyin.');
      }
      return;
    }
    setLoading(false);
  }, [userId, showWarning]);

  const loadRequests = async (groupId: string) => {
    try {
      const response = await authFetch(`/groups/${groupId}/requests`);
      if (response.ok) {
        const data = await response.json();
        setRequests(data.data || data);
      } else {
        setRequests([]);
      }
    } catch (error: any) {
      console.error('[Admin] Error loading requests:', error);
      setRequests([]);
      const { isNetworkError } = await import('../../utils/network');
      if (!isNetworkError(error)) {
        showError('Başvurular yüklenemedi.');
      }
    }
  };

  const approveRequest = async (groupId: string, requestId: string) => {
    console.log('[Admin] Approving request:', requestId, 'for group:', groupId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      const response = await authFetch(`/groups/${groupId}/requests/${requestId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminUserId: userId
        }),
      });

      console.log('[Admin] Approve response status:', response.status);
      if (response.ok) {
        // Başarılı onay
        console.log('[Admin] Request approved successfully');
        setRequests(prev => prev.filter(r => r.id !== requestId));
        showSuccess('Kullanıcı gruba kabul edildi');
      } else {
        const error = await response.json();
        console.error('[Admin] Approve failed:', error);
        showError(error.error || 'Onay işlemi başarısız');
      }
    } catch (error: any) {
      console.error('[Admin] Approve request error:', error);
      const { isNetworkError } = await import('../../utils/network');
      if (isNetworkError(error)) {
        // NetworkGuard handles network errors
        return;
      }
      showError('Onay işlemi başarısız');
    }
  };

  const deleteGroup = async (groupId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    try {
      const response = await authFetch(`/groups/${groupId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminUserId: userId })
      });
      if (response.ok) {
        setGroups(prev => prev.filter(g => g.id !== groupId));
        if (selectedGroup?.id === groupId) {
          setSelectedGroup(null);
          setRequests([]);
        }
        showSuccess('Grup silindi');
      } else {
        const err = await response.json().catch(() => ({} as any));
        showError(err.error || 'Grup silinemedi');
      }
    } catch (e: any) {
      const { isNetworkError } = await import('../../utils/network');
      if (!isNetworkError(e)) {
        showError('Grup silinemedi');
      }
    }
  };

  const rejectRequest = async (groupId: string, requestId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    try {
      const response = await authFetch(`/groups/${groupId}/requests/${requestId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminUserId: userId
        }),
      });

      if (response.ok) {
        // Başarılı red
        setRequests(prev => prev.filter(r => r.id !== requestId));
        showInfo('Kullanıcı reddedildi');
      } else {
        const error = await response.json();
        showError(error.error || 'Red işlemi başarısız');
      }
    } catch (error) {
      showError('Ağ hatası');
    }
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await loadGroups();
    if (selectedGroup) {
      await loadRequests(selectedGroup.id);
    }
    setRefreshing(false);
  }, [selectedGroup]);

  React.useEffect(() => {
    if (userId) {
      loadGroups();
    }
  }, [userId]);

  React.useEffect(() => {
    if (selectedGroup) {
      loadRequests(selectedGroup.id);
    }
  }, [selectedGroup]);

  // Socket.IO: Listen live for new join requests in the selected group
  React.useEffect(() => {
    if (!selectedGroup) {
      // cleanup existing socket if any
      if (socketRef.current) {
        try { socketRef.current.off(); socketRef.current.disconnect(); } catch {}
        socketRef.current = null;
      }
      return;
    }

    const s = io(API_BASE, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    socketRef.current = s;

    const join = () => {
      try { s.emit('join_group', selectedGroup.id); } catch {}
    };

    s.on('connect', join);
    s.on('reconnect', join);

    s.on('new_request', (data: { groupId: string; request: GroupRequest }) => {
      try {
        if (data.groupId !== selectedGroup.id) return;
        // Prepend new pending request if not already in the list
        setRequests(prev => {
          const exists = prev.some(r => r.id === data.request.id);
          if (exists) return prev;
          return [data.request, ...prev];
        });
        showInfo(`${data.request.displayName} yeni katılma isteği gönderdi`);
      } catch {}
    });

    // If someone approves externally, remove from pending list
    s.on('member_approved', (ev: { groupId: string; userId: string }) => {
      try {
        if (ev.groupId !== selectedGroup.id) return;
        setRequests(prev => prev.filter(r => r.userId !== ev.userId));
      } catch {}
    });

    s.on('connect_error', (e: any) => console.warn('[Admin] Socket connect error', e?.message || e));

    // If the group gets deleted elsewhere, reflect immediately in UI
    s.on('group_deleted', (ev: { groupId: string }) => {
      try {
        if (!ev || !ev.groupId) return;
        // Remove from groups list
        setGroups(prev => prev.filter(g => g.id !== ev.groupId));
        // If the currently selected group was deleted, clear selection and requests
        if (selectedGroup && selectedGroup.id === ev.groupId) {
          setSelectedGroup(null);
          setRequests([]);
          showWarning('Grup silindi');
        }
      } catch {}
    });

    return () => {
      try { s.off(); s.disconnect(); } catch {}
      socketRef.current = null;
    };
  }, [selectedGroup?.id]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      <LinearGradient colors={["#06b6d4", "#0ea5a4"]} style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.title}>Admin Paneli</Text>
            <Text style={styles.subtitle}>Grup başvurularını yönetin</Text>
          </View>
          <View style={styles.headerButtons}>
            <NetworkStatusIcon size={22} />
            {profileName ? (
              <Pressable 
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/(tabs)/profile');
                }}
                style={({ pressed }) => [
                  styles.profileButton,
                  pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] }
                ]}
                android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: true }}
              >
                <View style={[styles.profileBadge, { width: 48, height: 48, borderRadius: 24 }]}>
                  <Text style={[styles.profileBadgeText, { fontSize: 18 }]}>
                    {profileName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </Text>
                </View>
              </Pressable>
            ) : (
              <Pressable 
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/(tabs)/profile');
                }}
                style={({ pressed }) => [
                  styles.profileButton,
                  pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] }
                ]}
                android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: true }}
              >
                <View style={[styles.profileButtonFallback, { width: 48, height: 48, borderRadius: 24 }]}>
                  <Ionicons name="person" size={24} color="#fff" />
                </View>
              </Pressable>
            )}
          </View>
        </View>
      </LinearGradient>
      <ScrollView 
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <SkeletonList count={2} />
        ) : groups.length === 0 ? (
          <EmptyState
            icon="shield-outline"
            title="Henüz admin olduğunuz grup yok"
            description="Grup oluşturarak otomatik olarak admin olursunuz. Gruplar sekmesinden yeni grup oluşturun."
            actionText="Gruplar Sekmesine Git"
            onAction={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/(tabs)/groups');
            }}
          />
        ) : (
          <>
            {/* Grup Seçimi */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Gruplarınız</Text>
              {groups.map((group) => (
                <Pressable
                  key={group.id}
                  onPress={() => setSelectedGroup(group)}
                  style={[
                    styles.groupCard,
                    selectedGroup?.id === group.id && styles.groupCardSelected
                  ]}
                >
                  <View style={styles.groupHeader}>
                    <Text style={styles.groupName}>{group.name}</Text>
                    <View style={styles.groupCode}>
                      <Text style={styles.groupCodeText}>{group.code}</Text>
                    </View>
                  </View>
                  <Text style={styles.groupAddress}>{group.address}</Text>
                  <Text style={styles.groupMembers}>{group.memberCount} üye</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                    <Pressable
                      onPress={() => router.push({ pathname: '/group-map', params: { groupId: group.id, groupCode: group.code } } as any)}
                      style={{ paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#06b6d4', borderRadius: 8 }}
                    >
                      <Text style={{ color: '#fff', fontWeight: '900' }}>Haritayı Aç</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => deleteGroup(group.id)}
                      style={{ paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#dc2626', borderRadius: 8 }}
                    >
                      <Text style={{ color: '#fff', fontWeight: '900' }}>Grubu Sil</Text>
                    </Pressable>
                  </View>
                </Pressable>
              ))}
            </View>

            {/* Başvurular */}
            {selectedGroup && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Bekleyen Başvurular ({requests.length})
                </Text>
                {requests.length === 0 ? (
                  <View style={styles.noRequests}>
                    <Ionicons name="checkmark-circle-outline" size={48} color="#10b981" />
                    <Text style={styles.noRequestsText}>Bekleyen başvuru yok</Text>
                  </View>
                ) : (
                  requests.map((request) => (
                    <View key={request.id} style={styles.requestCard}>
                      <View style={styles.requestHeader}>
                        <View style={styles.userInfo}>
                          <View style={styles.avatar}>
                            <Text style={styles.avatarText}>
                              {request.displayName.slice(0, 2).toUpperCase()}
                            </Text>
                          </View>
                          <View>
                            <Text style={styles.requestName}>{request.displayName}</Text>
                            <Text style={styles.requestUserId}>ID: {request.userId}</Text>
                            <Text style={styles.requestDate}>
                              {new Date(request.requestedAt).toLocaleString('tr-TR')}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.requestActions}>
                          <Pressable
                            onPress={() => rejectRequest(selectedGroup.id, request.id)}
                            style={[styles.actionButton, styles.rejectButton]}
                          >
                            <Ionicons name="close" size={16} color="#fff" />
                            <Text style={styles.actionButtonText}>Reddet</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => approveRequest(selectedGroup.id, request.id)}
                            style={[styles.actionButton, styles.approveButton]}
                          >
                            <Ionicons name="checkmark" size={16} color="#fff" />
                            <Text style={styles.actionButtonText}>Kabul Et</Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}
          </>
        )}
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
  header: {
    paddingTop: StatusBar.currentHeight ?? 18,
    paddingHorizontal: 18,
    paddingBottom: 18,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  profileButton: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  profileButtonFallback: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.5,
    fontFamily: 'Poppins-Bold',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
    fontFamily: 'Poppins-SemiBold',
  },
  profileBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontFamily: 'Poppins-Bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loading: {
    marginTop: 50,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 100,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
    fontFamily: 'Poppins-Bold',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'Poppins-Regular',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 12,
    fontFamily: 'Poppins-Bold',
  },
  groupCard: {
    backgroundColor: '#1e293b',
    borderRadius: 22,
    padding: 22,
    marginBottom: 18,
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  groupCardSelected: {
    borderColor: '#06b6d4',
    backgroundColor: '#1e3a52',
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
    flex: 1,
    fontFamily: 'Poppins-Bold',
  },
  groupCode: {
    backgroundColor: '#e6f5f4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  groupCodeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#06b6d4',
    fontFamily: 'Poppins-Bold',
  },
  groupAddress: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 4,
    fontFamily: 'Poppins-Regular',
  },
  groupMembers: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: 'Poppins-Regular',
  },
  noRequests: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#1e293b',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  noRequestsText: {
    fontSize: 16,
    color: '#10b981',
    fontWeight: 'bold',
    marginTop: 8,
    fontFamily: 'Poppins-Bold',
  },
  requestCard: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 22,
    marginBottom: 18,
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 2,
    borderColor: '#06b6d4',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#06b6d4',
    fontFamily: 'Poppins-Bold',
  },
  requestName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#fff',
    fontFamily: 'Poppins-Bold',
  },
  requestUserId: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
    fontFamily: 'Poppins-Regular',
  },
  requestDate: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    fontFamily: 'Poppins-Regular',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  approveButton: {
    backgroundColor: '#10b981',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
