import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import {
    Animated,
    Platform,
    Pressable,
    StyleSheet,
    useWindowDimensions,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Profesyonel, responsive ve görsel olarak rafine edilmiş TabLayout (Expo + React Native)
// Eklemeler:
// - Tab bar için hafif mount animasyonu (slide-up)
// - Aktif ikon arka planı için gradient
// - Daha iyi gölge/elevation ve renk paleti (mor -> teal geçişli accent)
// - Küçük görsel polisher'lar (ikon renkleri, scale efektleri)

const MAX_TABBAR_WIDTH = 760;
const HORIZONTAL_MARGIN = 20;
const TABBAR_HEIGHT = 84;
const CENTER_BUTTON_SIZE = 80;

function AnimatedTabIcon({ name, focused }: { name: string; focused: boolean }) {
    const scale = React.useRef(new Animated.Value(focused ? 1.06 : 1)).current;
    const translateY = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        Animated.parallel([
            Animated.spring(scale, {
                toValue: focused ? 1.06 : 1,
                friction: 9,
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: focused ? -2 : 0,
                duration: 160,
                useNativeDriver: true,
            }),
        ]).start();
    }, [focused]);

    return (
        <Animated.View style={{ transform: [{ scale }, { translateY }] }}>
            <Ionicons name={name as any} size={24} color={focused ? '#fff' : '#64748b'} />
        </Animated.View>
    );
}

export default function TabLayout(): React.JSX.Element {
    console.log('[TabLayout] Component rendering');
    const router = useRouter();
    const [isAuthenticated, setIsAuthenticated] = React.useState(false);

    React.useEffect(() => {
        console.log('[TabLayout] Component mounted, checking auth...');
        checkAuth();
    }, []);

    const checkAuth = async () => {
        console.log('[TabLayout] Checking authentication...');
        const token = await SecureStore.getItemAsync('auth_token');
        console.log('[TabLayout] auth_token exists:', !!token);
        
        if (!token) {
            console.log('[TabLayout] No token found, redirecting to login');
            router.replace('/auth/login');
            return;
        }
        
        setIsAuthenticated(!!token);
        console.log('[TabLayout] Is authenticated:', !!token);
    };

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

    const tabBarWidth = Math.min(MAX_TABBAR_WIDTH, width - HORIZONTAL_MARGIN * 2);
    const bottomPosition = 18 + Math.max(insets.bottom, 0);

    // mount animation for the bar
    const tabBarTranslate = React.useRef(new Animated.Value(40)).current;
    React.useEffect(() => {
        console.log('[TabLayout] Starting tab bar animation');
        Animated.timing(tabBarTranslate, {
            toValue: 0,
            duration: 420,
            useNativeDriver: true,
        }).start(() => {
            console.log('[TabLayout] Tab bar animation completed');
        });
    }, []);

    return (
        <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
            <Tabs
                screenOptions={{
                    headerShown: false,
                    headerTitleAlign: 'left',
                    headerShadowVisible: false,
                    headerStyle: { backgroundColor: '#1e293b' },
                    headerTitleStyle: { color: '#ffffff', fontWeight: '700', fontSize: 18, fontFamily: 'Poppins-Bold' },
                    headerTintColor: '#ffffff',
                    animation: 'shift',
                    tabBarShowLabel: false,
                    tabBarStyle: [
                        styles.tabBar,
                        {
                            maxWidth: MAX_TABBAR_WIDTH,
                            width: tabBarWidth,
                            bottom: bottomPosition,
                            alignSelf: 'center',
                            transform: [{ translateY: tabBarTranslate }],
                        },
                    ],
                }}
            >
       
                <Tabs.Screen
                    name="index"
                    options={{
                        title: 'Ana Sayfa',
                        tabBarIcon: ({ focused }) => (
                            focused ? (
                                <LinearGradient colors={["#7c3aed", "#06b6d4"]} style={styles.iconGradientActive} start={[0, 0]} end={[1, 1]}>
                                    <AnimatedTabIcon name={'home'} focused={focused} />
                                </LinearGradient>
                            ) : (
                                <View style={[styles.iconWrapper, styles.iconWrapperInactive]}>
                                    <AnimatedTabIcon name={'home-outline'} focused={focused} />
                                </View>
                            )
                        ),
                        tabBarAccessibilityLabel: 'Ana Sayfa',
                    }}
                />
                <Tabs.Screen
                    name="groups"
                    options={{
                        title: 'Gruplar',
                        tabBarIcon: ({ focused }) => (
                            focused ? (
                                <LinearGradient colors={["#7c3aed", "#06b6d4"]} style={styles.iconGradientActive} start={[0, 0]} end={[1, 1]}>
                                    <AnimatedTabIcon name={'people'} focused={focused} />
                                </LinearGradient>
                            ) : (
                                <View style={[styles.iconWrapper, styles.iconWrapperInactive]}>
                                    <AnimatedTabIcon name={'people-outline'} focused={focused} />
                                </View>
                            )
                        ),
                        tabBarAccessibilityLabel: 'Gruplar',
                    }}
                />
                <Tabs.Screen
                    name="track"
                    options={{
                        title: 'Takip',
                        tabBarIcon: ({ focused }) => (
                            <View style={styles.centerIconInner} pointerEvents="none">
                                <Ionicons name={focused ? 'navigate' : 'navigate-outline'} size={30} color="#fff" />
                            </View>
                        ),
                        tabBarButton: (props) => (
                            <View style={styles.centerButtonContainer} pointerEvents="box-none">
                                <Pressable
                                    {...(props as any)}
                                    android_ripple={{ color: 'rgba(255,255,255,0.12)', radius: 40 }}
                                    style={({ pressed }) => [
                                        styles.centerButton,
                                        pressed && { transform: [{ scale: 0.97 }] },
                                    ]}
                                >
                                    <Animated.View style={{ transform: [{ scale: pressedScale() }] }}>
                                        <LinearGradient
                                            colors={['#7c3aed', '#06b6d4']}
                                            style={styles.centerButtonGradient}
                                            start={[0, 0]}
                                            end={[1, 1]}
                                        >
                                            <Ionicons name="navigate" size={28} color="#fff" />
                                        </LinearGradient>
                                    </Animated.View>
                                </Pressable>
                            </View>
                        ),
                        tabBarAccessibilityLabel: 'Takip',
                    }}
                />
                <Tabs.Screen
                    name="settings"
                    options={{
                        title: 'Ayarlar',
                        tabBarIcon: ({ focused }) => (
                            focused ? (
                                <LinearGradient colors={["#7c3aed", "#06b6d4"]} style={styles.iconGradientActive} start={[0, 0]} end={[1, 1]}>
                                    <AnimatedTabIcon name={'settings'} focused={focused} />
                                </LinearGradient>
                            ) : (
                                <View style={[styles.iconWrapper, styles.iconWrapperInactive]}>
                                    <AnimatedTabIcon name={'settings-outline'} focused={focused} />
                                </View>
                            )
                        ),
                        tabBarAccessibilityLabel: 'Ayarlar',
                    }}
                />
                <Tabs.Screen
                    name="admin"
                    options={{
                        title: 'Yönetim',
                        tabBarIcon: ({ focused }) => (
                            focused ? (
                                <LinearGradient colors={["#f59e0b", "#d97706"]} style={styles.iconGradientActive} start={[0, 0]} end={[1, 1]}>
                                    <AnimatedTabIcon name={'shield-checkmark'} focused={focused} />
                                </LinearGradient>
                            ) : (
                                <View style={[styles.iconWrapper, styles.iconWrapperInactive]}>
                                    <AnimatedTabIcon name={'shield-checkmark-outline'} focused={focused} />
                                </View>
                            )
                        ),
                        tabBarAccessibilityLabel: 'Yönetim',
                    }}
                />
            </Tabs>
        </View>
    );

    function pressedScale() {
        const s = new Animated.Value(1);
        return s; // we keep Pressable's built-in pressed visual (scale handled by Pressable style)
    }
}

