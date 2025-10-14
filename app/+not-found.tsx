import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function NotFoundScreen(): React.JSX.Element {
  const router = useRouter();
  
  return (
    <View style={styles.container}>
      <Ionicons name="alert-circle-outline" size={80} color="#06b6d4" />
      <Text style={styles.title}>404</Text>
      <Text style={styles.subtitle}>Sayfa Bulunamadı</Text>
      <Text style={styles.description}>Aradığınız sayfa mevcut değil veya taşınmış olabilir.</Text>
      
      <Pressable style={styles.button} onPress={() => router.replace('/(tabs)')}>
        <Ionicons name="home" size={20} color="#fff" />
        <Text style={styles.buttonText}>Ana Sayfaya Dön</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#0f172a',
  },
  title: {
    fontSize: 64,
    fontWeight: '900',
    marginTop: 16,
    marginBottom: 8,
    color: '#fff',
  },
  subtitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#06b6d4',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
