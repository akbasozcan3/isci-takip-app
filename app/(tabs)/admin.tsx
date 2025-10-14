import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import { io, Socket } from 'socket.io-client';
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
import { EmptyState } from '../../components/EmptyState';
import { SkeletonList } from '../../components/SkeletonLoader';
import { Toast, useToast } from '../../components/Toast';
import { getApiBase } from '../../utils/api';
import { authFetch } from '../../utils/auth';
import ProfileBadge from '../../components/ProfileBadge';

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
  const [loading, setLoading] = React.useState(false);
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
            const r = await authFetch('/auth/me');
            if (r.ok) {
              const { user } = await r.json();
              if (user && user.name) setProfileName(user.name);
            }
          } catch {}
        }
      } catch (error) {
        console.error('Error loading user ID:', error);
      }
    };
    loadUserId();
  }, []);

  const loadGroups = async () => {
    if (!userId) {
      console.log('[Admin] Cannot load groups, no userId');
      setLoading(false);
      return;
    }
    
    console.log('[Admin] Loading admin groups for user:', userId);
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/groups/user/${userId}/admin`);
      console.log('[Admin] Groups response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('[Admin] Loaded groups:', data?.length || 0);
        setGroups(data);
      } else {
        console.warn('[Admin] Failed to load groups');
        setGroups([]);
      }
    } catch (error) {
      console.error('[Admin] Error loading groups:', error);
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  const loadRequests = async (groupId: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/groups/${groupId}/requests`);
      if (response.ok) {
        const data = await response.json();
        setRequests(data);
      } else {
        setRequests([]);
      }
    } catch (error) {
      console.error('Error loading requests:', error);
      setRequests([]);
    }
  };

  const approveRequest = async (groupId: string, requestId: string) => {
    console.log('[Admin] Approving request:', requestId, 'for group:', groupId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      const response = await fetch(`${API_BASE}/api/groups/${groupId}/requests/${requestId}/approve`, {
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
    } catch (error) {
      console.error('[Admin] Approve request error:', error);
      showError('Ağ hatası');
    }
  };

  const rejectRequest = async (groupId: string, requestId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    try {
      const response = await fetch(`${API_BASE}/api/groups/${groupId}/requests/${requestId}/reject`, {
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
          {profileName ? <ProfileBadge name={profileName} size={48} /> : <ProfileBadge size={48} />}
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
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  profileBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  profileBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
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
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 12,
  },
  groupCard: {
    backgroundColor: '#1e293b',
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
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
  },
  groupAddress: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 4,
  },
  groupMembers: {
    fontSize: 12,
    color: '#64748b',
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
  },
  requestCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
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
  },
  requestName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#fff',
  },
  requestUserId: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  requestDate: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
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
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  rejectButton: {
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
