import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import Reanimated, { FadeInDown } from 'react-native-reanimated';
import { PremiumBackground } from '../components/PremiumBackground';
import { authFetch } from '../utils/auth';

interface FAQ {
    id: number;
    category: string;
    question: string;
    answer: string;
    order: number;
}

export default function FAQScreen() {
    const router = useRouter();
    const [faqs, setFaqs] = useState<FAQ[]>([]);
    const [filteredFaqs, setFilteredFaqs] = useState<FAQ[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Tümü');
    const [expandedId, setExpandedId] = useState<number | null>(null);

    const categories = ['Tümü', 'Genel', 'Hesap', 'Konum Takibi', 'Abonelik', 'Güvenlik', 'Teknik'];

    useEffect(() => {
        loadFAQs();
    }, []);

    useEffect(() => {
        filterFAQs();
    }, [searchQuery, selectedCategory, faqs]);

    const loadFAQs = async () => {
        try {
            const response = await authFetch('/faq');
            if (response.ok) {
                const data = await response.json();
                setFaqs(data.data?.faqs || []);
            }
        } catch (error) {
            console.error('[FAQ] Load error:', error);
        } finally {
            setLoading(false);
        }
    };

    const filterFAQs = () => {
        let filtered = faqs;

        if (selectedCategory !== 'Tümü') {
            filtered = filtered.filter(faq => faq.category === selectedCategory);
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(
                faq =>
                    faq.question.toLowerCase().includes(query) ||
                    faq.answer.toLowerCase().includes(query)
            );
        }

        setFilteredFaqs(filtered);
    };

    const toggleExpand = (id: number) => {
        setExpandedId(expandedId === id ? null : id);
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#0f172a', '#1e293b', '#334155']}
                style={styles.gradient}
            >
                <StatusBar barStyle="light-content" />
                <PremiumBackground color="#06B6D4" lineCount={6} circleCount={4} />

                {/* Header */}
                <View style={styles.header}>
                    <Pressable
                        onPress={() => router.back()}
                        style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
                    >
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </Pressable>
                    <Text style={styles.headerTitle}>Sıkça Sorulan Sorular</Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <View style={styles.searchBar}>
                        <Ionicons name="search" size={20} color="#94a3b8" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Soru ara..."
                            placeholderTextColor="#64748b"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <Pressable onPress={() => setSearchQuery('')}>
                                <Ionicons name="close-circle" size={20} color="#64748b" />
                            </Pressable>
                        )}
                    </View>
                </View>

                {/* Category Pills */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.categoriesContainer}
                    contentContainerStyle={styles.categoriesContent}
                >
                    {categories.map((category) => (
                        <Pressable
                            key={category}
                            onPress={() => setSelectedCategory(category)}
                            style={({ pressed }) => [
                                styles.categoryPill,
                                selectedCategory === category && styles.categoryPillActive,
                                pressed && { opacity: 0.7 },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.categoryText,
                                    selectedCategory === category && styles.categoryTextActive,
                                ]}
                            >
                                {category}
                            </Text>
                        </Pressable>
                    ))}
                </ScrollView>

                {/* FAQ List */}
                <ScrollView
                    style={styles.content}
                    contentContainerStyle={styles.contentContainer}
                    showsVerticalScrollIndicator={false}
                >
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#0EA5E9" />
                            <Text style={styles.loadingText}>Yükleniyor...</Text>
                        </View>
                    ) : filteredFaqs.length === 0 ? (
                        <Reanimated.View entering={FadeInDown.springify()} style={styles.emptyContainer}>
                            <View style={styles.emptyIcon}>
                                <Ionicons name="help-circle-outline" size={64} color="#475569" />
                            </View>
                            <Text style={styles.emptyTitle}>Sonuç Bulunamadı</Text>
                            <Text style={styles.emptyText}>
                                {searchQuery
                                    ? 'Arama kriterlerinize uygun soru bulunamadı'
                                    : 'Bu kategoride henüz soru bulunmuyor'}
                            </Text>
                        </Reanimated.View>
                    ) : (
                        filteredFaqs.map((faq, index) => (
                            <Reanimated.View
                                key={faq.id}
                                entering={FadeInDown.delay(index * 50).springify()}
                                style={styles.faqCard}
                            >
                                <Pressable
                                    onPress={() => toggleExpand(faq.id)}
                                    style={({ pressed }) => [
                                        styles.faqHeader,
                                        pressed && { opacity: 0.7 },
                                    ]}
                                >
                                    <View style={styles.faqHeaderContent}>
                                        <View style={styles.faqIconContainer}>
                                            <Ionicons
                                                name={expandedId === faq.id ? 'chevron-down' : 'chevron-forward'}
                                                size={20}
                                                color="#0EA5E9"
                                            />
                                        </View>
                                        <Text style={styles.faqQuestion}>{faq.question}</Text>
                                    </View>
                                    <View style={styles.categoryBadge}>
                                        <Text style={styles.categoryBadgeText}>{faq.category}</Text>
                                    </View>
                                </Pressable>

                                {expandedId === faq.id && (
                                    <Reanimated.View
                                        entering={FadeInDown.springify()}
                                        style={styles.faqAnswer}
                                    >
                                        <View style={styles.answerDivider} />
                                        <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                                    </Reanimated.View>
                                )}
                            </Reanimated.View>
                        ))
                    )}
                </ScrollView>
            </LinearGradient>
        </View >
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
    searchContainer: {
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    searchInput: {
        flex: 1,
        color: '#fff',
        fontSize: 15,
        fontFamily: 'Poppins-Regular',
    },
    categoriesContainer: {
        marginBottom: 16,
    },
    categoriesContent: {
        paddingHorizontal: 20,
        gap: 8,
    },
    categoryPill: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        marginRight: 8,
    },
    categoryPillActive: {
        backgroundColor: '#0EA5E9',
        borderColor: '#0EA5E9',
    },
    categoryText: {
        fontSize: 13,
        color: '#94a3b8',
        fontFamily: 'Poppins-Medium',
    },
    categoryTextActive: {
        color: '#fff',
        fontFamily: 'Poppins-SemiBold',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 14,
        color: '#94a3b8',
        fontFamily: 'Poppins-Regular',
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyIcon: {
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 8,
        fontFamily: 'Poppins-Bold',
    },
    emptyText: {
        fontSize: 14,
        color: '#94a3b8',
        textAlign: 'center',
        paddingHorizontal: 40,
        fontFamily: 'Poppins-Regular',
    },
    faqCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        overflow: 'hidden',
    },
    faqHeader: {
        padding: 16,
    },
    faqHeaderContent: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    faqIconContainer: {
        marginRight: 12,
        marginTop: 2,
    },
    faqQuestion: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        fontFamily: 'Poppins-SemiBold',
        lineHeight: 24,
    },
    categoryBadge: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(6, 182, 212, 0.15)',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        marginLeft: 32,
    },
    categoryBadgeText: {
        fontSize: 11,
        color: '#06B6D4',
        fontFamily: 'Poppins-Medium',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    faqAnswer: {
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    answerDivider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        marginBottom: 12,
        marginLeft: 32,
    },
    faqAnswerText: {
        fontSize: 14,
        color: '#cbd5e1',
        lineHeight: 22,
        fontFamily: 'Poppins-Regular',
        marginLeft: 32,
    },
});
