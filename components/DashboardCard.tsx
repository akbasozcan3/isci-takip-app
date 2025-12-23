import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

interface Props {
  title: string;
  subtitle?: string;
  icon?: string;
  color?: string;
  seeAllRoute?: string;
  children?: React.ReactNode;
}

export default function DashboardCard({ title, subtitle, icon = 'grid', color = '#0EA5E9', seeAllRoute, children }: Props) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={[styles.iconWrap, { borderColor: `${color}33`, backgroundColor: `${color}15` }]}> 
          <Ionicons name={icon as any} size={20} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {seeAllRoute ? (
          <Pressable onPress={() => router.push(seeAllRoute as any)} style={styles.seeAllBtn} android_ripple={{ color: `${color}22` }}>
            <Text style={[styles.seeAllText, { color } ]}>Tümünü Gör →</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.02)'
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1
  },
  title: {
    fontSize: 18,
    color: '#e6eef8',
    fontWeight: '700'
  },
  subtitle: {
    fontSize: 12,
    color: '#94a3b8'
  },
  seeAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600'
  },
  content: {
    marginTop: 4
  }
});
