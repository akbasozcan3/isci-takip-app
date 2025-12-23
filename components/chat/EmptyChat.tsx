import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function EmptyChat() {
    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#6366f1', '#8b5cf6']}
                style={styles.iconGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <Ionicons name="chatbubbles" size={64} color="#fff" />
            </LinearGradient>
            <Text style={styles.title}>Henüz Mesaj Yok</Text>
            <Text style={styles.subtitle}>
                İlk mesajı göndererek{'\n'}sohbeti başlatın
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    iconGradient: {
        width: 120,
        height: 120,
        borderRadius: 60,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
    },
    title: {
        fontSize: 22,
        fontWeight: '900',
        color: '#fff',
        marginBottom: 8,
        fontFamily: 'Poppins-Bold',
        letterSpacing: 0.3,
    },
    subtitle: {
        fontSize: 15,
        color: '#94a3b8',
        textAlign: 'center',
        lineHeight: 22,
        fontFamily: 'Poppins-Regular',
    },
});
