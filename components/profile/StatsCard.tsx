import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Reanimated, {
    FadeInDown,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
    interpolate
} from 'react-native-reanimated';

interface StatsCardProps {
    totalLocations: number;
    totalSteps: number;
    activeDays: number;
    lastActive: string | null;
}

export function StatsCard({ totalLocations, totalSteps, activeDays, lastActive }: StatsCardProps) {
    const pulse = useSharedValue(0);

    useEffect(() => {
        pulse.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 2000 }),
                withTiming(0, { duration: 2000 })
            ),
            -1,
            false
        );
    }, []);

    const pulseStyle = useAnimatedStyle(() => {
        const scale = interpolate(pulse.value, [0, 1], [1, 1.05]);
        const opacity = interpolate(pulse.value, [0, 1], [0.5, 0.8]);

        return {
            transform: [{ scale }],
            opacity,
        };
    });

    const formatNumber = (num: number) => {
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toString();
    };

    const stats = [
        {
            icon: 'location' as const,
            label: 'Konum Kaydı',
            value: formatNumber(totalLocations),
            color: '#0EA5E9',
            bgColor: 'rgba(14, 165, 233, 0.1)',
            gradient: ['rgba(14, 165, 233, 0.2)', 'rgba(14, 165, 233, 0.05)'],
        },
        {
            icon: 'footsteps' as const,
            label: 'Toplam Adım',
            value: formatNumber(totalSteps),
            color: '#10b981',
            bgColor: 'rgba(16, 185, 129, 0.1)',
            gradient: ['rgba(16, 185, 129, 0.2)', 'rgba(16, 185, 129, 0.05)'],
        },
        {
            icon: 'calendar' as const,
            label: 'Aktif Gün',
            value: activeDays.toString(),
            color: '#8b5cf6',
            bgColor: 'rgba(139, 92, 246, 0.1)',
            gradient: ['rgba(139, 92, 246, 0.2)', 'rgba(139, 92, 246, 0.05)'],
        },
        {
            icon: 'time' as const,
            label: 'Son Aktivite',
            value: lastActive ? new Date(lastActive).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }) : '-',
            color: '#f59e0b',
            bgColor: 'rgba(245, 158, 11, 0.1)',
            gradient: ['rgba(245, 158, 11, 0.2)', 'rgba(245, 158, 11, 0.05)'],
        },
    ];

    return (
        <Reanimated.View entering={FadeInDown.delay(150).springify()} style={styles.container}>
            <LinearGradient
                colors={['rgba(30, 41, 59, 0.9)', 'rgba(15, 23, 42, 0.7)']}
                style={styles.gradient}
            >
                <View style={styles.header}>
                    <Reanimated.View style={[styles.headerIconWrapper, pulseStyle]}>
                        <LinearGradient
                            colors={['rgba(14, 165, 233, 0.3)', 'rgba(99, 102, 241, 0.3)']}
                            style={styles.headerIconGradient}
                        >
                            <Ionicons name="stats-chart" size={20} color="#0EA5E9" />
                        </LinearGradient>
                    </Reanimated.View>
                    <Text style={styles.title}>İstatistiklerim</Text>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>CANLI</Text>
                    </View>
                </View>

                <View style={styles.statsGrid}>
                    {stats.map((stat, index) => (
                        <Reanimated.View
                            key={index}
                            entering={FadeInDown.delay(200 + index * 100).springify()}
                            style={styles.statItem}
                        >
                            <LinearGradient
                                colors={stat.gradient}
                                style={styles.statGradient}
                            >
                                <View style={[styles.statIconWrapper, { backgroundColor: stat.bgColor }]}>
                                    <Ionicons name={stat.icon} size={22} color={stat.color} />
                                </View>
                                <Text style={styles.statValue}>{stat.value}</Text>
                                <Text style={styles.statLabel}>{stat.label}</Text>
                            </LinearGradient>
                        </Reanimated.View>
                    ))}
                </View>
            </LinearGradient>
        </Reanimated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 20,
    },
    gradient: {
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        shadowColor: '#0EA5E9',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 8,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 20,
    },
    headerIconWrapper: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    headerIconGradient: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
    },
    title: {
        flex: 1,
        fontSize: 18,
        fontWeight: '800',
        color: '#fff',
        fontFamily: 'Poppins-Bold',
        letterSpacing: 0.5,
    },
    badge: {
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.3)',
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '900',
        color: '#10b981',
        fontFamily: 'Poppins-Bold',
        letterSpacing: 1,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    statItem: {
        flex: 1,
        minWidth: '45%',
        borderRadius: 18,
        overflow: 'hidden',
    },
    statGradient: {
        padding: 18,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 18,
    },
    statIconWrapper: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    statValue: {
        fontSize: 28,
        fontWeight: '900',
        color: '#fff',
        marginBottom: 4,
        fontFamily: 'Poppins-Bold',
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    statLabel: {
        fontSize: 12,
        color: '#94a3b8',
        textAlign: 'center',
        fontFamily: 'Poppins-Regular',
        letterSpacing: 0.3,
    },
});
