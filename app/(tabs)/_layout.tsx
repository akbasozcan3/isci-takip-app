import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import {
    Animated,
    Pressable,
    StyleSheet,
    Text,
    useWindowDimensions,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authFetch } from '../../utils/auth';

const MAX_TABBAR_WIDTH = 380;
const HORIZONTAL_MARGIN = 16;
const TABBAR_HEIGHT = 64;
const CENTER_BUTTON_SIZE = 66;
const ICON_SIZE = 24;
const TAB_ICON_SIZE = 28;
const CENTER_ICON_SIZE = 30;
const INACTIVE_ICON_COLOR = '#94a3b8';
const ACTIVE_ICON_COLOR = '#06b6d4';
const ACTIVE_TAB_COLOR = '#06b6d4';
const STATUS_BANNER_HEIGHT = 56;
const STATS_CARDS_HEIGHT = 80;

function AnimatedTabIcon({ name, focused, size = ICON_SIZE }: { name: string; focused: boolean; size?: number }) {
    const scale = React.useRef(new Animated.Value(1)).current;

    React.useEffect(() => {
        Animated.spring(scale, {
            toValue: focused ? 1.1 : 1,
            friction: 7,
            tension: 50,
            useNativeDriver: true,
        }).start();
    }, [focused]);

    return (
        <Animated.View style={{ transform: [{ scale }] }}>
            <Ionicons 
                name={name as any} 
                size={size} 
                color={focused ? ACTIVE_ICON_COLOR : INACTIVE_ICON_COLOR} 
            />
        </Animated.View>
    );
}

