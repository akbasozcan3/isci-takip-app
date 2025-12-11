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
          style={{ 
            position: 'absolute', 
            top: 48, 
            left: 20,
            right: 20,
            width: '90%',
            maxWidth: 400,
            alignSelf: 'center',
            transform: [{ translateY: translate }], 
            opacity 
          }}
        >
          <View
            style={{
              borderRadius: 16,
              padding: 16,
              backgroundColor: bgColor(queue[0].type),
              borderWidth: 1.5,
              borderColor: borderColor(queue[0].type),
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              shadowColor: borderColor(queue[0].type),
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.3,
              shadowRadius: 20,
              elevation: 18,
              borderTopWidth: 2,
              borderTopColor: `${borderColor(queue[0].type)}80`,
            }}
          >
            <View style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: `${borderColor(queue[0].type)}20`,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Ionicons name={iconName(queue[0].type)} size={22} color={borderColor(queue[0].type)} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#e5e7eb', fontWeight: '700', fontSize: 15, letterSpacing: 0.3 }}>{queue[0].title}</Text>
              {!!queue[0].description && (
                <Text style={{ color: '#cbd5e1', marginTop: 4, fontSize: 13, lineHeight: 18 }}>{queue[0].description}</Text>
              )}
            </View>
            <Pressable 
              onPress={() => animateOut(() => setQueue((q) => q.slice(1)))} 
              hitSlop={10}
              style={{
                padding: 4,
                borderRadius: 8,
                backgroundColor: 'rgba(148, 163, 184, 0.1)',
              }}
            >
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
