
import React, { useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    ScrollView,
    Pressable,
    Image,
    Platform,
    StatusBar
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
    useAnimatedScrollHandler,
    interpolate,
    Extrapolation
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

// --- Premium Design Tokens ---
const COLORS = {
    bgDark: '#020617', // Ultra deep slate/black
    bgLight: '#0F172A',
    primary: '#38BDF8', // Sky blue
    accent: '#6366F1', // Indigo
    textMain: '#F8FAFC',
    textSoft: '#94A3B8',
    cardBorder: 'rgba(255,255,255,0.06)',
    glass: 'rgba(30, 41, 59, 0.4)',
    glassBorder: 'rgba(255,255,255,0.08)',
};

// --- Header Component ---
const FlagshipHeader = ({ userName, avatarUrl, scrollY, onProfilePress }: any) => {
    const insets = useSafeAreaInsets();

    const animatedStyle = useAnimatedStyle(() => {
        const opacity = interpolate(scrollY.value, [0, 50], [0, 1], Extrapolation.CLAMP);
        const translateY = interpolate(scrollY.value, [0, 50], [10, 0], Extrapolation.CLAMP);
        return {
            opacity,
            transform: [{ translateY }]
        };
    });

    return (
        <View style={[styles.headerWrapper, { paddingTop: insets.top }]}>
            {/* Background Blur on scroll */}
            <Animated.View style={[StyleSheet.absoluteFill, styles.headerBlur, animatedStyle]}>
                <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={styles.headerBorder} />
            </Animated.View>

            <View style={styles.headerContent}>
                <View>
                    <Text style={styles.headerLabel}>ANA SAYFA</Text>
                    <Text style={styles.headerWelcome}>Hoş geldin, <Text style={{ color: '#fff' }}>{userName}</Text></Text>
                </View>

                {/* Right Actions */}
                <View style={styles.headerActions}>
                    <Pressable style={styles.glassButton}>
                        <Ionicons name="search" size={20} color="#fff" />
                    </Pressable>
                    <Pressable style={styles.glassButton} onPress={onProfilePress}>
                        {avatarUrl ? (
                            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                        ) : (
                            <Ionicons name="person" size={20} color="#fff" />
                        )}
                    </Pressable>
                </View>
            </View>
        </View>
    );
};

// --- Architectural Main Card ---
const HeroCard = ({ stats, onPress }: any) => {
    return (
        <Pressable
            style={({ pressed }) => [styles.heroCardContainer, pressed && { transform: [{ scale: 0.98 }] }]}
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onPress?.();
            }}
        >
            <LinearGradient
                colors={['#1E293B', '#0f172a']}
                style={styles.heroCard}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.8, y: 1 }}
            >
                {/* Architectural "Noise" / Texture emulation could go here */}
                <View style={styles.heroGlow} />

                {/* Content */}
                <View style={styles.heroContent}>
                    <View style={styles.heroTop}>
                        <View style={styles.liveIndicator}>
                            <View style={styles.liveDot} />
                            <Text style={styles.liveText}>CANLI SİSTEM</Text>
                        </View>
                        <Ionicons name="hardware-chip-outline" size={24} color={COLORS.textSoft} />
                    </View>

                    <View style={styles.heroGrid}>
                        <View>
                            <Text style={styles.heroValue}>{stats.activeWorkers || 0}</Text>
                            <Text style={styles.heroLabel}>Aktif Personel</Text>
                        </View>
                        <View style={styles.heroDivider} />
                        <View>
                            <Text style={styles.heroValue}>{stats.todayDistance || 0}<Text style={{ fontSize: 14, color: COLORS.textSoft }}> km</Text></Text>
                            <Text style={styles.heroLabel}>Katedilen</Text>
                        </View>
                    </View>

                    {/* Premium CTA */}
                    <View style={styles.heroBottom}>
                        <View style={styles.ctaButton}>
                            <Text style={styles.ctaText}>Sistemi İncele</Text>
                            <Ionicons name="arrow-forward" size={16} color="#0F172A" />
                        </View>
                        <Text style={styles.updateText}>1 dk önce güncellendi</Text>
                    </View>
                </View>

                {/* Background Decor */}
                <Ionicons name="map" size={140} color="rgba(255,255,255,0.02)" style={styles.heroBgIcon} />
            </LinearGradient>
        </Pressable>
    );
};

