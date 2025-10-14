import React from 'react';
import { ActivityIndicator, Image, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View, Pressable, Share, Animated, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getApiBase } from '../../utils/api';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function ArticleDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = (params.id as string) || '';
  const [loading, setLoading] = React.useState(true);
  const [article, setArticle] = React.useState<any>(null);
  const progress = React.useRef(new Animated.Value(0)).current; // 0..1

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`${getApiBase()}/api/articles/${id}`);
        const data = await res.json();
        if (mounted) setArticle(data);
      } catch (e) {
        if (mounted) setArticle(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; }
  }, [id]);

  const onShare = React.useCallback(async () => {
    try {
      const url = `${getApiBase()}/api/articles/${id}`;
      await Share.share({ title: article?.title || 'Makale', message: `${article?.title || ''}\n${url}` });
    } catch {}
  }, [article, id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <View style={styles.center}><ActivityIndicator color="#06b6d4" /></View>
      </SafeAreaView>
    );
  }

  if (!article) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <View style={styles.center}><Text style={{ color: '#94a3b8' }}>Makale bulunamadı.</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient colors={["#06b6d4", "#0ea5a4"]} style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.replace('/(tabs)')} style={styles.backBtn} android_ripple={{ color: 'rgba(255,255,255,0.25)' }}>
            <Text style={styles.backText}>←</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{article.title}</Text>
            <Text style={styles.subtitle}>{article.readTime} • Makale</Text>
          </View>
          <Pressable onPress={onShare} style={styles.shareBtn} android_ripple={{ color: 'rgba(255,255,255,0.25)' }}>
            <Text style={styles.shareText}>↗︎</Text>
          </Pressable>
        </View>
        <Animated.View style={[styles.progressBar, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        scrollEventThrottle={16}
        onScroll={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
          const total = Math.max(1, contentSize.height - layoutMeasurement.height);
          const ratio = Math.min(1, Math.max(0, contentOffset.y / total));
          progress.setValue(ratio);
        }}
      >
        {article.hero ? <Image source={{ uri: article.hero }} style={styles.hero} resizeMode="cover" /> : null}
        <View style={styles.bodyWrap}>
          <View style={styles.body}>
            {/* Simple markdown-like render with quotes, code and bullets */}
            {String(article.content || '')
              .split(/\n\n+/)
              .map((raw: string, i: number) => {
                const block = raw.trim();
                if (block.startsWith('# ')) return <Text key={i} style={styles.h1}>{block.replace(/^#\s+/, '')}</Text>;
                if (block.startsWith('## ')) return <Text key={i} style={styles.h2}>{block.replace(/^##\s+/, '')}</Text>;
                if (block.startsWith('> ')) return (
                  <View key={i} style={styles.quote}><Text style={styles.quoteText}>{block.replace(/^>\s+/, '')}</Text></View>
                );
                if (block.startsWith('```') && block.endsWith('```')) {
                  const code = block.replace(/^```/, '').replace(/```$/, '');
                  return (
                    <View key={i} style={styles.code}><Text style={styles.codeText}>{code}</Text></View>
                  );
                }
                // Bullet list (lines starting with '-')
                const lines = block.split('\n');
                const isBullet = lines.every(l => l.trim().startsWith('- ')) && lines.length > 1;
                if (isBullet) {
                  return (
                    <View key={i} style={styles.list}>
                      {lines.map((l, li) => (
                        <View key={li} style={styles.listRow}>
                          <Text style={styles.bullet}>{'•'}</Text>
                          <Text style={styles.listText}>{l.replace(/^-\s+/, '')}</Text>
                        </View>
                      ))}
                    </View>
                  );
                }
                return <Text key={i} style={styles.p}>{block}</Text>;
              })}
          </View>
        </View>
      </ScrollView>
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
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  backText: { color: '#fff', fontWeight: '900', fontSize: 18 },
  shareBtn: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  shareText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  progressBar: { height: 3, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 3, marginTop: 10 },
  title: { fontSize: 22, fontWeight: '900', color: '#fff' },
  subtitle: { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 6, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { width: '100%', height: 220 },
  bodyWrap: { paddingHorizontal: 16, alignItems: 'center' },
  body: { width: '100%', maxWidth: 820, padding: 18 },
  h1: { color: '#fff', fontSize: 22, fontWeight: '900', marginBottom: 10, letterSpacing: 0.2 },
  h2: { color: '#e2e8f0', fontSize: 18, fontWeight: '900', marginTop: 12, marginBottom: 8 },
  p: { color: '#94a3b8', fontSize: 15, lineHeight: 24, marginBottom: 12, textAlign: 'justify' },
  quote: { borderLeftWidth: 3, borderLeftColor: '#06b6d4', backgroundColor: 'rgba(6,182,212,0.08)', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, marginBottom: 12 },
  quoteText: { color: '#cbd5e1', fontStyle: 'italic' },
  code: { backgroundColor: '#0b1324', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#0f1f2e', marginBottom: 12 },
  codeText: { color: '#e2e8f0', fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) as any, fontSize: 13 },
  list: { marginBottom: 10 },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  bullet: { color: '#06b6d4', fontSize: 14, lineHeight: 22, marginTop: 1 },
  listText: { color: '#94a3b8', fontSize: 15, lineHeight: 22, flex: 1 },
});