export default function TabLayout(): React.JSX.Element {
    const router = useRouter();
    const [isAuthenticated, setIsAuthenticated] = React.useState(false);
    const [subscription, setSubscription] = React.useState<{ planId: string; planName: string } | null>(null);
    const [statusBannerVisible, setStatusBannerVisible] = React.useState(true);
    const [stats, setStats] = React.useState({ activeWorkers: 0, totalGroups: 0 });
    const [fontsLoaded] = useFonts({
        'Poppins-Black': require('../assets/Poppins-Black.ttf'),
        'Poppins-BlackItalic': require('../assets/Poppins-BlackItalic.ttf'),
        'Poppins-Bold': require('../assets/Poppins-Bold.ttf'),
        'Poppins-BoldItalic': require('../assets/Poppins-BoldItalic.ttf'),
        'Poppins-ExtraBold': require('../assets/Poppins-ExtraBold.ttf'),
        'Poppins-ExtraBoldItalic': require('../assets/Poppins-ExtraBoldItalic.ttf'),
        'Poppins-ExtraLight': require('../assets/Poppins-ExtraLight.ttf'),
        'Poppins-ExtraLightItalic': require('../assets/Poppins-ExtraLightItalic.ttf'),
        'Poppins-Italic': require('../assets/Poppins-Italic.ttf'),
        'Poppins-Light': require('../assets/Poppins-Light.ttf'),
        'Poppins-LightItalic': require('../assets/Poppins-LightItalic.ttf'),
        'Poppins-Medium': require('../assets/Poppins-Medium.ttf'),
        'Poppins-MediumItalic': require('../assets/Poppins-MediumItalic.ttf'),
        'Poppins-Regular': require('../assets/Poppins-Regular.ttf'),
        'Poppins-SemiBold': require('../assets/Poppins-SemiBold.ttf'),
        'Poppins-SemiBoldItalic': require('../assets/Poppins-SemiBoldItalic.ttf'),
        'Poppins-Thin': require('../assets/Poppins-Thin.ttf'),
        'Poppins-ThinItalic': require('../assets/Poppins-ThinItalic.ttf'),
    });
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();

    // mount animation for the bar
    const tabBarTranslate = React.useRef(new Animated.Value(40)).current;

    const checkAuth = React.useCallback(async () => {
        const token = await SecureStore.getItemAsync('auth_token');
        if (!token) {
            router.replace('/auth/login');
            return;
        }
        setIsAuthenticated(!!token);
        
        try {
            const subscriptionRes = await authFetch('/me/subscription');
            if (subscriptionRes.ok) {
                const subData = await subscriptionRes.json();
                if (subData?.subscription) {
                    setSubscription({
                        planId: subData.subscription.planId || 'free',
                        planName: subData.subscription.planName || 'Free'
                    });
                }
            }
        } catch (err) {
            console.warn('[TabLayout] Subscription fetch error:', err);
        }

        try {
            const workerId = await SecureStore.getItemAsync('workerId');
            if (workerId) {
                const statsRes = await authFetch(`/dashboard/${workerId}`);
                if (statsRes.ok) {
                    const statsData = await statsRes.json();
                    setStats({
                        activeWorkers: statsData.activeWorkers || 0,
                        totalGroups: statsData.totalGroups || 0
                    });
                }
            }
        } catch (err) {
            console.warn('[TabLayout] Stats fetch error:', err);
        }
    }, [router]);

    React.useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    React.useEffect(() => {
        Animated.spring(tabBarTranslate, {
            toValue: 0,
            friction: 8,
            tension: 50,
            useNativeDriver: true,
        }).start();
    }, [tabBarTranslate]);

    const tabBarWidth = Math.min(MAX_TABBAR_WIDTH, width - HORIZONTAL_MARGIN * 2);
    const bottomPosition = 20 + Math.max(insets.bottom, 0);
    const statsCardsBottom = bottomPosition + TABBAR_HEIGHT + 12;
    const statusBannerBottom = statsCardsBottom + STATS_CARDS_HEIGHT + 12;
    const statusBannerTranslate = React.useRef(new Animated.Value(60)).current;
    const statsCardsTranslate = React.useRef(new Animated.Value(60)).current;

    React.useEffect(() => {
        if (statusBannerVisible) {
            Animated.spring(statusBannerTranslate, {
                toValue: 0,
                friction: 8,
                tension: 40,
                useNativeDriver: true,
            }).start();
        }
    }, [statusBannerVisible]);

    React.useEffect(() => {
        Animated.spring(statsCardsTranslate, {
            toValue: 0,
            friction: 8,
            tension: 40,
            useNativeDriver: true,
        }).start();
    }, []);

    return (
        <View style={{ flex: 1, backgroundColor: '#0a0e1a' }}>
            <Animated.View
                style={[
                    styles.statsCardsContainer,
                    {
                        width: tabBarWidth,
                        bottom: statsCardsBottom,
                        transform: [{ translateY: statsCardsTranslate }],
                    },
                ]}
            >
                <Pressable
                    style={styles.statsCard}
                    onPress={() => router.push('/(tabs)/index' as any)}
                    android_ripple={{ color: 'rgba(6,182,212,0.15)', radius: 30 }}
                >
                    <LinearGradient
                        colors={['#10b981', '#059669']}
                        style={styles.statsCardGradient}
                        start={[0, 0]}
                        end={[1, 1]}
                    >
                        <Ionicons name="navigate" size={24} color="#fff" />
                    </LinearGradient>
                    <View style={styles.statsCardContent}>
                        <Text style={styles.statsCardValue}>{stats.activeWorkers}</Text>
                        <Text style={styles.statsCardLabel}>Aktif İşçi</Text>
                    </View>
                </Pressable>
                <Pressable
                    style={styles.statsCard}
                    onPress={() => router.push('/(tabs)/groups' as any)}
                    android_ripple={{ color: 'rgba(245,158,11,0.15)', radius: 30 }}
                >
                    <LinearGradient
                        colors={['#f59e0b', '#d97706']}
                        style={styles.statsCardGradient}
                        start={[0, 0]}
                        end={[1, 1]}
                    >
                        <Ionicons name="warning" size={24} color="#fff" />
                    </LinearGradient>
                    <View style={styles.statsCardContent}>
                        <Text style={styles.statsCardValue}>{stats.totalGroups}</Text>
                        <Text style={styles.statsCardLabel}>Toplam Grup</Text>
                    </View>
                </Pressable>
            </Animated.View>
            {statusBannerVisible && (
                <Animated.View
                    style={[
                        styles.statusBanner,
                        {
                            width: tabBarWidth,
                            bottom: statusBannerBottom,
                            transform: [{ translateY: statusBannerTranslate }],
                        },
                    ]}
                >
                    <View style={styles.statusBannerContent}>
                        <View style={styles.statusBadge}>
                            <Ionicons name="shield-checkmark" size={18} color="#10b981" />
                            <Text style={styles.statusText}>Aktif ve Doğrulanma</Text>
                        </View>
                        <Pressable
                            onPress={() => router.push('/UpgradeScreen' as any)}
                            style={({ pressed }) => [
                                styles.proButton,
                                pressed && styles.proButtonPressed,
                            ]}
                            android_ripple={{ color: 'rgba(192, 132, 252, 0.15)', radius: 22 }}
                        >
                            <Ionicons name="sparkles" size={15} color="#c084fc" />
                            <Text style={styles.proButtonText}>Pro avantajları</Text>
                        </Pressable>
                    </View>
                </Animated.View>
            )}
            <Tabs
                screenOptions={{
                    headerShown: false,
                    tabBarShowLabel: false,
                    tabBarStyle: [
                        styles.tabBar,
                        {
                            maxWidth: MAX_TABBAR_WIDTH,
                            width: tabBarWidth,
                            bottom: bottomPosition,
                            alignSelf: 'center',
                            transform: [{ translateY: tabBarTranslate }],
                            borderTopWidth: 0,
                            borderTopColor: 'transparent',
                            elevation: 20,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: -4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 12,
                        },
                    ],
                }}
            >
                <Tabs.Screen
                    name="index"
                    options={{
                        tabBarIcon: ({ focused }) => (
                            <View style={styles.tabIconContainer}>
                                {focused && <View style={styles.activeIndicator} />}
                                <AnimatedTabIcon name={focused ? 'home' : 'home-outline'} focused={focused} size={TAB_ICON_SIZE} />
                            </View>
                        ),
                    }}
                />
                <Tabs.Screen
                    name="groups"
                    options={{
                        tabBarIcon: ({ focused }) => (
                            <View style={styles.tabIconContainer}>
                                {focused && <View style={styles.activeIndicator} />}
                                <AnimatedTabIcon name={focused ? 'people' : 'people-outline'} focused={focused} size={TAB_ICON_SIZE} />
                            </View>
                        ),
                    }}
                />
                <Tabs.Screen
                    name="settings"
                    options={{
                        tabBarIcon: ({ focused }) => (
                            <View style={styles.tabIconContainer}>
                                {focused && <View style={styles.activeIndicator} />}
                                <AnimatedTabIcon name={focused ? 'settings' : 'settings-outline'} focused={focused} size={TAB_ICON_SIZE} />
                            </View>
                        ),
                    }}
                />
                <Tabs.Screen
                    name="track"
                    options={{
                        tabBarIcon: () => null,
                        tabBarButton: (props) => {
                            const scaleAnim = React.useRef(new Animated.Value(1)).current;
                            const handlePressIn = () => {
                                Animated.spring(scaleAnim, {
                                    toValue: 0.9,
                                    friction: 6,
                                    tension: 40,
                                    useNativeDriver: true,
                                }).start();
                            };
                            const handlePressOut = () => {
                                Animated.spring(scaleAnim, {
                                    toValue: 1,
                                    friction: 6,
                                    tension: 40,
                                    useNativeDriver: true,
                                }).start();
                            };
                            return (
                                <View style={styles.centerButtonWrapper} pointerEvents="box-none">
                                    <Pressable
                                        {...(props as any)}
                                        onPressIn={handlePressIn}
                                        onPressOut={handlePressOut}
                                        android_ripple={{ color: 'rgba(255,255,255,0.25)', radius: 42 }}
                                        style={styles.centerButton}
                                    >
                                        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                                            <LinearGradient
                                                colors={[ACTIVE_TAB_COLOR, '#0891b2', '#0e7490']}
                                                style={styles.centerButtonGradient}
                                                start={[0, 0]}
                                                end={[1, 1]}
                                            >
                                                <View style={styles.centerButtonInner}>
                                                    <Ionicons name="navigate" size={CENTER_ICON_SIZE} color="#fff" />
                                                </View>
                                            </LinearGradient>
                                        </Animated.View>
                                    </Pressable>
                                </View>
                            );
                        },
                    }}
                />
                <Tabs.Screen
                    name="admin"
                    options={{
                        tabBarIcon: ({ focused }) => (
                            <View style={styles.tabIconContainer}>
                                {focused && <View style={styles.activeIndicator} />}
                                <AnimatedTabIcon name={focused ? 'shield-checkmark' : 'shield-checkmark-outline'} focused={focused} size={TAB_ICON_SIZE} />
                            </View>
                        ),
                    }}
                />
                <Tabs.Screen
                    name="location-features"
                    options={{
                        tabBarIcon: ({ focused }) => (
                            <View style={styles.tabIconContainer}>
                                {focused && <View style={styles.activeIndicator} />}
                                <AnimatedTabIcon name={focused ? 'location' : 'location-outline'} focused={focused} size={TAB_ICON_SIZE} />
                            </View>
                        ),
                    }}
                />
                <Tabs.Screen
                    name="analytics"
                    options={{
                        tabBarIcon: ({ focused }) => (
                            <View style={styles.tabIconContainer}>
                                {focused && <View style={styles.activeIndicator} />}
                                <AnimatedTabIcon name={focused ? 'stats-chart' : 'stats-chart-outline'} focused={focused} size={TAB_ICON_SIZE} />
                            </View>
                        ),
                    }}
                />
            </Tabs>
        </View>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        position: 'absolute',
        height: TABBAR_HEIGHT,
        borderRadius: 20,
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        alignItems: 'center',
        justifyContent: 'space-evenly',
        overflow: 'visible',
        marginLeft: HORIZONTAL_MARGIN,
        marginRight: HORIZONTAL_MARGIN,
        paddingHorizontal: 4,
        paddingVertical: 10,
        flexDirection: 'row',
        borderWidth: 1,
        borderColor: 'rgba(148, 163, 184, 0.12)',
        borderTopWidth: 1,
        borderTopColor: 'rgba(148, 163, 184, 0.1)',
    },
    tabIconContainer: {
        position: 'relative',
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    activeIndicator: {
        position: 'absolute',
        bottom: -2,
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: ACTIVE_TAB_COLOR,
    },
    centerButtonWrapper: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: -CENTER_BUTTON_SIZE / 2,
        height: CENTER_BUTTON_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
        pointerEvents: 'box-none',
    },
    centerButton: {
        width: CENTER_BUTTON_SIZE,
        height: CENTER_BUTTON_SIZE,
        borderRadius: CENTER_BUTTON_SIZE / 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    centerButtonGradient: {
        width: CENTER_BUTTON_SIZE,
        height: CENTER_BUTTON_SIZE,
        borderRadius: CENTER_BUTTON_SIZE / 2,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: ACTIVE_TAB_COLOR,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    centerButtonInner: {
        width: CENTER_BUTTON_SIZE,
        height: CENTER_BUTTON_SIZE,
        borderRadius: CENTER_BUTTON_SIZE / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    statusBanner: {
        position: 'absolute',
        alignSelf: 'center',
        height: STATUS_BANNER_HEIGHT,
        borderRadius: 20,
        backgroundColor: '#0a0e1a',
        paddingHorizontal: 18,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 0.5,
        borderColor: 'rgba(148, 163, 184, 0.08)',
    },
    statusBannerContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    statusText: {
        color: '#10b981',
        fontSize: 15,
        fontWeight: '600',
        fontFamily: 'Poppins-SemiBold',
        letterSpacing: 0.2,
    },
    proButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(192, 132, 252, 0.12)',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 16,
        borderWidth: 0.5,
        borderColor: 'rgba(192, 132, 252, 0.2)',
    },
    proButtonPressed: {
        transform: [{ scale: 0.95 }],
        opacity: 0.85,
    },
    proButtonText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '600',
        fontFamily: 'Poppins-SemiBold',
        letterSpacing: 0.1,
    },
    statsCardsContainer: {
        position: 'absolute',
        alignSelf: 'center',
        height: STATS_CARDS_HEIGHT,
        flexDirection: 'row',
        gap: 12,
    },
    statsCard: {
        flex: 1,
        height: STATS_CARDS_HEIGHT,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(148, 163, 184, 0.08)',
    },
    statsCardGradient: {
        width: '100%',
        height: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        gap: 12,
    },
    statsCardContent: {
        flex: 1,
    },
    statsCardValue: {
        fontSize: 24,
        fontWeight: '900',
        color: '#fff',
        fontFamily: 'Poppins-ExtraBold',
        letterSpacing: 0.3,
    },
    statsCardLabel: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.9)',
        fontWeight: '700',
        fontFamily: 'Poppins-Bold',
        marginTop: 2,
    },
});
