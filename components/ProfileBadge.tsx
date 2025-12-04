import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { authFetch } from '../utils/auth';

interface Props {
  name?: string | null;
  size?: number;
  style?: ViewStyle;
  onPress?: () => void;
}

function initialsFromName(name?: string | null): string {
  if (!name) return '';
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const ProfileBadge: React.FC<Props> = ({ name, size = 40, style, onPress }) => {
  const [initials, setInitials] = React.useState<string>('');

  React.useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        if (name && name.trim()) {
          if (mounted) setInitials(initialsFromName(name));
          return;
        }
        const r = await authFetch('/users/me');
        if (!mounted) return;
        if (r.ok) {
          const data = await r.json();
          const display = data?.user?.name || data?.user?.email || '';
          setInitials(initialsFromName(display) || String(display).slice(0, 2).toUpperCase());
        }
      } catch {
        // ignore
      }
    };
    run();
    return () => { mounted = false; };
  }, [name]);

  const dim = size;
  const fontSize = Math.max(12, Math.round(dim * 0.38));

  const content = (
    <View style={[styles.badge, { width: dim, height: dim, borderRadius: dim / 2 }, style]}>
      <Text style={[styles.text, { fontSize }]}>{initials || '??'}</Text>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} android_ripple={{ color: 'rgba(255,255,255,0.15)', borderless: true }}>
        {content}
      </Pressable>
    );
  }
  return content;
};

const styles = StyleSheet.create({
  badge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  text: {
    color: '#fff',
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});

export default ProfileBadge;