const styles = StyleSheet.create({
    tabBar: {
        position: 'absolute',
        height: TABBAR_HEIGHT,
        borderRadius: 31,
        backgroundColor: '#1e293b',
        alignItems: 'center',
        justifyContent: 'space-between',
        overflow: 'visible',
        marginLeft:20,
        paddingHorizontal: 18,
        flexDirection: 'row',
        borderWidth: 1,
        borderColor: '#334155',
    },
    iconWrapper: {
        width: 50,
        height: 50,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 6,
    },
    iconWrapperActive: {
        backgroundColor: '#334155',
        borderWidth: 1,
        borderColor: '#475569',
    },
    iconWrapperInactive: {
        backgroundColor: 'transparent',
    },
    iconGradientActive: {
        width: 50,
        height: 50,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 6,
    },
    centerButtonContainer: {
        position: 'absolute',
        top: -CENTER_BUTTON_SIZE / 2,
        alignSelf: 'center',
        height: CENTER_BUTTON_SIZE,
        borderRadius: CENTER_BUTTON_SIZE / 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    centerButton: {
        width: CENTER_BUTTON_SIZE,
        height: CENTER_BUTTON_SIZE,
        borderRadius: CENTER_BUTTON_SIZE / 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    centerButtonGradient: {
        width: CENTER_BUTTON_SIZE - 8,
        height: CENTER_BUTTON_SIZE - 8,
        borderRadius: (CENTER_BUTTON_SIZE - 8) / 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    centerIconInner: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
