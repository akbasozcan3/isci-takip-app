import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { Tabs } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { authFetch } from '../../utils/auth';
import { setOneSignalExternalUserId } from '../../utils/onesignal';
import { markUserActive } from '../../utils/onesignalSegments';
import PremiumTabBar from '../../components/ui/PremiumTabBar';

export default function TabLayout(): React.JSX.Element {
    // Local avatar state - no ProfileProvider dependency
    const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null);

    const [fontsLoaded] = useFonts({
        // 'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    });

    // Load avatar from SecureStore
    React.useEffect(() => {
        const loadAvatar = async () => {
            try {
                const saved = await SecureStore.getItemAsync('avatarUrl');
                if (saved) setAvatarUrl(saved);
            } catch (error) {
                console.log('[TabLayout] Failed to load avatar:', error);
            }
        };
        loadAvatar();
    }, []);

    const initializeBackend = React.useCallback(async () => {
        try {
            const token = await SecureStore.getItemAsync('auth_token');
            if (token) {
                const workerId = await SecureStore.getItemAsync('workerId');
                if (workerId) {
                    setOneSignalExternalUserId(workerId).catch(() => { });
                    markUserActive().catch(() => { });
                    authFetch(`/dashboard/${workerId}`).catch(() => { });
                }
            }
        } catch (err) { }
    }, []);

    React.useEffect(() => {
        initializeBackend();
    }, [initializeBackend]);

    return (
        <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
            <Tabs
                tabBar={(props) => <PremiumTabBar {...props} />}
                screenOptions={{
                    headerShown: false,
                    tabBarShowLabel: false,
                }}
            >
                {/* LEFT GROUP (4 items) */}
                <Tabs.Screen
                    name="index"
                    options={{
                        tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />
                    }}
                />
                <Tabs.Screen
                    name="groups"
                    options={{
                        tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />
                    }}
                />
                <Tabs.Screen
                    name="messages"
                    options={{
                        tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" size={size} color={color} />
                    }}
                />
                <Tabs.Screen
                    name="location-features"
                    options={{
                        tabBarIcon: ({ color, size }) => <Ionicons name="map" size={size} color={color} />
                    }}
                />

                {/* CENTER (1 item) - Handled internally by PremiumTabBar, but needs to be here for routing */}
                <Tabs.Screen
                    name="track"
                    options={{
                        // Icon not used by PremiumTabBar for center item
                        tabBarIcon: ({ color, size }) => <Ionicons name="navigate" size={size} color={color} />,
                    }}
                />

                {/* RIGHT GROUP (4 items) */}
                <Tabs.Screen
                    name="analytics"
                    options={{
                        tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart" size={size} color={color} />
                    }}
                />
                <Tabs.Screen
                    name="steps"
                    options={{
                        tabBarIcon: ({ color, size }) => <Ionicons name="walk" size={size} color={color} />
                    }}
                />
                <Tabs.Screen
                    name="admin"
                    options={{
                        tabBarIcon: ({ color, size }) => <Ionicons name="shield-checkmark" size={size} color={color} />
                    }}
                />
                <Tabs.Screen
                    name="profile"
                    options={{
                        tabBarIcon: ({ color, size, focused }) => (
                            <View style={styles.iconContainer}>
                                {avatarUrl ? (
                                    <View style={[styles.avatarRing, focused && styles.avatarRingActive]}>
                                        <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                                    </View>
                                ) : (
                                    <Ionicons name="person-circle" size={28} color={color} />
                                )}
                            </View>
                        )
                    }}
                />
            </Tabs>
        </View>
    );
}

const styles = StyleSheet.create({
    iconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
    },
    avatarRing: {
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.15)',
        overflow: 'hidden',
        shadowColor: '#0369a1',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    avatarRingActive: {
        borderColor: '#0369a1',
        borderWidth: 2.5,
        shadowOpacity: 0.5,
        shadowRadius: 8,
        elevation: 6,
    },
    avatar: {
        width: '100%',
        height: '100%',
    }
});
