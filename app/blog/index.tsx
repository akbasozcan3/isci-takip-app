import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NetworkStatusIcon } from '../../components/NetworkStatusIcon';
import { getApiBase } from '../../utils/api';


type Article = {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  readTime: string;
  category?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  hero?: string | null;
  views?: number;
  viewCount?: number;
  slug?: string;
  featured?: boolean;
  relatedArticles?: Article[];
};

const CATEGORIES = ['Tümü', 'Genel', 'Teknoloji', 'İş Dünyası', 'Güvenlik', 'Verimlilik', 'Gizlilik', 'Yönetim', 'Analiz', 'Kullanım', 'Hizmet', 'Sektör'];

export default function BlogScreen(): React.JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tümü');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    fetchArticles(currentPage, searchQuery, selectedCategory);
  }, [currentPage]);

  // If navigated with /blog?id=..., open that article directly
  useEffect(() => {
    const id = String(params.id || '');
    if (!id || !articles.length) return;
    const art = articles.find(a => a.id === id);
    if (art) setSelectedArticle(art);
  }, [params.id, articles]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const fetchArticles = async (page = 1, search = '', category = '') => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '12',
        sort: 'newest'
      });
      if (search) params.append('search', search);
      if (category && category !== 'Tümü') params.append('category', category);
      
      const response = await fetch(`${getApiBase()}/api/articles?${params.toString()}`);
      const data = await response.json();
      
      if (data.articles && Array.isArray(data.articles)) {
        setArticles(data.articles);
        setTotalPages(data.pagination?.totalPages || 1);
        setCurrentPage(data.pagination?.currentPage || 1);
      } else if (Array.isArray(data)) {
        setArticles(data);
        setTotalPages(1);
        setCurrentPage(1);
      }
    } catch (error) {
      console.error('Error fetching articles:', error);
    }
  };

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchArticles(1, searchQuery, selectedCategory);
    }, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, selectedCategory]);

  const openArticle = async (article: Article) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const response = await fetch(`${getApiBase()}/api/articles/${article.id}?trackView=true`);
      const fullArticle = await response.json();
      setSelectedArticle(fullArticle);
    } catch (error) {
      console.error('Error fetching article:', error);
    setSelectedArticle(article);
    }
  };

  const shareArticle = async (article: Article) => {
    try {
      await Share.share({
        message: `${article.title}\n\n${article.excerpt}\n\nBavaxe Bilgi Merkezi'nde okuyun.`,
        title: article.title
      });
    } catch (error) {
      console.error('Error sharing article:', error);
    }
  };

  const closeArticle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      router.back();
    } catch (e) {
      setSelectedArticle(null);
    }
  };

  // Filter articles
  const filteredArticles = useMemo(() => {
    let filtered = articles;

    // Category filter
    if (selectedCategory !== 'Tümü') {
      filtered = filtered.filter(article => 
        article.category === selectedCategory
      );
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(article =>
        article.title.toLowerCase().includes(query) ||
        article.excerpt.toLowerCase().includes(query) ||
        article.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    return filtered.sort((a, b) => {
      const dateA = new Date(a.createdAt || a.updatedAt).getTime();
      const dateB = new Date(b.createdAt || b.updatedAt).getTime();
      return dateB - dateA; // Newest first
    });
  }, [articles, selectedCategory, searchQuery]);

  const getCategoryColor = (category?: string) => {
    const colors: Record<string, string> = {
      'Genel': '#06b6d4',
      'Teknoloji': '#7c3aed',
      'İş Dünyası': '#10b981',
      'Güvenlik': '#ef4444',
      'Verimlilik': '#f59e0b',
      'Gizlilik': '#3b82f6',
      'Yönetim': '#8b5cf6',
      'Analiz': '#ec4899',
      'Kullanım': '#14b8a6',
      'Hizmet': '#f97316',
      'Sektör': '#6366f1',
    };
    return colors[category || ''] || '#64748b';
  };

  const getCategoryIcon = (category?: string) => {
    const icons: Record<string, string> = {
      'Genel': 'document-text',
      'Teknoloji': 'hardware-chip',
      'İş Dünyası': 'business',
      'Güvenlik': 'shield-checkmark',
      'Verimlilik': 'speedometer',
      'Gizlilik': 'lock-closed',
      'Yönetim': 'people',
      'Analiz': 'analytics',
      'Kullanım': 'phone-portrait',
      'Hizmet': 'headset',
      'Sektör': 'grid',
    };
    return icons[category || ''] || 'document';
  };

  const renderArticleContent = (content: string) => {
    if (!content) return null;

    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let currentParagraph: string[] = [];
    let inList = false;
    let listItems: string[] = [];

    const flushParagraph = () => {
      if (currentParagraph.length > 0) {
        const text = currentParagraph.join(' ').trim();
        if (text) {
          elements.push(
            <Text key={`p-${elements.length}`} style={styles.articleParagraph}>
              {text}
            </Text>
          );
        }
        currentParagraph = [];
      }
    };

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <View key={`list-${elements.length}`} style={styles.listContainer}>
            {listItems.map((item, idx) => (
              <View key={idx} style={styles.listItem}>
                <Ionicons name="ellipse" size={6} color="#06b6d4" style={styles.listBullet} />
                <Text style={styles.listItemText}>{item.trim()}</Text>
              </View>
            ))}
          </View>
        );
        listItems = [];
        inList = false;
      }
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      if (trimmed.startsWith('# ')) {
        flushList();
        flushParagraph();
        elements.push(
          <Text key={`h1-${index}`} style={styles.articleH1}>
            {trimmed.substring(2)}
          </Text>
        );
      } else if (trimmed.startsWith('## ')) {
        flushList();
        flushParagraph();
        elements.push(
          <Text key={`h2-${index}`} style={styles.articleH2}>
            {trimmed.substring(3)}
          </Text>
        );
      } else if (trimmed.startsWith('### ')) {
        flushList();
        flushParagraph();
        elements.push(
          <Text key={`h3-${index}`} style={styles.articleH3}>
            {trimmed.substring(4)}
          </Text>
        );
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        flushParagraph();
        if (!inList) {
          inList = true;
        }
        listItems.push(trimmed.substring(2));
      } else if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
        flushList();
        const boldText = trimmed.substring(2, trimmed.length - 2);
        if (currentParagraph.length === 0) {
          elements.push(
            <Text key={`bold-${index}`} style={styles.articleBold}>
              {boldText}
            </Text>
          );
        } else {
          currentParagraph.push(boldText);
        }
      } else if (trimmed.length === 0) {
        flushList();
        flushParagraph();
      } else {
        flushList();
        currentParagraph.push(trimmed);
      }
    });

    flushList();
    flushParagraph();

    return <View>{elements}</View>;
  };

  // Article detail view
  if (selectedArticle) {
    const categoryColor = getCategoryColor(selectedArticle.category);
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <LinearGradient colors={['#0a0f1a', '#1a1f2e', '#2a2f3e']} style={styles.articleContainer}>
          {/* Article Header */}
          <View style={styles.articleHeader}>
            <Pressable onPress={closeArticle} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </Pressable>
            <View style={[styles.categoryBadge, { backgroundColor: `${categoryColor}20` }]}>
              <Ionicons name={getCategoryIcon(selectedArticle.category) as any} size={16} color={categoryColor} />
              <Text style={[styles.categoryText, { color: categoryColor }]}>
                {selectedArticle.category || 'Genel'}
              </Text>
            </View>
            <Pressable 
              style={styles.shareButton}
              onPress={() => shareArticle(selectedArticle)}
            >
              <Ionicons name="share-outline" size={20} color="#06b6d4" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.articleContent}>
            <View style={styles.brandBadge}>
              <Text style={styles.brandBadgeText}>Bavaxe Bilgi Merkezi</Text>
            </View>

            {/* Hero Image */}
            {selectedArticle.hero && (
              <View style={styles.heroImageContainer}>
                <Image 
                  source={
                    selectedArticle.hero === '../../app/blog/image/ChatGPT Image 9 Ara 2025 10_08_14.png'
                      ? require('./image/ChatGPT Image 9 Ara 2025 10_08_14.png')
                      : typeof selectedArticle.hero === 'string'
                      ? { uri: selectedArticle.hero }
                      : selectedArticle.hero
                  } 
                  style={styles.heroImage}
                  resizeMode="cover"
                />
              </View>
            )}

            {/* Title */}
            <Text style={styles.articleTitle}>{selectedArticle.title}</Text>
            
            {/* Meta */}
            <View style={styles.articleMeta}>
              <View style={styles.metaItem}>
                <Ionicons name="calendar-outline" size={18} color="#06b6d4" />
                <Text style={styles.metaText}>
                  {new Date(selectedArticle.createdAt || selectedArticle.updatedAt).toLocaleDateString('tr-TR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={18} color="#06b6d4" />
                <Text style={styles.metaText}>{selectedArticle.readTime || '5 dk'}</Text>
              </View>
              {selectedArticle.views !== undefined && (
              <View style={styles.metaItem}>
                <Ionicons name="eye-outline" size={18} color="#06b6d4" />
                  <Text style={styles.metaText}>{selectedArticle.views} görüntülenme</Text>
              </View>
              )}
            </View>

            {/* Content */}
            <View style={styles.contentWrapper}>
              <Text style={styles.articleExcerpt}>{selectedArticle.excerpt}</Text>
              {renderArticleContent(selectedArticle.content)}
            </View>

            {/* Tags */}
            {selectedArticle.tags && selectedArticle.tags.length > 0 && (
              <View style={styles.tagsContainer}>
                {selectedArticle.tags.map((tag, idx) => (
                  <View key={idx} style={styles.tag}>
                    <Text style={styles.tagText}>#{tag}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Related Articles */}
            {selectedArticle.relatedArticles && selectedArticle.relatedArticles.length > 0 && (
              <View style={styles.relatedSection}>
                <Text style={styles.relatedTitle}>İlgili Makaleler</Text>
                {selectedArticle.relatedArticles.map((related) => (
                  <Pressable
                    key={related.id}
                    onPress={() => openArticle(related)}
                    style={styles.relatedCard}
                  >
                    <Text style={styles.relatedCardTitle}>{related.title}</Text>
                    <Text style={styles.relatedCardExcerpt} numberOfLines={2}>
                      {related.excerpt}
                    </Text>
                    <View style={styles.relatedCardMeta}>
                      <Text style={styles.relatedCardCategory}>{related.category}</Text>
                      <Text style={styles.relatedCardTime}>{related.readTime}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </ScrollView>
        </LinearGradient>
      </SafeAreaView>
    );
  }


  // Main list view
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Header */}
      <LinearGradient colors={['#0a0f1a', '#1a1f2e']} style={styles.header}>
        <View style={styles.headerContent}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </Pressable>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Bavaxe Makaleleri</Text>
            <Text style={styles.headerSubtitle}>Bavaxe bilgi merkezinde {filteredArticles.length} içerik</Text>
          </View>
          <View style={{ marginLeft: 12 }}>
            <NetworkStatusIcon size={20} />
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#64748b" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Makale ara..."
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color="#64748b" />
            </TouchableOpacity>
          )}
        </View>

        {/* Category Filter */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryContainer}
        >
          {CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category}
              onPress={() => setSelectedCategory(category)}
              style={[
                styles.categoryChip,
                selectedCategory === category && {
                  backgroundColor: getCategoryColor(category),
                },
              ]}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  selectedCategory === category && styles.categoryChipTextActive,
                ]}
              >
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </LinearGradient>

      {/* Articles List */}
      <Animated.ScrollView
        style={[styles.scrollView, { opacity: fadeAnim }]}
        contentContainerStyle={styles.articlesContainer}
        showsVerticalScrollIndicator={false}
      >
        {filteredArticles.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color="#64748b" />
            <Text style={styles.emptyStateText}>Makale bulunamadı</Text>
            <Text style={styles.emptyStateSubtext}>
              {searchQuery ? 'Arama kriterlerinizi değiştirmeyi deneyin' : 'Henüz makale eklenmemiş'}
            </Text>
          </View>
        ) : (
          filteredArticles.map((article) => {
            const categoryColor = getCategoryColor(article.category);
            return (
              <Pressable
                key={article.id}
                onPress={() => openArticle(article)}
                style={({ pressed }) => [
                  styles.articleCard,
                  pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
                ]}
              >
                <LinearGradient
                  colors={['rgba(15, 31, 53, 0.95)', 'rgba(11, 18, 32, 0.98)']}
                  style={styles.cardGradient}
                >
                  <View style={styles.cardHeader}>
                    <View style={[styles.cardIcon, { backgroundColor: `${categoryColor}20` }]}>
                      <Ionicons name={getCategoryIcon(article.category) as any} size={24} color={categoryColor} />
                    </View>
                    <View style={[styles.cardCategory, { backgroundColor: `${categoryColor}15` }]}>
                      <Text style={[styles.cardCategoryText, { color: categoryColor }]}>
                        {article.category || 'Genel'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.cardTitle}>{article.title}</Text>
                  <Text style={styles.cardExcerpt}>{article.excerpt}</Text>

                  <View style={styles.cardFooter}>
                    <View style={styles.cardMeta}>
                      <Ionicons name="calendar-outline" size={14} color={categoryColor} />
                      <Text style={[styles.cardMetaText, { color: categoryColor }]}>
                        {new Date(article.createdAt || article.updatedAt).toLocaleDateString('tr-TR', {
                          day: 'numeric',
                          month: 'short'
                        })}
                      </Text>
                    </View>
                    <View style={styles.cardMeta}>
                      <Ionicons name="time-outline" size={14} color={categoryColor} />
                      <Text style={[styles.cardMetaText, { color: categoryColor }]}>{article.readTime || '5 dk'}</Text>
                    </View>
                    {article.views !== undefined && (
                      <View style={styles.cardMeta}>
                        <Ionicons name="eye-outline" size={14} color={categoryColor} />
                        <Text style={[styles.cardMetaText, { color: categoryColor }]}>{article.views}</Text>
                      </View>
                    )}
                    {article.tags && article.tags.length > 0 && (
                      <View style={styles.cardMeta}>
                        <Ionicons name="pricetag-outline" size={14} color={categoryColor} />
                        <Text style={[styles.cardMetaText, { color: categoryColor }]}>{article.tags.length}</Text>
                      </View>
                    )}
                    <Ionicons name="chevron-forward" size={20} color={categoryColor} />
                  </View>
                </LinearGradient>
              </Pressable>
            );
          })
        )}
      </Animated.ScrollView>

      {/* Pagination */}
      {totalPages > 1 && (
        <View style={styles.pagination}>
          <Pressable
            onPress={() => {
              if (currentPage > 1) {
                setCurrentPage(currentPage - 1);
              }
            }}
            disabled={currentPage === 1}
            style={[styles.paginationButton, currentPage === 1 && styles.paginationButtonDisabled]}
          >
            <Ionicons name="chevron-back" size={20} color={currentPage === 1 ? "#64748b" : "#06b6d4"} />
          </Pressable>
          
          <Text style={styles.paginationText}>
            Sayfa {currentPage} / {totalPages}
          </Text>
          
          <Pressable
            onPress={() => {
              if (currentPage < totalPages) {
                setCurrentPage(currentPage + 1);
              }
            }}
            disabled={currentPage === totalPages}
            style={[styles.paginationButton, currentPage === totalPages && styles.paginationButtonDisabled]}
          >
            <Ionicons name="chevron-forward" size={20} color={currentPage === totalPages ? "#64748b" : "#06b6d4"} />
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 16,
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
  },
  header: {
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 20 : 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.5,
    fontFamily: 'Poppins-Bold',
    lineHeight: 38,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#64748b',
    marginTop: 6,
    fontWeight: '500',
    fontFamily: 'Poppins-Medium',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Poppins-Regular',
  },
  clearButton: {
    padding: 4,
  },
  categoryContainer: {
    paddingVertical: 8,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  categoryChipText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
  },
  categoryChipTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  articlesContainer: {
    padding: 20,
    gap: 16,
    alignItems: 'center',
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  articleCard: {
    borderRadius: 20,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 600,
  },
  cardGradient: {
    padding: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(6,182,212,0.3)',
    borderRadius: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCategory: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cardCategoryText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    fontFamily: 'Poppins-Bold',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 10,
    lineHeight: 28,
    fontFamily: 'Poppins-ExtraBold',
    letterSpacing: -0.3,
  },
  cardExcerpt: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 22,
    marginBottom: 16,
    fontFamily: 'Poppins-Regular',
    letterSpacing: 0.1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardMetaText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
  },
  
  // Article View
  articleContainer: {
    flex: 1,
  },
  articleHeader: {
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 20 : 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  shareButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(6,182,212,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.3)',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    fontFamily: 'Poppins-Bold',
  },
  articleContent: {
    padding: 24,
    paddingBottom: 80,
  },
  heroImageContainer: {
    width: '100%',
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(6,182,212,0.1)',
  },
  heroImage: {
    width: '100%',
    height: 240,
    borderRadius: 16,
  },
  brandBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(6,182,212,0.12)',
    marginBottom: 16,
  },
  brandBadgeText: {
    color: '#06b6d4',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  articleTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    lineHeight: 42,
    marginBottom: 20,
    fontFamily: 'Poppins-Bold',
    letterSpacing: -0.5,
  },
  articleMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(6,182,212,0.2)',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(6,182,212,0.1)',
  },
  metaText: {
    fontSize: 13,
    color: '#06b6d4',
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
  },
  contentWrapper: {
    marginBottom: 24,
  },
  articleExcerpt: {
    fontSize: 18,
    color: '#cbd5e1',
    lineHeight: 28,
    marginBottom: 24,
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
  },
  articleBody: {
    fontSize: 16,
    color: '#94a3b8',
    lineHeight: 26,
    fontFamily: 'Poppins-Regular',
  },
  articleParagraph: {
    fontSize: 16,
    color: '#cbd5e1',
    lineHeight: 28,
    marginBottom: 20,
    fontFamily: 'Poppins-Regular',
  },
  articleH1: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    marginTop: 32,
    marginBottom: 16,
    lineHeight: 36,
    fontFamily: 'Poppins-Bold',
  },
  articleH2: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginTop: 28,
    marginBottom: 12,
    lineHeight: 32,
    fontFamily: 'Poppins-Bold',
  },
  articleH3: {
    fontSize: 20,
    fontWeight: '700',
    color: '#e2e8f0',
    marginTop: 24,
    marginBottom: 10,
    lineHeight: 28,
    fontFamily: 'Poppins-SemiBold',
  },
  articleBold: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
    fontFamily: 'Poppins-Bold',
  },
  listContainer: {
    marginVertical: 16,
    marginLeft: 8,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingRight: 16,
  },
  listBullet: {
    marginTop: 8,
    marginRight: 12,
  },
  listItemText: {
    flex: 1,
    fontSize: 16,
    color: '#cbd5e1',
    lineHeight: 26,
    fontFamily: 'Poppins-Regular',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(6,182,212,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.3)',
  },
  tagText: {
    color: '#06b6d4',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyStateText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 20,
    fontFamily: 'Poppins-Bold',
    textAlign: 'center',
  },
  emptyStateSubtext: {
    color: '#64748b',
    fontSize: 15,
    marginTop: 10,
    textAlign: 'center',
    fontFamily: 'Poppins-Regular',
    lineHeight: 22,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(10, 15, 26, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(6,182,212,0.2)',
    gap: 16,
  },
  paginationButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(6,182,212,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.3)',
  },
  paginationButtonDisabled: {
    opacity: 0.5,
    backgroundColor: 'rgba(100,116,139,0.1)',
    borderColor: 'rgba(100,116,139,0.2)',
  },
  paginationText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
    minWidth: 100,
    textAlign: 'center',
  },
  relatedSection: {
    marginTop: 32,
    paddingTop: 32,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  relatedTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 20,
    fontFamily: 'Poppins-Bold',
  },
  relatedCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.2)',
  },
  relatedCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    fontFamily: 'Poppins-Bold',
  },
  relatedCardExcerpt: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 12,
    lineHeight: 20,
    fontFamily: 'Poppins-Regular',
  },
  relatedCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  relatedCardCategory: {
    fontSize: 12,
    color: '#06b6d4',
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
  },
  relatedCardTime: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: 'Poppins-Regular',
  },
});