// --- Insight/Blog Component ---
const InsightCard = ({ article }: any) => {
    return (
        <View style={styles.insightCard}>
            <View style={styles.insightIcon}>
                <Ionicons name="bulb-outline" size={22} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={styles.insightCategory}>{article.category || 'Genel'}</Text>
                    <Text style={styles.insightTime}>{article.readTime || '3 dk'}</Text>
                </View>
                <Text style={styles.insightTitle} numberOfLines={2}>{article.title}</Text>
            </View>
        </View>
    );
};

// --- Slider Component ---
const PromoSlider = ({ slides }: any) => {
    const scrollX = useSharedValue(0);
    const scrollHandler = useAnimatedScrollHandler(event => {
        scrollX.value = event.contentOffset.x;
    });

    return (
        <View style={styles.sliderContainer}>
            <Animated.ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                decelerationRate="fast"
                snapToInterval={width - 40}
                contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
            >
                {slides.map((slide: any, i: number) => (
                    <View key={slide.id} style={styles.slideItem}>
                        <LinearGradient
                            colors={[COLORS.glass, COLORS.bgDark]}
                            style={styles.slideGradient}
                        >
                            <View style={[styles.slideIcon, { backgroundColor: slide.color + '20' }]}>
                                <Ionicons name={slide.icon} size={28} color={slide.color} />
                            </View>
                            <View>
                                <Text style={styles.slideTitle}>{slide.title}</Text>
                                <Text style={styles.slideDesc}>{slide.description}</Text>
                            </View>
                        </LinearGradient>
                    </View>
                ))}
            </Animated.ScrollView>

            {/* Pill Indicator */}
            <View style={styles.pagination}>
                {slides.map((_: any, i: number) => {
                    const animatedStyle = useAnimatedStyle(() => {
                        // Simple active state check logic for simplicity in this swift implementation
                        const active = Math.round(scrollX.value / (width - 48)) === i;
                        return {
                            width: withTiming(active ? 20 : 6),
                            opacity: withTiming(active ? 1 : 0.3),
                            backgroundColor: active ? COLORS.primary : '#fff'
                        }
                    });
                    return <Animated.View key={i} style={[styles.dot, animatedStyle]} />;
                })}
            </View>
        </View>
    );
};

