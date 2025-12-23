import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

export type ArticleMeta = {
  id: string;
  title: string;
  excerpt: string;
  readTime: string;
  hero?: string;
};

type Props = {
  item: ArticleMeta;
  onPress: (id: string) => void;
};

export default function ArticleCard({ item, onPress }: Props) {
  return (
    <Pressable
      onPress={() => onPress(item.id)}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }]}
      android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
    >
      <View style={styles.imageWrap}>
        {item.hero ? (
          <Image source={{ uri: item.hero }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]} />
        )}
        <View style={styles.badge}><Text style={styles.badgeText}>{item.readTime}</Text></View>
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.excerpt} numberOfLines={3}>{item.excerpt}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 14,
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  imageWrap: { position: 'relative' },
  image: { width: '100%', height: 170 },
  imagePlaceholder: { backgroundColor: '#0f172a' },
  badge: {
    position: 'absolute', bottom: 10, right: 10,
    backgroundColor: 'rgba(6,182,212,0.9)',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: { color: '#042f35', fontWeight: '900', fontSize: 12 },
  content: { padding: 14 },
  title: { color: '#fff', fontSize: 16, fontWeight: '900', marginBottom: 6 },
  excerpt: { color: '#94a3b8', fontSize: 13, lineHeight: 18 },
});
