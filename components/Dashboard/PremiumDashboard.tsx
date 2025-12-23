import React, { useRef, useEffect } from 'react';
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
    withDelay,
    interpolate,
    useAnimatedScrollHandler,
    Extrapolation
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Haptics } from 'expo-haptics'; // Ensure this is available or use expo-haptics if imported directly

// --- Theme Constants ---
const { width } = Dimensions.get('window');
const COLORS = {
    background: '#0B1121', // Deep Navy/Black
    cardBg: '#151F32',
    cardBorder: 'rgba(255,255,255,0.08)',
    primary: '#38BDF8', // Sky Blue
    secondary: '#818CF8', // Indigo
    textPrimary: '#F1F5F9',
    textSecondary: '#94A3B8',
    accent: '#0EA5E9',
    glass: 'rgba(255,255,255,0.05)',
};

// --- Components ---

// 1. Premium Header
const PremiumHeader = ({
    userName,
    avatarUrl,
    onProfilePress,
    scrollY
}: {
    userName: string;
    avatarUrl?: string | null;
    onProfilePress?: () => void;
    scrollY: Animated.SharedValue<number>;
}) => {
    const insets = useSafeAreaInsets();

    const containerStyle = useAnimatedStyle(() => {
        const opacity = interpolate(scrollY.value, [0, 60], [0, 1]);
        return {
            backgroundColor: `rgba(11, 17, 33, ${opacity})`,
            borderBottomColor: `rgba(255,255,255, ${opacity * 0.05})`,
            borderBottomWidth: opacity > 0 ? 1 : 0,
        };
    });

    return (
        <Animated.View style={[styles.headerContainer, { paddingTop: insets.top }, containerStyle]}>
            <View style={styles.headerContent}>
                <View>
                    <Text style={styles.headerGreeting}>HOŞ GELDİN</Text>
                    <Text style={styles.headerName}>{userName}</Text>
                </View>

                <View style={styles.headerActions}>
                    <Pressable style={styles.iconButton}>
                        <Ionicons name="notifications-outline" size={22} color="#fff" />
                        <View style={styles.notificationDot} />
                    </Pressable>

                    <Pressable onPress={onProfilePress} style={styles.profileButton}>
                        {avatarUrl ? (
                            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                        ) : (
                            <LinearGradient
                                colors={[COLORS.primary, COLORS.secondary]}
                                style={styles.avatarPlaceholder}
                            >
                                <Text style={styles.avatarText}>{userName.charAt(0)}</Text>
                            </LinearGradient>
                        )}
                    </Pressable>
                </View>
            </View>
        </Animated.View>
    );
};

// 2. Architectural Stats Card
const StatsCard = ({ stats, onPress }: { stats: any, onPress?: () => void }) => {
    const scale = useSharedValue(0.9);
    const opacity = useSharedValue(0);

    useEffect(() => {
        scale.value = withDelay(100, withSpring(1));
        opacity.value = withDelay(100, withTiming(1));
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value
    }));

    return (
        <Animated.View style={[styles.mainCardContainer, animatedStyle]}>
            <Pressable onPress={onPress}>
                <LinearGradient
                    colors={[COLORS.cardBg, '#0F172A']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.mainCard}
                >
                    {/* Inner lighting/noise emulation could go here */}
                    <View style={styles.cardHeader}>
                        <View style={styles.liveBadge}>
                            <View style={styles.liveDot} />
                            <Text style={styles.liveText}>CANLI TAKİP</Text>
                        </View>
                        <Ionicons name="map" size={20} color={COLORS.textSecondary} />
                    </View>

                    <View style={styles.cardContent}>
                        <View style={styles.statRow}>
                            <View>
                                <Text style={styles.statValue}>{stats.activeWorkers || 0}</Text>
                                <Text style={styles.statLabel}>Aktif Personel</Text>
                            </View>
                            <View style={styles.verticalDivider} />
                            <View>
                                <Text style={styles.statValue}>{stats.todayDistance || 0}<Text style={styles.statUnit}> km</Text></Text>
                                <Text style={styles.statLabel}>Toplam Mesafe</Text>
                            </View>
                        </View>

                        <View style={styles.cardAction}>
                            <Text style={styles.actionText}>Haritayı Görüntüle</Text>
                            <View style={styles.actionIconBg}>
                                <Ionicons name="arrow-forward" size={16} color="#fff" />
                            </View>
                        </View>
                    </View>
                </LinearGradient>
            </Pressable>
        </Animated.View>
    );
};

// 3. Quick Actions Grid
const QuickAction = ({ item, index }: { item: any, index: number }) => {
    const scale = useSharedValue(0);

    useEffect(() => {
        scale.value = withDelay(300 + (index * 50), withSpring(1));
    }, []);

    const style = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }]
    }));

    return (
        <Animated.View style={[styles.quickActionContainer, style]}>
            <Pressable
                style={({ pressed }) => [
                    styles.quickAction,
                    pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }
                ]}
            >
                <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={[styles.quickActionIcon, { backgroundColor: item.color + '20' }]}>
                    <Ionicons name={item.icon} size={24} color={item.color} />
                </View>
                <Text style={styles.quickActionTitle}>{item.title}</Text>
            </Pressable>
        </Animated.View>
    );
};

// --- Main Layout ---

