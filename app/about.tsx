import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import {
    Linking,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import Reanimated, { FadeInDown } from 'react-native-reanimated';
import { PremiumBackground } from '../components/PremiumBackground';
import { BrandLogo } from '../components/BrandLogo';

const FEATURES = [
    { icon: 'location', title: 'Gerçek Zamanlı Takip', description: 'Anlık konum paylaşımı ve takibi' },
    { icon: 'people', title: 'Grup Yönetimi', description: 'Ekip üyelerinizi kolayca yönetin' },
    { icon: 'stats-chart', title: 'Detaylı Analiz', description: 'Kapsamlı raporlar ve istatistikler' },
    { icon: 'shield-checkmark', title: 'Güvenli', description: 'End-to-end şifreleme ile korumalı' },
];

const TEAM = [
    { role: 'Geliştirme', name: 'Bavaxe Team' },
    { role: 'Tasarım', name: 'Bavaxe Design' },
    { role: 'Destek', name: 'Bavaxe Support' },
];

export default function AboutScreen() {
    const router = useRouter();

    const handleOpenLink = (url: string) => {
        Linking.openURL(url).catch(err => console.error('Link açılamadı:', err));
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#0f172a', '#1e293b', '#334155']}
                style={styles.gradient}
            >
                <StatusBar barStyle="light-content" />
                <PremiumBackground color="#0EA5E9" lineCount={6} circleCount={4} />

                {/* Header */}
                <View style={styles.header}>
                    <Pressable
                        onPress={() => router.back()}
                        style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
                    >
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </Pressable>
                    <Text style={styles.headerTitle}>Hakkında</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView
                    style={styles.content}
                    contentContainerStyle={styles.contentContainer}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Logo & Version */}
                    <Reanimated.View entering={FadeInDown.springify()} style={styles.logoCard}>
                        <BrandLogo size={250} withSoftContainer={false} variant="default" />
                        <Text style={styles.appName}>Bavaxe</Text>
                        <Text style={styles.tagline}>Konum Takip Sistemi</Text>
                        <View style={styles.versionBadge}>
                            <Text style={styles.versionText}>v1.0.0</Text>
                        </View>
                    </Reanimated.View>

                    {/* Description */}
                    <Reanimated.View entering={FadeInDown.delay(100).springify()} style={styles.descriptionCard}>
                        <Text style={styles.descriptionTitle}>Bavaxe Nedir?</Text>
                        <Text style={styles.descriptionText}>
                            Bavaxe, modern ve güvenli bir konum takip sistemidir. Ekip üyelerinizin konumlarını
                            gerçek zamanlı olarak takip edebilir, detaylı raporlar alabilir ve iş süreçlerinizi
                            optimize edebilirsiniz.
                        </Text>
                    </Reanimated.View>

                    {/* Features */}
                    <Reanimated.View entering={FadeInDown.delay(200).springify()} style={styles.section}>
                        <Text style={styles.sectionTitle}>Özellikler</Text>
                        <View style={styles.featuresGrid}>
                            {FEATURES.map((feature, index) => (
                                <View key={index} style={styles.featureCard}>
                                    <View style={styles.featureIcon}>
                                        <Ionicons name={feature.icon as any} size={24} color="#0EA5E9" />
                                    </View>
                                    <Text style={styles.featureTitle}>{feature.title}</Text>
                                    <Text style={styles.featureDescription}>{feature.description}</Text>
                                </View>
                            ))}
                        </View>
                    </Reanimated.View>

                    {/* Team */}
                    <Reanimated.View entering={FadeInDown.delay(300).springify()} style={styles.section}>
                        <Text style={styles.sectionTitle}>Ekibimiz</Text>
                        {TEAM.map((member, index) => (
                            <View key={index} style={styles.teamMember}>
                                <View style={styles.teamIcon}>
                                    <Ionicons name="person" size={20} color="#0EA5E9" />
                                </View>
                                <View style={styles.teamInfo}>
                                    <Text style={styles.teamRole}>{member.role}</Text>
                                    <Text style={styles.teamName}>{member.name}</Text>
                                </View>
                            </View>
                        ))}
                    </Reanimated.View>

                    {/* Social Links */}
                    <Reanimated.View entering={FadeInDown.delay(400).springify()} style={styles.section}>
                        <Text style={styles.sectionTitle}>Bizi Takip Edin</Text>
                        <View style={styles.socialLinks}>
                            <Pressable
                                onPress={() => handleOpenLink('https://twitter.com/bavaxe')}
                                style={({ pressed }) => [styles.socialButton, pressed && { opacity: 0.7 }]}
                            >
                                <Ionicons name="logo-twitter" size={24} color="#1DA1F2" />
                            </Pressable>
                            <Pressable
                                onPress={() => handleOpenLink('https://instagram.com/bavaxe')}
                                style={({ pressed }) => [styles.socialButton, pressed && { opacity: 0.7 }]}
                            >
                                <Ionicons name="logo-instagram" size={24} color="#E4405F" />
                            </Pressable>
                            <Pressable
                                onPress={() => handleOpenLink('https://linkedin.com/company/bavaxe')}
                                style={({ pressed }) => [styles.socialButton, pressed && { opacity: 0.7 }]}
                            >
                                <Ionicons name="logo-linkedin" size={24} color="#0A66C2" />
                            </Pressable>
                            <Pressable
                                onPress={() => handleOpenLink('https://github.com/bavaxe')}
                                style={({ pressed }) => [styles.socialButton, pressed && { opacity: 0.7 }]}
                            >
                                <Ionicons name="logo-github" size={24} color="#fff" />
                            </Pressable>
                        </View>
                    </Reanimated.View>

                    {/* Legal */}
                    <Reanimated.View entering={FadeInDown.delay(500).springify()} style={styles.legalCard}>
                        <Pressable
                            onPress={() => handleOpenLink('https://bavaxe.com/privacy')}
                            style={({ pressed }) => [styles.legalButton, pressed && { opacity: 0.7 }]}
                        >
                            <Ionicons name="shield-checkmark-outline" size={20} color="#94a3b8" />
                            <Text style={styles.legalText}>Gizlilik Politikası</Text>
                            <Ionicons name="chevron-forward" size={20} color="#64748b" />
                        </Pressable>
                        <View style={styles.legalDivider} />
                        <Pressable
                            onPress={() => handleOpenLink('https://bavaxe.com/terms')}
                            style={({ pressed }) => [styles.legalButton, pressed && { opacity: 0.7 }]}
                        >
                            <Ionicons name="document-text-outline" size={20} color="#94a3b8" />
                            <Text style={styles.legalText}>Kullanım Koşulları</Text>
                            <Ionicons name="chevron-forward" size={20} color="#64748b" />
                        </Pressable>
                    </Reanimated.View>

                    {/* Copyright */}
                    <Text style={styles.copyright}>
                        © 2024 Bavaxe. Tüm hakları saklıdır.
                    </Text>
                </ScrollView>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    gradient: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
        fontFamily: 'Poppins-Bold',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    logoCard: {
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 24,
        padding: 32,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    appName: {
        fontSize: 28,
        fontWeight: '800',
        color: '#fff',
        marginTop: -72,
        fontFamily: 'Poppins-Bold',
    },
    tagline: {
        fontSize: 14,
        color: '#94a3b8',
        marginTop: 4,
        fontFamily: 'Poppins-Regular',
    },
    versionBadge: {
        backgroundColor: 'rgba(14, 165, 233, 0.2)',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 16,
        marginTop: 12,
    },
    versionText: {
        fontSize: 12,
        color: '#0EA5E9',
        fontFamily: 'Poppins-SemiBold',
    },
    descriptionCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 20,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    descriptionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 12,
        fontFamily: 'Poppins-Bold',
    },
    descriptionText: {
        fontSize: 14,
        color: '#cbd5e1',
        lineHeight: 22,
        fontFamily: 'Poppins-Regular',
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 16,
        fontFamily: 'Poppins-Bold',
    },
    featuresGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    featureCard: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    featureIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(14, 165, 233, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    featureTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 4,
        fontFamily: 'Poppins-SemiBold',
    },
    featureDescription: {
        fontSize: 12,
        color: '#94a3b8',
        lineHeight: 18,
        fontFamily: 'Poppins-Regular',
    },
    teamMember: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    teamIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(14, 165, 233, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    teamInfo: {
        flex: 1,
    },
    teamRole: {
        fontSize: 12,
        color: '#94a3b8',
        marginBottom: 2,
        fontFamily: 'Poppins-Regular',
    },
    teamName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
        fontFamily: 'Poppins-SemiBold',
    },
    socialLinks: {
        flexDirection: 'row',
        gap: 12,
    },
    socialButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    legalCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        marginBottom: 24,
    },
    legalButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
    },
    legalText: {
        flex: 1,
        fontSize: 15,
        color: '#cbd5e1',
        fontFamily: 'Poppins-Regular',
    },
    legalDivider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    copyright: {
        fontSize: 12,
        color: '#64748b',
        textAlign: 'center',
        fontFamily: 'Poppins-Regular',
    },
});