export default function FlagshipHome({
    userName,
    avatarUrl,
    stats,
    slides,
    articles,
    onProfilePress,
    onMapPress
}: any) {
    const scrollY = useSharedValue(0);
    const scrollHandler = useAnimatedScrollHandler(e => {
        scrollY.value = e.contentOffset.y;
    });

    const insets = useSafeAreaInsets();

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Deep Background Atmosphere */}
            <LinearGradient
                colors={['#0F172A', '#020617', '#000000']}
                locations={[0, 0.4, 1]}
                style={StyleSheet.absoluteFill}
            />
            {/* Noise Texture replacement (subtle grain could be an image, here we use low opacity overlay) */}
            <View style={styles.grainOverlay} />

            <FlagshipHeader
                userName={userName}
                avatarUrl={avatarUrl}
                scrollY={scrollY}
                onProfilePress={onProfilePress}
            />

            <Animated.ScrollView
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                contentContainerStyle={{
                    paddingTop: insets.top + 80,
                    paddingBottom: 130 // Nav bar clearance
                }}
                showsVerticalScrollIndicator={false}
            >
                {/* 1. Hero Card */}
                <HeroCard stats={stats} onPress={onMapPress} />

                {/* 2. Slider */}
                <PromoSlider slides={slides || []} />

                {/* 3. Blog/Insights Section */}
                {articles && articles.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>GÜNCEL İÇGÖRÜLER</Text>
                            <Ionicons name="arrow-forward" size={16} color={COLORS.textSoft} />
                        </View>

                        <View style={styles.stackContainer}>
                            {articles.map((article: any, i: number) => (
                                <React.Fragment key={article.id || i}>
                                    <InsightCard article={article} />
                                    {i < articles.length - 1 && <View style={styles.divider} />}
                                </React.Fragment>
                            ))}
                        </View>
                    </View>
                )}
            </Animated.ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bgDark,
    },
    grainOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#fff',
        opacity: 0.02,
        zIndex: -1,
    },

    // Header
    headerWrapper: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
    },
    headerBlur: {
        backgroundColor: 'rgba(2, 6, 23, 0.8)',
    },
    headerBorder: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: COLORS.glassBorder,
    },
    headerContent: {
        paddingHorizontal: 24,
        paddingBottom: 20,
        paddingTop: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: COLORS.textSoft,
        letterSpacing: 2,
        marginBottom: 4,
    },
    headerWelcome: {
        fontSize: 16,
        color: COLORS.textSoft,
        fontWeight: '500',
    },
    headerActions: {
        flexDirection: 'row',
        gap: 12,
    },
    glassButton: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        overflow: 'hidden',
    },
    avatar: {
        width: '100%',
        height: '100%',
    },

    // Hero
    heroCardContainer: {
        marginHorizontal: 20,
        marginBottom: 32,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.4,
        shadowRadius: 30,
        elevation: 10,
    },
    heroCard: {
        borderRadius: 24, // Architectural curve
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
        height: 220,
        padding: 24,
        overflow: 'hidden',
        justifyContent: 'space-between',
    },
    heroGlow: {
        position: 'absolute',
        top: -50,
        right: -50,
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: COLORS.primary,
        opacity: 0.15,
        zIndex: 0,
        filter: 'blur(40px)', // Will work on some versions, ignored on others
    },
    heroBgIcon: {
        position: 'absolute',
        bottom: -20,
        right: -20,
        transform: [{ rotate: '-15deg' }]
    },
    heroContent: {
        flex: 1,
        zIndex: 1,
        justifyContent: 'space-between',
    },
    heroTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    liveIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(56, 189, 248, 0.15)',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 100,
        borderWidth: 1,
        borderColor: 'rgba(56, 189, 248, 0.2)',
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: COLORS.primary,
        marginRight: 8,
    },
    liveText: {
        color: COLORS.primary,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    heroGrid: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
    },
    heroValue: {
        fontSize: 32,
        fontWeight: '800', // Strong typography
        color: '#fff',
        fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
        letterSpacing: -0.5,
    },
    heroLabel: {
        fontSize: 13,
        color: COLORS.textSoft,
        fontWeight: '500',
        marginTop: 2,
    },
    heroDivider: {
        width: 1,
        height: 32,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginHorizontal: 24,
    },
    heroBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    ctaButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 14,
        gap: 8,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },
    ctaText: {
        color: '#0F172A',
        fontWeight: '700',
        fontSize: 14,
    },
    updateText: {
        color: COLORS.textSoft,
        fontSize: 11,
        marginBottom: 4,
    },

    // Slider
    sliderContainer: {
        marginBottom: 32,
    },
    slideItem: {
        width: width - 40,
        height: 160,
    },
    slideGradient: {
        flex: 1,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        padding: 24,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
    },
    slideIcon: {
        width: 60,
        height: 60,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    slideTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 6,
    },
    slideDesc: {
        fontSize: 14,
        color: COLORS.textSoft,
        maxWidth: '80%',
        lineHeight: 20,
    },
    pagination: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
        marginTop: 16,
    },
    dot: {
        height: 6,
        borderRadius: 3,
    },

    // Insights
    section: {
        paddingHorizontal: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingHorizontal: 4,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: COLORS.textSoft,
        letterSpacing: 1.5,
    },
    stackContainer: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
        padding: 8,
    },
    insightCard: {
        flexDirection: 'row',
        padding: 16,
        alignItems: 'flex-start',
        gap: 16,
    },
    insightIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(56, 189, 248, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
    },
    insightCategory: {
        fontSize: 11,
        color: COLORS.primary,
        fontWeight: '700',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    insightTime: {
        fontSize: 12,
        color: COLORS.textSoft,
    },
    insightTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#F1F5F9',
        lineHeight: 22,
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.06)',
        marginHorizontal: 16,
    },
});
