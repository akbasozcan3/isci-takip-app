import React, { useEffect } from 'react';
import { View, StyleSheet, Platform, Pressable, Dimensions } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
    withSequence,
    interpolate,
    Extrapolation,
    interpolateColor,
    withDelay
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// --- Architecture Configuration ---
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_BAR_HEIGHT = 84;
const TAB_BAR_WIDTH = SCREEN_WIDTH - 32; // Floating margin
const CENTER_BUTTON_SIZE = 68; // Larger, more imposing
const ICON_SIZE = 24;
const ACTIVE_ICON_SCALE = 1.1;

const COLORS = {
    glassBackground: 'rgba(8, 10, 20, 0.75)', // Deeper, more "void" like
    glassBorder: 'rgba(255, 255, 255, 0.06)', // Subtle rim light
    glassInnerShadow: 'rgba(255, 255, 255, 0.03)',

    activeIcon: '#E2E8F0', // White/Slate 100 for max contrast
    inactiveIcon: '#64748B', // Slate 500, pushes back

    activePillStart: 'rgba(56, 189, 248, 0.15)', // Very subtle blue tint background
    activePillEnd: 'rgba(56, 189, 248, 0.0)',
    activeGlow: '#38BDF8',

    centerStart: '#0EA5E9',
    centerEnd: '#4F46E5', // More royal blue/indigoshift
    centerGlow: 'rgba(79, 70, 229, 0.5)',
};

// --- Components ---

const ActivePill = ({ focused }: { focused: boolean }) => {
    const opacity = useSharedValue(0);
    const scale = useSharedValue(0);

    useEffect(() => {
        opacity.value = withTiming(focused ? 1 : 0, { duration: 300 });
        scale.value = withSpring(focused ? 1 : 0.5, { damping: 15 });
    }, [focused]);

    const style = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ scale: scale.value }],
    }));

    return (
        <Animated.View style={[styles.activePillContainer, style]}>
            <LinearGradient
                colors={[COLORS.activePillStart, COLORS.activePillEnd]}
                style={styles.activePillGradient}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
            />
            {/* Top Highlight "Glint" */}
            <View style={styles.activePillGlint} />
        </Animated.View>
    );
};

const TabIcon = ({
    isFocused,
    options,
    onPress,
    onLongPress,
}: {
    isFocused: boolean,
    options: any,
    onPress: () => void,
    onLongPress: () => void,
}) => {
    // Animation Values
    const scale = useSharedValue(isFocused ? 1 : 0);

    useEffect(() => {
        scale.value = withSpring(isFocused ? 1 : 0, { damping: 12, stiffness: 100 });
    }, [isFocused]);

    const animatedIconStyle = useAnimatedStyle(() => {
        const iconScale = interpolate(scale.value, [0, 1], [0.9, ACTIVE_ICON_SCALE]);
        const iconOpacity = interpolate(scale.value, [0, 1], [0.45, 1]); // 45% opacity for passive

        return {
            transform: [{ scale: iconScale }],
            opacity: iconOpacity,
            shadowColor: COLORS.activeGlow,
            shadowOpacity: interpolate(scale.value, [0, 1], [0, 0.6]),
            shadowRadius: interpolate(scale.value, [0, 1], [0, 8]),
            shadowOffset: { width: 0, height: 0 }
        };
    });

    const IconRenderer = options.tabBarIcon;

    return (
        <Pressable
            onPress={() => {
                if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onPress();
            }}
            onLongPress={onLongPress}
            style={styles.tabItem}
            hitSlop={10}
        >
            <View style={styles.iconWrapper}>
                {/* Background Pill for Active State */}
                <ActivePill focused={isFocused} />

                <Animated.View style={animatedIconStyle}>
                    {IconRenderer ? (
                        IconRenderer({
                            focused: isFocused,
                            color: isFocused ? COLORS.activeIcon : COLORS.inactiveIcon,
                            size: ICON_SIZE
                        })
                    ) : (
                        <Ionicons name="help" size={ICON_SIZE} color={COLORS.inactiveIcon} />
                    )}
                </Animated.View>
            </View>
        </Pressable>
    );
};

