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
    useWindowDimensions,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authFetch } from '../../utils/auth';
import { setOneSignalExternalUserId } from '../../utils/onesignal';
import { markUserActive } from '../../utils/onesignalSegments';

const TABBAR_HEIGHT = 85;
const CENTER_BUTTON_SIZE = 85;
const TAB_ICON_SIZE = 30;
const CENTER_ICON_SIZE = 36;
const INACTIVE_ICON_COLOR = '#94a3b8';
const ACTIVE_ICON_COLOR = '#06b6d4';
const ACTIVE_TAB_COLOR = '#06b6d4';
const CENTER_BUTTON_BOTTOM = -15;

function AnimatedTabIcon({ name, focused, size }: { name: string; focused: boolean; size: number }) {
    const scale = React.useRef(new Animated.Value(1)).current;
    const opacity = React.useRef(new Animated.Value(focused ? 1 : 0.7)).current;
    const glow = React.useRef(new Animated.Value(focused ? 1 : 0)).current;

    React.useEffect(() => {
        Animated.parallel([
            Animated.spring(scale, {
                toValue: focused ? 1.2 : 1,
                friction: 7,
                tension: 70,
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: focused ? 1 : 0.7,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(glow, {
                toValue: focused ? 1 : 0,
                duration: 250,
                useNativeDriver: false,
            }),
        ]).start();
    }, [focused]);

    const glowOpacity = glow.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.4],
    });

    return (
        <Animated.View style={{ transform: [{ scale }], opacity }}>
            <Ionicons 
                name={name as any} 
                size={size} 
                color={focused ? ACTIVE_ICON_COLOR : INACTIVE_ICON_COLOR} 
            />
            {focused && (
                <Animated.View
                    style={[
                        {
                            position: 'absolute',
                            width: size + 8,
                            height: size + 8,
                            borderRadius: (size + 8) / 2,
                            backgroundColor: ACTIVE_ICON_COLOR,
                            opacity: glowOpacity,
                            top: -4,
                            left: -4,
                        },
                    ]}
                />
            )}
        </Animated.View>
    );
}

export default function TabLayout(): React.JSX.Element {
    const router = useRouter();
    useFonts({
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

    const tabBarTranslate = React.useRef(new Animated.Value(60)).current;
    const centerButtonScale = React.useRef(new Animated.Value(1)).current;

    const initializeBackend = React.useCallback(async () => {
        try {
            const token = await SecureStore.getItemAsync('auth_token');
            if (!token) {
                router.replace('/auth/login');
                return;
            }
            
            const workerId = await SecureStore.getItemAsync('workerId');
            if (workerId) {
                await setOneSignalExternalUserId(workerId);
                markUserActive();
                
                // Sync OneSignal Player ID with backend (throttled in helper)
                // Only sync once per session to prevent rate limiting
                setTimeout(async () => {
                    try {
                        const { getPlayerId, sendPlayerIdToBackend } = await import('../../utils/onesignalHelpers');
                        const playerId = await getPlayerId();
                        if (playerId) {
                            await sendPlayerIdToBackend(playerId, workerId);
                            console.log('[TabLayout] OneSignal Player ID synced:', playerId);
                        }
                    } catch (onesignalError) {
                        console.warn('[TabLayout] OneSignal Player ID sync error:', onesignalError);
                    }
                }, 3000);
                
                const statsRes = await authFetch(`/dashboard/${workerId}`);
                if (statsRes.ok) {
                    const statsData = await statsRes.json();
                    console.log('[TabLayout] Dashboard data loaded:', statsData);
                }
            }
        } catch (err: any) {
            // Silently handle network errors
            const { isNetworkError } = await import('../../utils/network');
            if (!isNetworkError(err)) {
                console.warn('[TabLayout] Initialization error:', err);
            }
        }
    }, [router]);

    React.useEffect(() => {
        initializeBackend();
    }, [initializeBackend]);

    React.useEffect(() => {
        Animated.spring(tabBarTranslate, {
            toValue: 0,
            friction: 8,
            tension: 55,
            useNativeDriver: true,
        }).start();
    }, []);

    const tabBarBottomPadding = Math.max(insets.bottom, 0);

    return (
        <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
            <Tabs
                screenOptions={{
                    headerShown: false,
                    tabBarShowLabel: false,
                    tabBarStyle: [
                        styles.tabBar,
                        {
                            width: width,
                            bottom: 0,
                            paddingBottom: tabBarBottomPadding,
                            height: TABBAR_HEIGHT + tabBarBottomPadding,
                            transform: [{ translateY: tabBarTranslate }],
                            borderTopWidth: 0,
                            borderTopColor: 'transparent',
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
                    name="profile"
                    options={{
                        href: null,
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
                    name="track"
                    options={{
                        tabBarIcon: () => null,
                        tabBarButton: (props) => {
                            const handlePressIn = () => {
                                Animated.spring(centerButtonScale, {
                                    toValue: 0.86,
                                    friction: 5,
                                    tension: 65,
                                    useNativeDriver: true,
                                }).start();
                            };
                            const handlePressOut = () => {
                                Animated.spring(centerButtonScale, {
                                    toValue: 1,
                                    friction: 6,
                                    tension: 65,
                                    useNativeDriver: true,
                                }).start();
                            };
                            return (
                                <View style={styles.centerButtonWrapper} pointerEvents="box-none">
                                    <Pressable
                                        {...(props as any)}
                                        onPressIn={handlePressIn}
                                        onPressOut={handlePressOut}
                                        android_ripple={{ color: 'rgba(255,255,255,0.3)', radius: 45 }}
                                        style={styles.centerButton}
                                    >
                                        <Animated.View style={{ transform: [{ scale: centerButtonScale }] }}>
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
                <Tabs.Screen
                    name="steps"
                    options={{
                        tabBarIcon: ({ focused }) => (
                            <View style={styles.tabIconContainer}>
                                {focused && <View style={styles.activeIndicator} />}
                                <AnimatedTabIcon name={focused ? 'walk' : 'walk-outline'} focused={focused} size={TAB_ICON_SIZE} />
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
        borderTopLeftRadius: 38,
        borderTopRightRadius: 38,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        alignItems: 'center',
        justifyContent: 'space-evenly',
        overflow: 'visible',
        paddingHorizontal: 0,
        paddingTop: 18,
        paddingBottom: 10,
        flexDirection: 'row',
        borderTopWidth: 1.5,
        borderLeftWidth: 0,
        borderRightWidth: 0,
        borderBottomWidth: 0,
        borderColor: 'rgba(148, 163, 184, 0.25)',
    },
    tabIconContainer: {
        position: 'relative',
        width: 82,
        height: TABBAR_HEIGHT - 28,
        top: -8,
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
    },
    activeIndicator: {
        position: 'absolute',
        bottom: -18,
        width: 40,
        height: 5,
        borderRadius: 1.5,
        backgroundColor: ACTIVE_TAB_COLOR,
    },
    centerButtonWrapper: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: CENTER_BUTTON_BOTTOM,
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
    },
    centerButtonInner: {
        width: CENTER_BUTTON_SIZE - 7,
        height: CENTER_BUTTON_SIZE - 7,
        borderRadius: (CENTER_BUTTON_SIZE - 7) / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
});