export default function PremiumDashboard({
    userName,
    avatarUrl,
    stats,
    slides, // Kept for API compatibility, but we might redesign interactions
    actions,
    articles,
    onProfilePress,
    onQuickActionPress,
    onMapPress
}: any) {
    const scrollY = useSharedValue(0);
    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollY.value = event.contentOffset.y;
        },
    });

    const insets = useSafeAreaInsets();

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Background Atmosphere */}
            <LinearGradient
                colors={['#0f172a', '#020617']}
                style={StyleSheet.absoluteFill}
            />
            {/* Subtle Top Gradient Light */}
            <View style={styles.ambientLight} />

            <PremiumHeader
                userName={userName}
                avatarUrl={avatarUrl}
                onProfilePress={onProfilePress}
                scrollY={scrollY}
            />

            <Animated.ScrollView
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 80, paddingBottom: 120 }]}
                showsVerticalScrollIndicator={false}
            >
                {/* 1. Main Stats Card */}
                <StatsCard stats={stats} onPress={onMapPress} />

                {/* 2. Quick Actions */}
                <Text style={styles.sectionTitle}>Hızlı Erişim</Text>
                <View style={styles.gridContainer}>
                    {actions.map((item: any, index: number) => (
                        <QuickAction
                            key={item.id}
                            item={item}
                            index={index}
                        />
                    ))}
                </View>

                {/* 3. Slider/Highlights (Reimagined as Promo Cards) */}
                {slides && slides.length > 0 && (
                    <View style={styles.promoSection}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
                            {slides.map((slide: any, index: number) => (
                                <View key={slide.id} style={styles.promoCard}>
                                    <LinearGradient
                                        colors={[slide.color + '40', slide.color + '10']}
                                        style={StyleSheet.absoluteFill}
                                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                    />
                                    <View style={[styles.promoIcon, { backgroundColor: slide.color }]}>
                                        <Ionicons name={slide.icon} size={20} color="#fff" />
                                    </View>
                                    <Text style={styles.promoTitle}>{slide.title}</Text>
                                    <Text style={styles.promoDesc} numberOfLines={2}>{slide.description}</Text>
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* 4. Articles (Optional) */}
                {articles && articles.length > 0 && (
                    <>
                        <Text style={styles.sectionTitle}>İçgörüler</Text>
                        {articles.map((article: any, index: number) => (
                            <View key={article.id} style={styles.articleRow}>
                                <View style={styles.articleIcon}>
                                    <Ionicons name="document-text-outline" size={20} color={COLORS.textSecondary} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.articleTitle}>{article.title}</Text>
                                    <Text style={styles.articleMeta}>{article.readTime || '3 dk'} okuma</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
                            </View>
                        ))}
                    </>
                )}

            </Animated.ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    ambientLight: {
        position: 'absolute',
        top: -100,
        left: -50,
        width: width,
        height: width,
        backgroundColor: COLORS.primary,
        opacity: 0.08,
        borderRadius: width / 2,
        transform: [{ scale: 1.5 }],
    },
    scrollContent: {
        // Padding handled dynamically
    },
    // Header
    headerContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        paddingHorizontal: 20,
        paddingBottom: 16,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerGreeting: {
        fontSize: 10,
        color: COLORS.textSecondary,
        fontWeight: '700',
        letterSpacing: 1.5,
        marginBottom: 2,
    },
    headerName: {
        fontSize: 20,
        color: '#fff',
        fontWeight: '700',
        fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    notificationDot: {
        position: 'absolute',
        top: 10,
        right: 10,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.primary,
        borderWidth: 1.5,
        borderColor: COLORS.cardBg,
    },
    profileButton: {
        // Shadow/Glow handled by image or container
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 14, // Squircle-ish
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    avatarPlaceholder: {
        width: 40,
        height: 40,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 16,
    },

    // Stats Card
    mainCardContainer: {
        marginHorizontal: 20,
        marginBottom: 32,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 10,
    },
    mainCard: {
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        overflow: 'hidden',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    liveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(56, 189, 248, 0.1)',
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
        marginRight: 6,
    },
    liveText: {
        color: COLORS.primary,
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    cardContent: {
        gap: 20,
    },
    statRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    statValue: {
        fontSize: 28,
        fontWeight: '800',
        color: '#fff',
        marginBottom: 4,
    },
    statUnit: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    statLabel: {
        fontSize: 12,
        color: COLORS.textSecondary,
        fontWeight: '500',
    },
    verticalDivider: {
        width: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    cardAction: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    actionText: {
        color: COLORS.primary,
        fontWeight: '600',
        fontSize: 14,
    },
    actionIconBg: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Quick Actions
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.textSecondary,
        marginLeft: 20,
        marginBottom: 16,
        marginTop: 24, // Spacing
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 14, // 20 - 6 (margin)
    },
    quickActionContainer: {
        width: '33.33%',
        padding: 6,
    },
    quickAction: {
        backgroundColor: COLORS.cardBg,
        borderRadius: 20,
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        aspectRatio: 1, // Square
        overflow: 'hidden',
    },
    quickActionIcon: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    quickActionTitle: {
        color: COLORS.textPrimary,
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
    },

    // Promos
    promoSection: {
        marginTop: 16,
    },
    promoCard: {
        width: 240,
        height: 140,
        backgroundColor: COLORS.cardBg,
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        justifyContent: 'space-between',
        overflow: 'hidden',
    },
    promoIcon: {
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    promoTitle: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 16,
        marginBottom: 4,
    },
    promoDesc: {
        color: COLORS.textSecondary,
        fontSize: 12,
        lineHeight: 16,
    },
    // Articles
    articleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 20,
        gap: 16,
    },
    articleIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    articleTitle: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 2,
    },
    articleMeta: {
        color: COLORS.textSecondary,
        fontSize: 12,
    }
});