const CenterButton = ({ onPress }: { onPress: () => void }) => {
    const scale = useSharedValue(1);
    const glowOpacity = useSharedValue(0.6);

    useEffect(() => {
        // Breathing glow effect
        glowOpacity.value = withSequence(
            withTiming(0.8, { duration: 2000 }),
            withTiming(0.6, { duration: 2000 })
        );
    }, []);

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        scale.value = withSequence(
            withTiming(0.92, { duration: 100 }),
            withSpring(1, { damping: 10, stiffness: 120 })
        );
        onPress();
    };

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }]
    }));

    return (
        <Pressable onPress={handlePress} style={styles.centerButtonContainer}>
            <Animated.View style={[styles.centerButtonWrapper, animatedStyle]}>
                {/* Outer Glow "Halo" */}
                <View style={styles.centerHalo} />

                {/* Main Gradient Button */}
                <LinearGradient
                    colors={[COLORS.centerStart, COLORS.centerEnd]}
                    style={styles.centerButton}
                    start={{ x: 0.2, y: 0.1 }}
                    end={{ x: 0.8, y: 0.9 }}
                >
                    <Ionicons name="navigate" size={30} color="#fff" style={{ marginLeft: 2 }} />
                </LinearGradient>

                {/* Inner Rim Light (Top) */}
                <View style={styles.centerButtonRim} />
            </Animated.View>
        </Pressable>
    );
};

// --- Main Bar ---

export default function PremiumTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
    const insets = useSafeAreaInsets();
    const centerIndex = Math.floor(state.routes.length / 2);

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom + 10 }]}>

            {/* Floating Dock Structure */}
            <View style={styles.dockContainer}>
                {/* Glass Layer */}
                <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill}>
                    <LinearGradient
                        colors={[COLORS.glassBackground, 'rgba(8,10,20,0.9)']}
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                    />
                </BlurView>

                {/* Inner Border/Noise Emulation */}
                <View style={styles.innerBorder} />

                {/* Tab Items */}
                <View style={styles.tabsRow}>
                    {state.routes.map((route, index) => {
                        if (index === centerIndex) {
                            // Space for Center Button
                            return <View key="spacer" style={styles.centerSpacer} />;
                        }

                        const { options } = descriptors[route.key];
                        const isFocused = state.index === index;

                        const onPress = () => {
                            const event = navigation.emit({
                                type: 'tabPress',
                                target: route.key,
                                canPreventDefault: true,
                            });
                            if (!isFocused && !event.defaultPrevented) {
                                navigation.navigate(route.name, route.params);
                            }
                        };

                        return (
                            <TabIcon
                                key={route.key}
                                isFocused={isFocused}
                                options={options}
                                onPress={onPress}
                                onLongPress={() => { }}
                            />
                        );
                    })}
                </View>
            </View>

            {/* Absolute Center Button floating ABOVE the dock */}
            <View style={styles.centerButtonPosition}>
                {state.routes.map((route, index) => {
                    if (index !== centerIndex) return null;
                    return <CenterButton key="center" onPress={() => navigation.navigate(route.name)} />;
                })}
            </View>

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    dockContainer: {
        width: TAB_BAR_WIDTH,
        height: TAB_BAR_HEIGHT,
        borderRadius: 24, // Less pill, more architectural
        overflow: 'hidden',
        position: 'relative',
        // Real depth shadows
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
        elevation: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    innerBorder: {
        ...StyleSheet.absoluteFillObject,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        borderRadius: 24,
    },
    tabsRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 6,
    },
    tabItem: {
        flex: 1,
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconWrapper: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        // Debug
        // backgroundColor: 'red'
    },
    activePillContainer: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 12,
        overflow: 'hidden',
    },
    activePillGradient: {
        flex: 1,
        opacity: 0.6,
    },
    activePillGlint: {
        height: 1,
        width: '80%',
        backgroundColor: 'rgba(255,255,255,0.3)',
        alignSelf: 'center',
        top: 0,
    },
    centerSpacer: {
        width: CENTER_BUTTON_SIZE,
    },
    centerButtonPosition: {
        position: 'absolute',
        bottom: 70, // Raised higher to not block tabs
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    centerButtonContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    centerButtonWrapper: {
        width: CENTER_BUTTON_SIZE,
        height: CENTER_BUTTON_SIZE,
        justifyContent: 'center',
        alignItems: 'center',
    },
    centerHalo: {
        position: 'absolute',
        width: CENTER_BUTTON_SIZE + 20,
        height: CENTER_BUTTON_SIZE + 20,
        borderRadius: (CENTER_BUTTON_SIZE + 20) / 2,
        backgroundColor: COLORS.centerGlow,
        opacity: 0.3,
        // Blur handled by opacity layering or could be ImageBackground for real soft blur
    },
    centerButton: {
        width: CENTER_BUTTON_SIZE,
        height: CENTER_BUTTON_SIZE,
        borderRadius: CENTER_BUTTON_SIZE / 2,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: COLORS.centerEnd,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 8,
    },
    centerButtonRim: {
        position: 'absolute',
        top: 0,
        width: CENTER_BUTTON_SIZE,
        height: CENTER_BUTTON_SIZE,
        borderRadius: CENTER_BUTTON_SIZE / 2,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.15)',
    }
});
