import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
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
import { FullScreenMap } from '../../components/FullScreenMap';
import { NetworkStatusIcon } from '../../components/NetworkStatusIcon';
import { Toast, useToast } from '../../components/Toast';
import { UnifiedHeader } from '../../components/UnifiedHeader';
import { useProfile } from '../../contexts/ProfileContext';

// Skeleton loader placeholder
const SkeletonList = ({ count = 5 }: { count?: number }) => (
  <View>
    {[...Array(count)].map((_, i) => (
      <View key={i} style={{ height: 80, backgroundColor: '#1e293b', marginBottom: 8, borderRadius: 12 }} />
    ))}
  </View>
);
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
  const { userName: profileName, avatarUrl } = useProfile();
  const { toast, showError, showSuccess, showWarning, showInfo, hideToast } = useToast();
  const [groups, setGroups] = React.useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = React.useState<Group | null>(null);
  const [requests, setRequests] = React.useState<GroupRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [userId, setUserId] = React.useState('');
  const [userName, setUserName] = React.useState<string>('');
  const [showMap, setShowMap] = React.useState(false);
  const [selectedMapGroup, setSelectedMapGroup] = React.useState<Group | null>(null);
  const socketRef = React.useRef<Socket | null>(null);

  const initials = React.useMemo(() => {
    if (!userName) return '';
    return userName
      .split(' ')
      .map((s) => s[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }, [userName]);

  React.useEffect(() => {
    const loadUserId = async () => {
      try {
        const stored = await SecureStore.getItemAsync('workerId');

        // ÖNCE SecureStore'dan displayName oku (groups.tsx'deki gibi)
        const storedDisplayName = await SecureStore.getItemAsync('displayName');
        if (storedDisplayName) {
          setUserName(storedDisplayName);
        }

        if (stored) {
          setUserId(stored);
          try {
            const r = await authFetch('/users/me');
            if (r.ok) {
              const { user } = await r.json();
              if (user) {
                // displayName öncelikli, yoksa name, yoksa email kullan
                const profileDisplayName = user.displayName || user.name || user.email || '';
                if (profileDisplayName) {
                  setUserName(profileDisplayName);
                  // SecureStore'a da kaydet (index.tsx'deki gibi)
                  await SecureStore.setItemAsync('displayName', profileDisplayName);
                }
              }
            }
          } catch { }
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
      // Timeout ekle (5 saniye - daha hızlı)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const { authFetch } = await import('../../utils/auth');
      const response = await authFetch(`/groups/user/${userId}/admin`);
      clearTimeout(timeoutId);

      console.log('[Admin] Groups response status:', response.status);

      // Handle 404 - endpoint doesn't exist yet
      if (response.status === 404) {
        console.log('[Admin] Admin groups endpoint not yet implemented, showing empty state');
        setGroups([]);
        setLoading(false);
        return;
      }

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
        try { socketRef.current.off(); socketRef.current.disconnect(); } catch { }
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
      try { s.emit('join_group', selectedGroup.id); } catch { }
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
      } catch { }
    });

    // If someone approves externally, remove from pending list
    s.on('member_approved', (ev: { groupId: string; userId: string }) => {
      try {
        if (ev.groupId !== selectedGroup.id) return;
        setRequests(prev => prev.filter(r => r.userId !== ev.userId));
      } catch { }
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
      } catch { }
    });

    return () => {
      try { s.off(); s.disconnect(); } catch { }
      socketRef.current = null;
    };
  }, [selectedGroup?.id]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <UnifiedHeader
        title="Admin Panel"
        subtitle="Grup yönetimi ve başvurular"
        gradientColors={['#06b6d4', '#0891b2']}
        brandLabel="ADMIN"
        profileName={profileName || userName || 'Admin'}
        avatarUrl={avatarUrl}
        showProfile={true}
        showNetwork={true}
      />
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
                  style={({ pressed }) => [
                    styles.groupCardContainer,
                    selectedGroup?.id === group.id && styles.groupCardSelectedContainer,
                    pressed && { transform: [{ scale: 0.98 }] }
                  ]}
                >
                  <LinearGradient
                    colors={selectedGroup?.id === group.id
                      ? ['rgba(6, 182, 212, 0.15)', 'rgba(6, 182, 212, 0.05)']
                      : ['rgba(30, 41, 59, 0.7)', 'rgba(15, 23, 42, 0.6)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.groupCardGradient}
                  >
                    <View style={styles.groupHeader}>
                      <Text style={styles.groupName}>{group.name}</Text>
                      <View style={styles.groupCode}>
                        <Text style={styles.groupCodeText}>{group.code}</Text>
                      </View>
                    </View>

                    <View style={styles.groupInfoRow}>
                      <Ionicons name="location-outline" size={14} color="#94a3b8" />
                      <Text style={styles.groupAddress} numberOfLines={1}>{group.address}</Text>
                    </View>

                    <View style={styles.groupStatsRow}>
                      <View style={styles.statBadge}>
                        <Ionicons name="people" size={12} color="#fff" />
                        <Text style={styles.statText}>{group.memberCount} Üye</Text>
                      </View>
                      <View style={[styles.statBadge, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
                        <Ionicons name="shield-checkmark" size={12} color="#10b981" />
                        <Text style={[styles.statText, { color: '#10b981' }]}>Admin</Text>
                      </View>
                    </View>

                    <View style={styles.cardActions}>
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setSelectedMapGroup(group);
                          setShowMap(true);
                        }}
                        style={({ pressed }) => [
                          styles.actionButtonGlass,
                          pressed && { backgroundColor: 'rgba(255,255,255,0.15)' }
                        ]}
                      >
                        <Ionicons name="map" size={16} color="#0EA5E9" />
                        <Text style={styles.actionButtonGlassText}>Harita</Text>
                      </Pressable>

                      <View style={styles.verticalDivider} />

                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          router.push({
                            pathname: `/groups/${group.id}/chat`,
                            params: { id: group.id, name: group.name }
                          });
                        }}
                        style={({ pressed }) => [
                          styles.actionButtonGlass,
                          pressed && { backgroundColor: 'rgba(139, 92, 246, 0.15)' }
                        ]}
                      >
                        <Ionicons name="chatbubbles" size={16} color="#8b5cf6" />
                        <Text style={[styles.actionButtonGlassText, { color: '#8b5cf6' }]}>Mesaj</Text>
                      </Pressable>

                      <View style={styles.verticalDivider} />

                      <Pressable
                        onPress={() => deleteGroup(group.id)}
                        style={({ pressed }) => [
                          styles.actionButtonGlass,
                          pressed && { backgroundColor: 'rgba(239, 68, 68, 0.15)' }
                        ]}
                      >
                        <Ionicons name="trash-outline" size={16} color="#ef4444" />
                        <Text style={[styles.actionButtonGlassText, { color: '#ef4444' }]}>Sil</Text>
                      </Pressable>
                    </View>
                  </LinearGradient>
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

      <FullScreenMap
        visible={showMap}
        onClose={() => {
          setShowMap(false);
          setSelectedMapGroup(null);
        }}
        groupId={selectedMapGroup?.id}
        userId={userId}
      />
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
  groupCardContainer: {
    borderRadius: 24,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  groupCardSelectedContainer: {
    borderColor: '#0EA5E9',
    shadowColor: '#0EA5E9',
    shadowOpacity: 0.25,
  },
  groupCardGradient: {
    padding: 20,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff',
    flex: 1,
    marginRight: 12,
    fontFamily: 'Poppins-Bold',
    letterSpacing: 0.3,
  },
  groupCode: {
    backgroundColor: 'rgba(6, 182, 212, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.4)',
  },
  groupCodeText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#06b6d4',
    fontFamily: 'Poppins-Bold',
    letterSpacing: 0.5,
  },
  groupAddress: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 4,
    fontFamily: 'Poppins-Regular',
  },
  groupInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  groupStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
  },
  cardActions: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 16,
    padding: 4,
  },
  actionButtonGlass: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
    borderRadius: 12,
  },
  verticalDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 4,
  },
  actionButtonGlassText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0EA5E9',
    fontFamily: 'Poppins-SemiBold',
  },
  groupMembers: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: 'Poppins-Regular',
  },
  mapButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#0EA5E9',
    borderRadius: 12,
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  mapButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
    fontFamily: 'Poppins-Bold',
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#dc2626',
    borderRadius: 12,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
    fontFamily: 'Poppins-Bold',
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
    borderColor: '#0EA5E9',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0EA5E9',
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
