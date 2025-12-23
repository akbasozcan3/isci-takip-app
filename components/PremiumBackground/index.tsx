/**
 * Premium Animated Background
 * Reusable component for falling lines and expanding circles
 */

import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Dimensions,
    Easing,
    StyleSheet,
    View,
} from 'react-native';

const { width, height } = Dimensions.get('window');

interface AnimatedBackgroundProps {
    color: string;
    lineCount?: number;
    circleCount?: number;
}

// Animated Line Component
const AnimatedLine: React.FC<{
    x: number;
    delay: number;
    duration: number;
    color: string;
}> = ({ x, delay, duration, color }) => {
    const translateY = useRef(new Animated.Value(-100)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animate = () => {
            translateY.setValue(-100);
            opacity.setValue(0);

            Animated.sequence([
                Animated.delay(delay),
                Animated.parallel([
                    Animated.timing(translateY, {
                        toValue: height + 100,
                        duration: duration,
                        easing: Easing.linear,
                        useNativeDriver: true,
                    }),
                    Animated.sequence([
                        Animated.timing(opacity, {
                            toValue: 0.15,
                            duration: 300,
                            useNativeDriver: true,
                        }),
                        Animated.timing(opacity, {
                            toValue: 0.15,
                            duration: duration - 600,
                            useNativeDriver: true,
                        }),
                        Animated.timing(opacity, {
                            toValue: 0,
                            duration: 300,
                            useNativeDriver: true,
                        }),
                    ]),
                ]),
            ]).start(() => animate());
        };

        animate();
    }, []);

    return (
        <Animated.View
            style={[
                styles.animatedLine,
                {
                    left: x,
                    backgroundColor: color,
                    opacity,
                    transform: [{ translateY }],
                },
            ]}
        />
    );
};

// Animated Circle Component
const AnimatedCircle: React.FC<{
    size: number;
    x: number;
    y: number;
    delay: number;
    color: string;
}> = ({ size, x, y, delay, color }) => {
    const scale = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animate = () => {
            scale.setValue(0);
            opacity.setValue(0);

            Animated.sequence([
                Animated.delay(delay),
                Animated.parallel([
                    Animated.timing(scale, {
                        toValue: 1,
                        duration: 4000,
                        easing: Easing.out(Easing.cubic),
                        useNativeDriver: true,
                    }),
                    Animated.sequence([
                        Animated.timing(opacity, {
                            toValue: 0.1,
                            duration: 1000,
                            useNativeDriver: true,
                        }),
                        Animated.timing(opacity, {
                            toValue: 0,
                            duration: 3000,
                            useNativeDriver: true,
                        }),
                    ]),
                ]),
            ]).start(() => animate());
        };

        animate();
    }, []);

    return (
        <Animated.View
            style={[
                styles.animatedCircle,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    left: x - size / 2,
                    top: y - size / 2,
                    borderColor: color,
                    opacity,
                    transform: [{ scale }],
                },
            ]}
        />
    );
};

export const PremiumBackground: React.FC<AnimatedBackgroundProps> = ({
    color,
    lineCount = 8,
    circleCount = 5,
}) => {
    const lines = Array.from({ length: lineCount }, (_, i) => ({
        id: i,
        x: (width / lineCount) * i + Math.random() * 50,
        delay: Math.random() * 2000,
        duration: 3000 + Math.random() * 2000,
    }));

    const circles = Array.from({ length: circleCount }, (_, i) => ({
        id: i,
        size: 80 + Math.random() * 120,
        x: Math.random() * width,
        y: Math.random() * height,
        delay: Math.random() * 3000,
    }));

    return (
        <>
            {/* Falling Lines */}
            <View style={styles.backgroundContainer} pointerEvents="none">
                {lines.map((line) => (
                    <AnimatedLine
                        key={`line-${line.id}`}
                        x={line.x}
                        delay={line.delay}
                        duration={line.duration}
                        color={color}
                    />
                ))}
            </View>

            {/* Expanding Circles */}
            <View style={styles.backgroundContainer} pointerEvents="none">
                {circles.map((circle) => (
                    <AnimatedCircle
                        key={`circle-${circle.id}`}
                        size={circle.size}
                        x={circle.x}
                        y={circle.y}
                        delay={circle.delay}
                        color={color}
                    />
                ))}
            </View>
        </>
    );
};

const styles = StyleSheet.create({
    backgroundContainer: {
        ...StyleSheet.absoluteFillObject,
        overflow: 'hidden',
    },
    animatedLine: {
        position: 'absolute',
        width: 2,
        height: 100,
        top: -100,
    },
    animatedCircle: {
        position: 'absolute',
        borderWidth: 2,
    },
});

export default PremiumBackground;
