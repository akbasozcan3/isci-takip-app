import React from 'react';
import { ActivityIndicator, FlatList, RefreshControl, SafeAreaView, StatusBar, StyleSheet, Text, View, Pressable, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import ArticleCard, { ArticleMeta } from '../../components/ArticleCard';
import { getApiBase } from '../../utils/api';

export default function BlogListScreen() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [items, setItems] = React.useState<ArticleMeta[]>([]);
  const [query, setQuery] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${getApiBase()}/api/articles`);
      const data = await res.json();
      setItems(data);
    } catch (e) {
      // offline fallback (mock minimal list)
      setItems([
        { id: 'offline-1', title: 'Offline: İşçi Takibe Giriş', excerpt: 'Ağ yokken gösterilen örnek içerik.', readTime: '3 dk', hero: undefined },
        { id: 'offline-2', title: 'Offline: Güvenlik Notları', excerpt: 'Bağlantı gelene kadar kısa okumalar.', readTime: '2 dk', hero: undefined },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient colors={["#06b6d4", "#0ea5a4"]} style={styles.header}>
        <View style={styles.headerInner}>
          <Pressable onPress={() => router.replace('/(tabs)')} style={styles.backBtn} android_ripple={{ color: 'rgba(255,255,255,0.25)' }}>
            <Text style={styles.backText}>←</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Blog & Rehberler</Text>
            <Text style={styles.subtitle}>İpucu, rehber ve en iyi uygulamalar</Text>
          </View>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#06b6d4" /></View>
      ) : items.length === 0 ? (
        <View style={styles.center}><Text style={{ color: '#94a3b8' }}>Henüz makale yok.</Text></View>
      ) : (
        <>
          <View style={styles.searchRow}>
            <TextInput
              placeholder="Makale ara..."
              placeholderTextColor="#7a8aa0"
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
            />
          </View>
          <FlatList
            data={items.filter((x) => (x.title + ' ' + x.excerpt).toLowerCase().includes(query.toLowerCase()))}
            keyExtractor={(i) => i.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 120 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            renderItem={({ item }) => (
              <ArticleCard item={item} onPress={(id) => router.push(`/blog/${id}` as any)} />
            )}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    paddingTop: StatusBar.currentHeight ?? 18,
    paddingHorizontal: 18,
    paddingBottom: 18,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  headerInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  backText: { color: '#fff', fontWeight: '900', fontSize: 18 },
  title: { fontSize: 24, fontWeight: '900', color: '#fff' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  searchRow: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  searchInput: { backgroundColor: '#1e293b', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: '#fff', borderWidth: 1, borderColor: '#334155' },
});
