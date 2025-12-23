/**
 * Skeleton Loader Components
 * Reusable skeleton screens for loading states
 */

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    interpolate
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

interface SkeletonProps {
    width?: number | string;
    height?: number;
    borderRadius?: number;
    style?: any;
}

export const Skeleton: React.FC<SkeletonProps> = ({
    width = '100%',
    height = 20,
    borderRadius = 8,
    style
}) => {
    const shimmer = useSharedValue(0);

    useEffect(() => {
        shimmer.value = withRepeat(
            withTiming(1, { duration: 1500 }),
            -1,
            false
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => {
        const translateX = interpolate(
            shimmer.value,
            [0, 1],
            [-300, 300]
        );

        return {
            transform: [{ translateX }]
        };
    });

    return (
        <View style={[styles.skeleton, { width, height, borderRadius }, style]}>
            <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
                <LinearGradient
                    colors={['transparent', 'rgba(255, 255, 255, 0.1)', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                />
            </Animated.View>
        </View>
    );
};

export const SkeletonCircle: React.FC<{ size: number }> = ({ size }) => (
    <Skeleton width={size} height={size} borderRadius={size / 2} />
);

export const SkeletonText: React.FC<{ lines?: number }> = ({ lines = 3 }) => (
    <View style={styles.textContainer}>
        {Array.from({ length: lines }).map((_, index) => (
            <Skeleton
                key={index}
                height={16}
                width={index === lines - 1 ? '60%' : '100%'}
                style={{ marginBottom: 8 }}
            />
        ))}
    </View>
);

export const SkeletonCard: React.FC = () => (
    <View style={styles.card}>
        <View style={styles.cardHeader}>
            <SkeletonCircle size={48} />
            <View style={styles.cardHeaderText}>
                <Skeleton width="60%" height={16} />
                <Skeleton width="40%" height={12} style={{ marginTop: 8 }} />
            </View>
        </View>
        <SkeletonText lines={2} />
    </View>
);

export const SkeletonProfile: React.FC = () => (
    <View style={styles.profile}>
        <SkeletonCircle size={80} />
        <Skeleton width="50%" height={24} style={{ marginTop: 16 }} />
        <Skeleton width="70%" height={16} style={{ marginTop: 8 }} />
        <View style={styles.statsRow}>
            <Skeleton width={80} height={60} />
            <Skeleton width={80} height={60} />
            <Skeleton width={80} height={60} />
        </View>
    </View>
);

const styles = StyleSheet.create({
    skeleton: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        overflow: 'hidden'
    },
    textContainer: {
        width: '100%'
    },
    card: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16
    },
    cardHeaderText: {
        flex: 1,
        marginLeft: 12
    },
    profile: {
        alignItems: 'center',
        padding: 24
    },
    statsRow: {
        flexDirection: 'row',
        gap: 16,
        marginTop: 24
    }
});
