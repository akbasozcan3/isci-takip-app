import { Ionicons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';

type MessageType = 'success' | 'error' | 'info';

type Toast = {
  id: number;
  type: MessageType;
  title: string;
  description?: string;
  duration?: number; // ms
};

type MessageContextValue = {
  show: (msg: Omit<Toast, 'id'>) => void;
};

const MessageContext = createContext<MessageContextValue | undefined>(undefined);

export function MessageProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<Toast[]>([]);
  const idRef = useRef(1);
  const translate = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const pathname = usePathname?.() as string | undefined;

  const animateIn = useCallback(() => {
    Animated.parallel([
      Animated.timing(translate, { toValue: 0, duration: 250, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true })
    ]).start();
  }, [opacity, translate]);

  const animateOut = useCallback((cb?: () => void) => {
    Animated.parallel([
      Animated.timing(translate, { toValue: -100, duration: 250, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 200, easing: Easing.in(Easing.quad), useNativeDriver: true })
    ]).start(({ finished }) => finished && cb && cb());
  }, [opacity, translate]);

  const show = useCallback((msg: Omit<Toast, 'id'>) => {
    const id = idRef.current++;
    const toast: Toast = { id, duration: 3200, ...msg };
    setQueue((q) => {
      const next = [...q, toast];
      // if adding first item, animate in on next frame
      if (q.length === 0) {
        requestAnimationFrame(() => animateIn());
      }
      return next;
    });
  }, [animateIn]);

  // Auto-dismiss currently visible toast
  React.useEffect(() => {
    if (!queue.length) return;
    const current = queue[0];
    const t = setTimeout(() => {
      animateOut(() => setQueue((q) => q.slice(1)));
    }, current.duration);
    return () => clearTimeout(t);
  }, [queue, animateOut]);

  // Dismiss on route change to avoid lingering messages across screens
  React.useEffect(() => {
    if (!pathname) return;
    if (queue.length === 0) return;
    animateOut(() => setQueue([]));
  }, [pathname, queue.length, animateOut]);

  const ctx = useMemo<MessageContextValue>(() => ({ show }), [show]);

  const iconName = (type: MessageType) => (
    type === 'success' ? 'checkmark-circle' : type === 'error' ? 'close-circle' : 'information-circle'
  ) as any;
  const borderColor = (type: MessageType) => (
    type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#60a5fa'
  );
  const bgColor = (type: MessageType) => (
    type === 'success' ? 'rgba(16,185,129,0.12)' : type === 'error' ? 'rgba(239,68,68,0.12)' : 'rgba(96,165,250,0.12)'
  );

  return (
    <MessageContext.Provider value={ctx}>
      {children}
      {queue.length > 0 && (
        <Animated.View
          pointerEvents="box-none"
          style={{ position: 'absolute', top: 48, left: 16, right: 16, transform: [{ translateY: translate }], opacity }}
        >
          <View
            style={{
              borderRadius: 12,
              padding: 12,
              backgroundColor: bgColor(queue[0].type),
              borderWidth: 1,
              borderColor: borderColor(queue[0].type),
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10
            }}
          >
            <Ionicons name={iconName(queue[0].type)} size={22} color={borderColor(queue[0].type)} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#e5e7eb', fontWeight: '700' }}>{queue[0].title}</Text>
              {!!queue[0].description && (
                <Text style={{ color: '#cbd5e1', marginTop: 2 }}>{queue[0].description}</Text>
              )}
            </View>
            <Pressable onPress={() => animateOut(() => setQueue((q) => q.slice(1)))} hitSlop={10}>
              <Ionicons name="close" size={18} color="#94a3b8" />
            </Pressable>
          </View>
        </Animated.View>
      )}
    </MessageContext.Provider>
  );
}

export function useMessage() {
  const ctx = useContext(MessageContext);
  if (!ctx) throw new Error('useMessage must be used within MessageProvider');
  return ctx;
}
