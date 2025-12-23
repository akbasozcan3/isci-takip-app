import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useRef, useState } from 'react';
import { useStepTracker } from '../../hooks/useStepTracker';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NetworkStatusIcon } from '../../components/NetworkStatusIcon';
import { UnifiedHeader } from '../../components/UnifiedHeader';
import { useProfile } from '../../contexts/ProfileContext';
import { Toast, useToast } from '../../components/Toast';
import theme from '../../components/ui/theme';
import { authFetch } from '../../utils/auth';

const { width } = Dimensions.get('window');

interface StepData {
  steps: number;
  distance: number;
  calories: number;
  duration: number;
  date: string;
}

const ACHIEVEMENTS_MAP: Record<string, { title: string; icon: string; color: string }> = {
  first_1000: { title: 'İlk 1000 Adım', icon: 'footsteps', color: theme.colors.primary },
  first_5000: { title: 'İlk 5000 Adım', icon: 'walk', color: theme.colors.accent },
  first_10000: { title: 'İlk 10000 Adım', icon: 'trophy', color: theme.colors.warning },
  first_km: { title: 'İlk Kilometre', icon: 'map', color: theme.colors.success },
  first_5km: { title: '5 Kilometre', icon: 'map', color: theme.colors.success },
  first_10km: { title: '10 Kilometre', icon: 'map', color: theme.colors.success },
  week_streak_7: { title: '7 Gün Serisi', icon: 'flame', color: theme.colors.error },
  week_streak_30: { title: '30 Gün Serisi', icon: 'flame', color: theme.colors.error },
};

export default function StepsScreen() {
  const router = useRouter();
  const { toast, showError, showSuccess, hideToast } = useToast();
  const [steps, setSteps] = useState(0);
  const [distance, setDistance] = useState(0);
  const [calories, setCalories] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const [goal, setGoal] = useState<number | null>(null);
  const [history, setHistory] = useState<StepData[]>([]);
  const [stats, setStats] = useState({
    totalSteps: 0,
    averageSteps: 0,
    totalDistance: 0,
    totalCalories: 0,
    bestDay: null as any,
    trend: 'stable' as 'increasing' | 'decreasing' | 'stable'
  });
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const goalModalAnim = useRef(new Animated.Value(0)).current;
  const [streak, setStreak] = useState({ current: 0, longest: 0, lastDate: null as string | null });
  const [achievements, setAchievements] = useState<string[]>([]);
  const [showAchievements, setShowAchievements] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);
  const tutorialAnim = useRef(new Animated.Value(0)).current;

  const lastStepTimeRef = useRef<number>(0);
  const stepCountRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const stepBufferRef = useRef<number>(0);
  const lastSaveTimeRef = useRef<number>(0);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const consecutiveFailuresRef = useRef<number>(0);
  const initializedRef = useRef<boolean>(false);

  const SAVE_INTERVAL = 10000;
  const SYNC_INTERVAL = 12000;

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const [userName, setUserName] = React.useState('Kullanıcı');
  const { avatarUrl } = useProfile();

  useEffect(() => {
    // Sadece bir kez initialize et
    if (!initializedRef.current) {
      initializedRef.current = true;
      initializeData();
    }
    checkTutorial();

    // Load profile name with SecureStore first
    const loadUserId = async () => {
      try {
        const stored = await SecureStore.getItemAsync('workerId');

        // ÖNCE SecureStore'dan displayName oku (groups.tsx'deki gibi)
        const storedDisplayName = await SecureStore.getItemAsync('displayName');
        if (storedDisplayName) {
          setUserName(storedDisplayName);
        }

        if (stored) {
          // setUserId(stored); // setUserId is not defined in this context
          try {
            const r = await authFetch('/users/me');
            if (r.ok) {
              const { user } = await r.json();
              if (user) {
                const profileDisplayName = user.displayName || user.name || '';
                if (profileDisplayName) {
                  setUserName(profileDisplayName);
                  // SecureStore'a da kaydet
                  await SecureStore.setItemAsync('displayName', profileDisplayName);
                }
              }
            }
          } catch { }
        }
      } catch (error) {
        console.error('Error loading user ID:', error);
      }
    };
    loadUserId();

    return () => {
      // Cleanup intervals
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, []);

  const checkTutorial = async () => {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const tutorialSeen = await AsyncStorage.getItem('steps_tutorial_seen');
      if (!tutorialSeen) {
        setTimeout(() => {
          setShowTutorial(true);
          Animated.spring(tutorialAnim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 50,
            friction: 8,
          }).start();
        }, 1000);
      }
    } catch (error) {
      console.error('Check tutorial error:', error);
    }
  };

  const closeTutorial = async () => {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.setItem('steps_tutorial_seen', 'true');
    } catch (error) {
      console.error('Save tutorial error:', error);
    }
    Animated.spring(tutorialAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start(() => {
      setShowTutorial(false);
    });
  };

  useEffect(() => {
    if (isTracking) {
      startStepTracking();
    } else {
      stopStepTracking();
    }
  }, [isTracking]);

  const handleStepDetected = () => {
    const now = Date.now();
    const newSteps = stepCountRef.current + 1;
    stepCountRef.current = newSteps;
    lastStepTimeRef.current = now;

    const avgStepLength = 0.762;
    const newDistance = newSteps * avgStepLength / 1000;
    const newCalories = newSteps * 0.04;
    const newDuration = Math.floor((now - startTimeRef.current) / 1000);

    setSteps(newSteps);
    setDistance(newDistance);
    setCalories(newCalories);
    setDuration(newDuration);

    stepBufferRef.current += 1;
    if (stepBufferRef.current >= 2 || newSteps % 8 === 0) {
      const saveNow = Date.now();
      if (saveNow - lastSaveTimeRef.current >= SAVE_INTERVAL) {
        saveSteps(newSteps, newDistance, newCalories, newDuration);
        lastSaveTimeRef.current = saveNow;
        stepBufferRef.current = 0;
      }
    }
  };

  const { isAvailable } = useStepTracker(isTracking, { onStepDetected: handleStepDetected });

  useEffect(() => {
    if (isAvailable === false && isTracking) {
      showError('Adım sayar bu cihazda kullanılamıyor');
      setIsTracking(false);
    }
  }, [isAvailable, isTracking]);

  useEffect(() => {
    if (goal && goal > 0) {
      const progress = Math.min(steps / goal, 1);
      Animated.spring(progressAnim, {
        toValue: progress,
        useNativeDriver: false,
        tension: 50,
        friction: 7,
      }).start();
    } else {
      progressAnim.setValue(0);
    }
  }, [steps, goal]);

  useEffect(() => {
    if (!isTracking) {
      pulseAnim.setValue(1);
      return;
    }

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.06,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [isTracking]);

  const initializeData = async () => {
    setIsLoading(true);
    try {
      // Sıralı yükleme - rate limit'i önlemek için paralel yerine sıralı
      // Free plan için: 30 req/min (steps endpoint) = ~2 saniye/istek
      // Her istek arasında minimum 800ms bekleme yapıyoruz

      await loadTodaySteps();
      await new Promise(resolve => setTimeout(resolve, 800)); // 800ms bekle

      await loadGoal();
      await new Promise(resolve => setTimeout(resolve, 800));

      await loadStreak();
      await new Promise(resolve => setTimeout(resolve, 800));

      // Daha az kritik olanlar - sıralı yükleme (paralel yerine)
      await loadHistory();
      await new Promise(resolve => setTimeout(resolve, 800));

      await loadStats();
      await new Promise(resolve => setTimeout(resolve, 800));

      await loadAchievements();
    } catch (error: any) {
      console.warn('[StepsScreen] initializeData error:', error);
      // Hata durumunda bile loading'i false yap
    } finally {
      setIsLoading(false);
    }

    // Sync interval - adımları kaydetmek için
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
    }
    syncIntervalRef.current = setInterval(() => {
      if (stepCountRef.current > 0) {
        const now = Date.now();
        if (now - lastSaveTimeRef.current >= SAVE_INTERVAL) {
          saveSteps(stepCountRef.current, distance, calories, duration);
          lastSaveTimeRef.current = now;
        }
      }
    }, SYNC_INTERVAL);

    // Refresh interval - verileri yenilemek için (rate limit'i önlemek için daha uzun aralık)
    const setupRefreshInterval = () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }

      const refreshInterval = setInterval(async () => {
        if (!isTracking) {
          // Rate limit'i önlemek için sıralı yükleme
          const todaySuccess = await loadTodaySteps();
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 saniye bekle
          const streakSuccess = await loadStreak();

          if (todaySuccess || streakSuccess) {
            // Reset failure counter on success
            consecutiveFailuresRef.current = 0;
          } else {
            consecutiveFailuresRef.current += 1;

            // If 5 consecutive failures, stop refreshing to avoid spam
            if (consecutiveFailuresRef.current >= 5) {
              if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
                refreshIntervalRef.current = null;
              }
            }
          }
        }
      }, 60000); // 60 saniye (önceden 30 saniyeydi)

      refreshIntervalRef.current = refreshInterval;
    };

    setupRefreshInterval();
  };

  const loadGoal = async () => {
    try {
      const response = await authFetch('/steps/goal');
      if (!response.ok) {
        if (response.status === 404) {
          console.warn('[Steps] Goal endpoint not found, using null');
          setGoal(null);
          return;
        }
        if (response.status === 429) {
          console.warn('[Steps] Rate limit - skipping goal load');
          return; // 429 durumunda sessizce atla
        }
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      if (data.success && data.data?.goal) {
        setGoal(data.data.goal);
      } else {
        setGoal(null);
      }
    } catch (error: any) {
      // 429 hatası - rate limit
      if (error?.message?.includes('429') || error?.message?.includes('Rate limit')) {
        console.warn('[Steps] Rate limit - skipping goal load');
        return;
      }
      // Sadece gerçek hataları logla, 429 değilse
      if (!error?.message?.includes('429')) {
        console.warn('[Steps] Load goal error:', error?.message || error);
      }
      setGoal(null);
    }
  };

  const processGoalInput = (text: string) => {
    const numbersOnly = text.replace(/[^0-9]/g, '');
    if (numbersOnly.length > 6) return;
    setGoalInput(numbersOnly);
  };

  const saveGoal = async () => {
    try {
      if (!goalInput || goalInput.trim() === '') {
        showError('Lütfen bir hedef girin');
        return;
      }

      const goalValue = parseInt(goalInput);
      if (!goalValue || goalValue < 1 || goalValue > 100000) {
        showError('Hedef 1-100.000 arasında olmalıdır');
        return;
      }

      const response = await authFetch('/steps/goal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: goalValue }),
      });
      const data = await response.json();
      if (data.success) {
        setGoal(goalValue);
        closeGoalModal();
        showSuccess('Hedef kaydedildi');
        await loadStreak();
      } else {
        showError(data.message || 'Hedef kaydedilemedi');
      }
    } catch (error) {
      console.error('Save goal error:', error);
      showError('Hedef kaydedilemedi');
    }
  };

  const deleteGoal = async () => {
    try {
      const response = await authFetch('/steps/goal', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (data.success) {
        setGoal(null);
        closeGoalModal();
        showSuccess('Hedef silindi');
        await loadStreak();
      } else {
        showError(data.message || 'Hedef silinemedi');
      }
    } catch (error) {
      console.error('Delete goal error:', error);
      showError('Hedef silinemedi');
    }
  };

  const openGoalModal = () => {
    if (goal) {
      setGoalInput(goal.toString());
    }
    setShowGoalModal(true);
    Animated.spring(goalModalAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();
  };

  const closeGoalModal = () => {
    Animated.spring(goalModalAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start(() => {
      setShowGoalModal(false);
      setGoalInput('');
    });
  };

  const loadTodaySteps = async (): Promise<boolean> => {
    try {
      const response = await authFetch('/steps/today');
      if (!response.ok) {
        if (response.status === 404) {
          // Silently handle 404 - endpoint might not exist yet
          setSteps(0);
          setDistance(0);
          setCalories(0);
          setDuration(0);
          return false;
        }
        if (response.status === 429) {
          console.warn('[Steps] Rate limit - skipping today steps load');
          return false; // 429 durumunda sessizce atla
        }
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      if (data.success && data.data) {
        const loadedSteps = data.data.steps || 0;
        setSteps(loadedSteps);
        setDistance(data.data.distance || 0);
        setCalories(data.data.calories || 0);
        setDuration(data.data.duration || 0);
        stepCountRef.current = loadedSteps;
        if (data.data.goal) setGoal(data.data.goal);
        if (data.data.streak) setStreak(data.data.streak);
        return true;
      }
      return false;
    } catch (error: any) {
      // 429 hatası - rate limit
      if (error?.message?.includes('429') || error?.message?.includes('Rate limit')) {
        console.warn('[Steps] Rate limit - skipping today steps load');
        return false;
      }
      // Network errors are common when backend is down - handle silently
      const isNetworkError = error?.message?.includes('Network request failed') ||
        error?.message?.includes('Failed to fetch') ||
        error?.name === 'TypeError';
      if (!isNetworkError) {
        console.warn('[Steps] Load today steps error:', error?.message || error);
      }
      // Set defaults on error
      setSteps(0);
      setDistance(0);
      setCalories(0);
      setDuration(0);
      return false;
    }
  };

  const loadStreak = async (): Promise<boolean> => {
    try {
      const response = await authFetch('/steps/streak');
      if (!response.ok) {
        if (response.status === 404) {
          // Silently handle 404 - endpoint might not exist yet
          setStreak({ current: 0, longest: 0, lastDate: null });
          return false;
        }
        if (response.status === 429) {
          console.warn('[Steps] Rate limit - skipping streak load');
          return false; // 429 durumunda sessizce atla
        }
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      if (data.success && data.data) {
        setStreak(data.data);
        return true;
      } else {
        setStreak({ current: 0, longest: 0, lastDate: null });
        return false;
      }
    } catch (error: any) {
      // 429 hatası - rate limit
      if (error?.message?.includes('429') || error?.message?.includes('Rate limit')) {
        console.warn('[Steps] Rate limit - skipping streak load');
        return false;
      }
      // Network errors are common when backend is down - handle silently
      const isNetworkError = error?.message?.includes('Network request failed') ||
        error?.message?.includes('Failed to fetch') ||
        error?.name === 'TypeError';
      if (!isNetworkError) {
        console.warn('[Steps] Load streak error:', error?.message || error);
      }
      // Set defaults on error
      setStreak({ current: 0, longest: 0, lastDate: null });
      return false;
    }
  };

  const loadAchievements = async () => {
    try {
      const response = await authFetch('/steps/achievements');
      if (!response.ok) {
        if (response.status === 404) {
          console.warn('[Steps] Achievements endpoint not found, using empty array');
          setAchievements([]);
          return;
        }
        if (response.status === 429) {
          console.warn('[Steps] Rate limit - skipping achievements load');
          return; // 429 durumunda sessizce atla
        }
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        setAchievements(data.data);
      } else {
        setAchievements([]);
      }
    } catch (error: any) {
      // 429 hatası - rate limit
      if (error?.message?.includes('429') || error?.message?.includes('Rate limit')) {
        console.warn('[Steps] Rate limit - skipping achievements load');
        return;
      }
      console.error('Load achievements error:', error);
      setAchievements([]);
    }
  };

  const loadHistory = async () => {
    try {
      const response = await authFetch('/steps/history?days=7');
      if (!response.ok) {
        if (response.status === 404) {
          console.warn('[Steps] History endpoint not found, using empty array');
          setHistory([]);
          return;
        }
        if (response.status === 429) {
          console.warn('[Steps] Rate limit - skipping history load');
          return; // 429 durumunda sessizce atla
        }
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        setHistory(data.data);
      } else {
        setHistory([]);
      }
    } catch (error: any) {
      // 429 hatası - rate limit
      if (error?.message?.includes('429') || error?.message?.includes('Rate limit')) {
        console.warn('[Steps] Rate limit - skipping history load');
        return;
      }
      console.error('Load history error:', error);
      setHistory([]);
    }
  };

  const loadStats = async () => {
    try {
      const response = await authFetch('/steps/stats?period=week');
      if (!response.ok) {
        if (response.status === 404) {
          console.warn('[Steps] Stats endpoint not found, using defaults');
          setStats({
            totalSteps: 0,
            averageSteps: 0,
            totalDistance: 0,
            totalCalories: 0,
            bestDay: null,
            trend: 'stable'
          });
          return;
        }
        if (response.status === 429) {
          console.warn('[Steps] Rate limit - skipping stats load');
          return; // 429 durumunda sessizce atla
        }
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      if (data.success && data.data) {
        setStats(data.data);
      } else {
        setStats({
          totalSteps: 0,
          averageSteps: 0,
          totalDistance: 0,
          totalCalories: 0,
          bestDay: null,
          trend: 'stable'
        });
      }
    } catch (error: any) {
      // 429 hatası - rate limit
      if (error?.message?.includes('429') || error?.message?.includes('Rate limit')) {
        console.warn('[Steps] Rate limit - skipping stats load');
        return;
      }
      console.error('Load stats error:', error);
      setStats({
        totalSteps: 0,
        averageSteps: 0,
        totalDistance: 0,
        totalCalories: 0,
        bestDay: null,
        trend: 'stable'
      });
    }
  };

  const saveSteps = async (stepCount: number, dist: number, cal: number, dur: number, retryCount = 0) => {
    try {
      const response = await authFetch('/steps/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          steps: stepCount,
          distance: dist,
          calories: cal,
          duration: dur,
          timestamp: Date.now(),
        }),
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.warn('[Steps] Store endpoint not found');
          return false;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        if (data.data.goalAchieved && goal) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          showSuccess(`🎉 Hedefinize ulaştınız! ${goal.toLocaleString()} adım tamamlandı`);
        }
        if (data.data.achievements && data.data.achievements.length > 0) {
          await loadAchievements();
        }
        if (data.data.streak) {
          setStreak(data.data.streak);
        }
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('Save steps error:', error);
      if (retryCount < 3 && !error.message?.includes('404')) {
        setTimeout(() => {
          saveSteps(stepCount, dist, cal, dur, retryCount + 1);
        }, 3000 * (retryCount + 1));
      }
      return false;
    }
  };

  const notifyTrackingStart = async (retryCount = 0): Promise<boolean> => {
    const maxRetries = 3;
    try {
      console.log(`[Steps] 📤 Sending start tracking notification (attempt ${retryCount + 1}/${maxRetries + 1})...`);

      const response = await authFetch('/steps/start-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.warn('[Steps] ⚠️ Start tracking endpoint not found');
          return false;
        }

        const errorText = await response.text().catch(() => 'Unknown error');
        console.warn(`[Steps] ⚠️ Start tracking notification failed: ${response.status} - ${errorText}`);

        // Retry on server errors (5xx)
        if (response.status >= 500 && retryCount < maxRetries) {
          console.log(`[Steps] 🔄 Retrying in ${(retryCount + 1) * 1000}ms...`);
          await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 1000));
          return notifyTrackingStart(retryCount + 1);
        }

        return false;
      }

      const data = await response.json();
      console.log('[Steps] 📥 Start tracking notification response:', JSON.stringify(data, null, 2));

      if (data.success) {
        const notificationSent = data.data?.notificationSent;
        const channels = data.data?.notificationChannels || [];
        const onesignalResult = channels.find((r: any) => r.channel === 'onesignal');

        if (notificationSent) {
          if (onesignalResult?.success) {
            console.log('[Steps] ✅ OneSignal notification sent successfully');
          } else if (onesignalResult) {
            console.warn('[Steps] ⚠️ OneSignal notification failed:', onesignalResult.error);
          } else {
            console.warn('[Steps] ⚠️ OneSignal channel not in results');
          }
          return true;
        } else {
          console.warn('[Steps] ⚠️ Notification not sent - no channels succeeded');
          return false;
        }
      } else {
        console.warn('[Steps] ⚠️ Backend returned success:false:', data.message);
        return false;
      }
    } catch (error: any) {
      const isNetworkError = error?.message?.includes('Network request failed') ||
        error?.message?.includes('Failed to fetch') ||
        error?.name === 'TypeError';

      if (isNetworkError && retryCount < maxRetries) {
        console.log(`[Steps] 🔄 Network error, retrying in ${(retryCount + 1) * 1000}ms...`);
        await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 1000));
        return notifyTrackingStart(retryCount + 1);
      }

      console.error('[Steps] ❌ Notify tracking start error:', error?.message || error);
      return false;
    }
  };

  const startStepTracking = async () => {
    try {
      notifyTrackingStart().catch(err => {
        console.error('[Steps] Notification error (non-blocking):', err);
      });
      startTimeRef.current = Date.now();
      lastSaveTimeRef.current = Date.now();
      await saveSteps(stepCountRef.current, distance, calories, duration);
      showSuccess('Adım takibi başlatıldı');
    } catch (error) {
      console.error('Start tracking error:', error);
      showError('Adım takibi başlatılamadı');
      setIsTracking(false);
    }
  };

  const notifyTrackingStop = async (retryCount = 0): Promise<boolean> => {
    const maxRetries = 3;
    try {
      console.log(`[Steps] 📤 Sending stop tracking notification (attempt ${retryCount + 1}/${maxRetries + 1})...`);

      const response = await authFetch('/steps/stop-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.warn('[Steps] ⚠️ Stop tracking endpoint not found');
          return false;
        }

        const errorText = await response.text().catch(() => 'Unknown error');
        console.warn(`[Steps] ⚠️ Stop tracking notification failed: ${response.status} - ${errorText}`);

        // Retry on server errors (5xx)
        if (response.status >= 500 && retryCount < maxRetries) {
          console.log(`[Steps] 🔄 Retrying in ${(retryCount + 1) * 1000}ms...`);
          await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 1000));
          return notifyTrackingStop(retryCount + 1);
        }

        return false;
      }

      const data = await response.json();
      console.log('[Steps] 📥 Stop tracking notification response:', JSON.stringify(data, null, 2));

      if (data.success) {
        const notificationSent = data.data?.notificationSent;
        const channels = data.data?.notificationChannels || [];
        const onesignalResult = channels.find((r: any) => r.channel === 'onesignal');

        if (notificationSent) {
          if (onesignalResult?.success) {
            console.log('[Steps] ✅ OneSignal notification sent successfully');
          } else if (onesignalResult) {
            console.warn('[Steps] ⚠️ OneSignal notification failed:', onesignalResult.error);
          } else {
            console.warn('[Steps] ⚠️ OneSignal channel not in results');
          }
          return true;
        } else {
          console.warn('[Steps] ⚠️ Notification not sent - no channels succeeded');
          return false;
        }
      } else {
        console.warn('[Steps] ⚠️ Backend returned success:false:', data.message);
        return false;
      }
    } catch (error: any) {
      const isNetworkError = error?.message?.includes('Network request failed') ||
        error?.message?.includes('Failed to fetch') ||
        error?.name === 'TypeError';

      if (isNetworkError && retryCount < maxRetries) {
        console.log(`[Steps] 🔄 Network error, retrying in ${(retryCount + 1) * 1000}ms...`);
        await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 1000));
        return notifyTrackingStop(retryCount + 1);
      }

      if (!isNetworkError) {
        console.warn('[Steps] ⚠️ Notify tracking stop error:', error?.message || error);
      }
      return false;
    }
  };

  const stopStepTracking = async () => {
    if (stepCountRef.current > 0) {
      await saveSteps(stepCountRef.current, distance, calories, duration);
      await notifyTrackingStop();
      // Rate limit'i önlemek için sıralı yükleme ve bekleme
      await loadTodaySteps();
      await new Promise(resolve => setTimeout(resolve, 800));
      await loadStreak();
      await new Promise(resolve => setTimeout(resolve, 800));
      await loadStats();
    } else {
      await notifyTrackingStop();
      await loadTodaySteps();
      await new Promise(resolve => setTimeout(resolve, 800));
      await loadStreak();
      await new Promise(resolve => setTimeout(resolve, 800));
      await loadStats();
    }

    // Reset failure counter and restart refresh interval when tracking stops
    consecutiveFailuresRef.current = 0;
    if (!refreshIntervalRef.current) {
      const refreshInterval = setInterval(async () => {
        if (!isTracking) {
          const todaySuccess = await loadTodaySteps();
          await new Promise(resolve => setTimeout(resolve, 1000));
          const streakSuccess = await loadStreak();

          if (todaySuccess || streakSuccess) {
            consecutiveFailuresRef.current = 0;
          } else {
            consecutiveFailuresRef.current += 1;
            if (consecutiveFailuresRef.current >= 5) {
              if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
                refreshIntervalRef.current = null;
              }
            }
          }
        }
      }, 60000);
      refreshIntervalRef.current = refreshInterval;
    }

    stepBufferRef.current = 0;
  };

  const toggleTracking = () => {
    if (isTracking) {
      setIsTracking(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      setIsTracking(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  };
  const resetToday = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSteps(0);
    setDistance(0);
    setCalories(0);
    setDuration(0);
    stepCountRef.current = 0;
    stepBufferRef.current = 0;
    await saveSteps(0, 0, 0, 0);
    await loadTodaySteps();
    showSuccess('Günlük veriler sıfırlandı');
  };

  const progress = goal && goal > 0 ? Math.min(steps / goal, 1) : 0;
  const progressPercent = Math.round(progress * 100);
  const remainingSteps = goal && goal > 0 ? Math.max(0, goal - steps) : 0;

  const weeklyChartData = history.slice(0, 7).reverse();
  const maxSteps = Math.max(...weeklyChartData.map(d => d.steps || 0), goal || 0, 1);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="light-content" />
        <LinearGradient colors={[theme.colors.background, theme.colors.backgroundSecondary]} style={styles.gradient}>
          <View style={styles.loadingContainer}>
            <Ionicons name="footsteps" size={48} color={theme.colors.primary} />
            <Text style={styles.loadingText}>Yükleniyor...</Text>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <LinearGradient
        colors={[theme.colors.background, theme.colors.backgroundSecondary]}
        style={styles.gradient}
      >
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

        <UnifiedHeader
          title="Adım Sayar"
          subtitle="Günlük adım hedeflerinizi takip edin"
          gradientColors={['#14b8a6', '#06b6d4']}
          brandLabel="SAĞLIK"
          profileName={userName}
          avatarUrl={avatarUrl}
          showProfile={true}
          showNetwork={true}
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* The original header content is replaced by UnifiedHeader */}


          <View style={styles.mainCard}>
            <View style={styles.stepCircleContainer}>
              <Animated.View style={[styles.stepCircle, { transform: [{ scale: pulseAnim }] }]}>
                <View style={styles.stepCircleInner}>
                  <Text style={styles.stepNumber}>{steps.toLocaleString()}</Text>
                  <Text style={styles.stepLabel}>Adım</Text>
                  {goal && goal > 0 && (
                    <View style={styles.goalContainer}>
                      <Text style={styles.goalText}>Hedef: {goal.toLocaleString()}</Text>
                    </View>
                  )}
                </View>
              </Animated.View>
              {goal && goal > 0 && (
                <View style={styles.progressRing}>
                  <Animated.View
                    style={[
                      styles.progressFill,
                      {
                        height: progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        }),
                      },
                    ]}
                  />
                </View>
              )}
            </View>

            {goal && goal > 0 && (
              <View style={styles.progressBarContainer}>
                <View style={styles.progressBar}>
                  <Animated.View
                    style={[
                      styles.progressBarFill,
                      {
                        width: progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        }),
                      },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {progressPercent}% tamamlandı • {remainingSteps.toLocaleString()} adım kaldı
                </Text>
              </View>
            )}

            {goal && goal > 0 ? (
              <TouchableOpacity onPress={openGoalModal} style={styles.changeGoalButton}>
                <Ionicons name="create-outline" size={18} color={theme.colors.primary} />
                <Text style={styles.changeGoalText}>Hedefi Değiştir</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={openGoalModal} style={styles.setGoalButton}>
                <Ionicons name="flag-outline" size={20} color={theme.colors.primary} />
                <Text style={styles.setGoalText}>Hedef Belirle</Text>
              </TouchableOpacity>
            )}

            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Ionicons name="walk-outline" size={28} color={theme.colors.primary} />
                <Text style={styles.statValue}>{distance.toFixed(2)}</Text>
                <Text style={styles.statLabel}>Kilometre</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="flame-outline" size={28} color={theme.colors.warning} />
                <Text style={styles.statValue}>{Math.round(calories)}</Text>
                <Text style={styles.statLabel}>Kalori</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="time-outline" size={28} color={theme.colors.success} />
                <Text style={styles.statValue}>
                  {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
                </Text>
                <Text style={styles.statLabel}>Süre</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={toggleTracking}
              style={[styles.trackButton, isTracking && styles.trackButtonActive]}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={isTracking ? [theme.colors.error, theme.colors.errorDark] : [theme.colors.primary, theme.colors.primaryDark]}
                style={styles.trackButtonGradient}
              >
                <Ionicons name={isTracking ? 'stop-circle' : 'play-circle'} size={32} color="#fff" />
                <Text style={styles.trackButtonText}>{isTracking ? 'Durdur' : 'Başlat'}</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={resetToday} style={styles.resetButton} activeOpacity={0.7}>
              <Ionicons name="refresh-outline" size={20} color={theme.colors.textTertiary} />
              <Text style={styles.resetButtonText}>Günü Sıfırla</Text>
            </TouchableOpacity>
          </View>

          {(streak.current > 0 || streak.longest > 0) && (
            <View style={styles.streakCard}>
              <View style={styles.streakHeader}>
                <Ionicons name="flame" size={24} color={theme.colors.error} />
                <Text style={styles.streakTitle}>Seri</Text>
              </View>
              <View style={styles.streakStats}>
                <View style={styles.streakItem}>
                  <Text style={styles.streakValue}>{streak.current}</Text>
                  <Text style={styles.streakLabel}>Günlük Seri</Text>
                </View>
                <View style={styles.streakItem}>
                  <Text style={styles.streakValue}>{streak.longest}</Text>
                  <Text style={styles.streakLabel}>En Uzun Seri</Text>
                </View>
              </View>
            </View>
          )}

          {achievements.length > 0 && (
            <View style={styles.achievementsCard}>
              <TouchableOpacity
                style={styles.achievementsHeader}
                onPress={() => setShowAchievements(!showAchievements)}
              >
                <Ionicons name="trophy" size={24} color={theme.colors.warning} />
                <Text style={styles.achievementsTitle}>Başarılar ({achievements.length})</Text>
                <Ionicons
                  name={showAchievements ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>
              {showAchievements && (
                <View style={styles.achievementsGrid}>
                  {achievements.map((id) => {
                    const achievement = ACHIEVEMENTS_MAP[id];
                    if (!achievement) return null;
                    return (
                      <View key={id} style={styles.achievementItem}>
                        <View style={[styles.achievementIcon, { backgroundColor: `${achievement.color}20` }]}>
                          <Ionicons name={achievement.icon as any} size={24} color={achievement.color} />
                        </View>
                        <Text style={styles.achievementText}>{achievement.title}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {weeklyChartData.length > 0 && (
            <View style={styles.chartCard}>
              <Text style={styles.sectionTitle}>Son 7 Gün</Text>
              <View style={styles.chartContainer}>
                {weeklyChartData.map((item, index) => {
                  const height = maxSteps > 0 ? ((item.steps || 0) / maxSteps) * 120 : 0;
                  const isToday = index === weeklyChartData.length - 1;
                  return (
                    <View key={index} style={styles.chartBarContainer}>
                      <View style={[styles.chartBar, { height: Math.max(height, 4), backgroundColor: isToday ? theme.colors.primary : theme.colors.primaryLight }]} />
                      <Text style={styles.chartLabel}>
                        {new Date(item.date).toLocaleDateString('tr-TR', { weekday: 'short' })}
                      </Text>
                      <Text style={styles.chartValue}>{(item.steps || 0).toLocaleString()}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          <View style={styles.statsSection}>
            <Text style={styles.sectionTitle}>Haftalık İstatistikler</Text>
            <View style={styles.weeklyStats}>
              <View style={styles.weeklyStatItem}>
                <Text style={styles.weeklyStatValue}>{stats.totalSteps.toLocaleString()}</Text>
                <Text style={styles.weeklyStatLabel}>Toplam Adım</Text>
              </View>
              <View style={styles.weeklyStatItem}>
                <Text style={styles.weeklyStatValue}>{stats.averageSteps.toLocaleString()}</Text>
                <Text style={styles.weeklyStatLabel}>Ortalama</Text>
              </View>
              <View style={styles.weeklyStatItem}>
                <Text style={styles.weeklyStatValue}>{stats.totalDistance.toFixed(1)}</Text>
                <Text style={styles.weeklyStatLabel}>Kilometre</Text>
              </View>
              <View style={styles.weeklyStatItem}>
                <Text style={styles.weeklyStatValue}>{Math.round(stats.totalCalories)}</Text>
                <Text style={styles.weeklyStatLabel}>Kalori</Text>
              </View>
            </View>
            {stats.bestDay && (
              <View style={styles.bestDayCard}>
                <Ionicons name="star" size={20} color={theme.colors.warning} />
                <Text style={styles.bestDayText}>
                  En İyi Gün: {new Date(stats.bestDay.date).toLocaleDateString('tr-TR')} - {stats.bestDay.steps.toLocaleString()} adım
                </Text>
              </View>
            )}
            {stats.trend !== 'stable' && (
              <View style={styles.trendCard}>
                <Ionicons
                  name={stats.trend === 'increasing' ? 'trending-up' : 'trending-down'}
                  size={20}
                  color={stats.trend === 'increasing' ? theme.colors.success : theme.colors.error}
                />
                <Text style={[styles.trendText, { color: stats.trend === 'increasing' ? theme.colors.success : theme.colors.error }]}>
                  {stats.trend === 'increasing' ? 'Artış Trendi' : 'Azalış Trendi'}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        <Modal visible={showGoalModal} transparent animationType="none" onRequestClose={closeGoalModal}>
          <Pressable style={styles.bottomSheetOverlay} onPress={closeGoalModal}>
            <Animated.View
              style={[
                styles.bottomSheetContent,
                {
                  transform: [
                    {
                      translateY: goalModalAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [500, 0],
                      }),
                    },
                  ],
                  opacity: goalModalAnim,
                },
              ]}
              onStartShouldSetResponder={() => true}
            >
              <View style={styles.bottomSheetHandle} />
              <View style={styles.bottomSheetHeader}>
                <View style={styles.bottomSheetIconWrapper}>
                  <Ionicons name="flag" size={28} color={theme.colors.primary} />
                </View>
                <Text style={styles.bottomSheetTitle}>Günlük Adım Hedefi</Text>
                <Text style={styles.bottomSheetSubtitle}>Günlük hedefinizi belirleyin</Text>
              </View>
              <View style={styles.bottomSheetBody}>
                <View style={styles.goalInputContainer}>
                  <TextInput
                    style={styles.goalInput}
                    placeholder="0"
                    placeholderTextColor={theme.colors.textTertiary}
                    value={goalInput}
                    onChangeText={processGoalInput}
                    keyboardType="number-pad"
                    autoFocus
                    maxLength={6}
                    selectTextOnFocus
                  />
                  <Text style={styles.goalInputLabel}>Adım</Text>
                </View>
                {goalInput && parseInt(goalInput) > 0 && (
                  <View style={styles.goalPreview}>
                    <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
                    <Text style={styles.goalPreviewText}>
                      Hedef: {parseInt(goalInput).toLocaleString('tr-TR')} adım
                    </Text>
                  </View>
                )}
                <View style={styles.goalSuggestions}>
                  <Text style={styles.goalSuggestionsTitle}>Önerilen Hedefler</Text>
                  <View style={styles.goalSuggestionsGrid}>
                    {[5000, 10000, 15000, 20000].map((suggestion) => (
                      <TouchableOpacity
                        key={suggestion}
                        style={styles.goalSuggestionButton}
                        onPress={() => {
                          setGoalInput(suggestion.toString());
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                      >
                        <Text style={styles.goalSuggestionText}>{suggestion.toLocaleString('tr-TR')}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
              <View style={styles.bottomSheetFooter}>
                {goal && goal > 0 && (
                  <TouchableOpacity
                    style={[styles.bottomSheetButton, styles.bottomSheetButtonDelete]}
                    onPress={deleteGoal}
                  >
                    <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
                    <Text style={styles.bottomSheetButtonTextDelete}>Hedefi Sil</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.bottomSheetButton, styles.bottomSheetButtonCancel]}
                  onPress={closeGoalModal}
                >
                  <Text style={styles.bottomSheetButtonTextCancel}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.bottomSheetButton, styles.bottomSheetButtonSave]}
                  onPress={saveGoal}
                  disabled={!goalInput || parseInt(goalInput) < 1}
                >
                  <LinearGradient
                    colors={[theme.colors.primary, theme.colors.primaryDark]}
                    style={styles.bottomSheetButtonGradient}
                  >
                    <Ionicons name="checkmark" size={20} color="#fff" />
                    <Text style={styles.bottomSheetButtonTextSave}>Kaydet</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </Pressable>
        </Modal>

        <Modal visible={showTutorial} transparent animationType="fade" onRequestClose={closeTutorial}>
          <Pressable style={styles.tutorialOverlay} onPress={closeTutorial}>
            <Animated.View
              style={[
                styles.tutorialContent,
                {
                  opacity: tutorialAnim,
                  transform: [
                    {
                      scale: tutorialAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.9, 1],
                      }),
                    },
                  ],
                },
              ]}
              onStartShouldSetResponder={() => true}
            >
              <LinearGradient
                colors={[theme.colors.background, theme.colors.backgroundSecondary]}
                style={styles.tutorialGradient}
              >
                <View style={styles.tutorialHeader}>
                  <View style={styles.tutorialIconWrapper}>
                    <Ionicons name="footsteps" size={48} color={theme.colors.primary} />
                  </View>
                  <Text style={styles.tutorialTitle}>Adım Sayarına Hoş Geldiniz! 👋</Text>
                  <Text style={styles.tutorialSubtitle}>Nasıl kullanılacağını öğrenin</Text>
                </View>

                <ScrollView style={styles.tutorialBody} showsVerticalScrollIndicator={false}>
                  <View style={styles.tutorialStep}>
                    <View style={styles.tutorialStepNumber}>
                      <Text style={styles.tutorialStepNumberText}>1</Text>
                    </View>
                    <View style={styles.tutorialStepContent}>
                      <Text style={styles.tutorialStepTitle}>Hedef Belirleyin</Text>
                      <Text style={styles.tutorialStepDescription}>
                        Günlük adım hedefinizi belirleyin. Önerilen hedefler: 5.000, 10.000, 15.000 veya 20.000 adım.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.tutorialStep}>
                    <View style={styles.tutorialStepNumber}>
                      <Text style={styles.tutorialStepNumberText}>2</Text>
                    </View>
                    <View style={styles.tutorialStepContent}>
                      <Text style={styles.tutorialStepTitle}>Takibi Başlatın</Text>
                      <Text style={styles.tutorialStepDescription}>
                        "Başlat" butonuna basarak adım takibini başlatın. Cihazınızın ivmeölçer sensörü adımlarınızı otomatik olarak sayacak.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.tutorialStep}>
                    <View style={styles.tutorialStepNumber}>
                      <Text style={styles.tutorialStepNumberText}>3</Text>
                    </View>
                    <View style={styles.tutorialStepContent}>
                      <Text style={styles.tutorialStepTitle}>İlerlemenizi Takip Edin</Text>
                      <Text style={styles.tutorialStepDescription}>
                        Adımlarınız, mesafe, kalori ve süre bilgilerini gerçek zamanlı olarak görüntüleyin. Hedefinize ne kadar yaklaştığınızı takip edin.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.tutorialStep}>
                    <View style={styles.tutorialStepNumber}>
                      <Text style={styles.tutorialStepNumberText}>4</Text>
                    </View>
                    <View style={styles.tutorialStepContent}>
                      <Text style={styles.tutorialStepTitle}>Başarılar ve Seriler</Text>
                      <Text style={styles.tutorialStepDescription}>
                        Hedeflerinize ulaştıkça başarılar kazanın ve günlük serilerinizi koruyun. İstatistiklerinizi ve geçmiş performansınızı görüntüleyin.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.tutorialTips}>
                    <View style={styles.tutorialTipsHeader}>
                      <Ionicons name="bulb-outline" size={24} color={theme.colors.warning} />
                      <Text style={styles.tutorialTipsTitle}>İpuçları</Text>
                    </View>
                    <View style={styles.tutorialTipItem}>
                      <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
                      <Text style={styles.tutorialTipText}>Hedefinizi istediğiniz zaman değiştirebilir veya silebilirsiniz</Text>
                    </View>
                    <View style={styles.tutorialTipItem}>
                      <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
                      <Text style={styles.tutorialTipText}>Takibi durdurmak için "Durdur" butonuna basın</Text>
                    </View>
                    <View style={styles.tutorialTipItem}>
                      <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
                      <Text style={styles.tutorialTipText}>Günlük verilerinizi "Günü Sıfırla" ile sıfırlayabilirsiniz</Text>
                    </View>
                  </View>
                </ScrollView>

                <View style={styles.tutorialFooter}>
                  <TouchableOpacity
                    style={styles.tutorialButton}
                    onPress={closeTutorial}
                  >
                    <LinearGradient
                      colors={[theme.colors.primary, theme.colors.primaryDark]}
                      style={styles.tutorialButtonGradient}
                    >
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                      <Text style={styles.tutorialButtonText}>Anladım, Başlayalım!</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </Animated.View>
          </Pressable>
        </Modal>

        <Toast message={toast.message} type={toast.type} visible={toast.visible} onHide={hideToast} />
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  scrollContent: { paddingBottom: 200 },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${theme.colors.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrapper: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: theme.colors.textTertiary,
    marginTop: 2,
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.borderSecondary,
  },
  mainCard: {
    margin: 16,
    marginTop: 8,
    padding: 28,
    borderRadius: 28,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  stepCircleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    marginTop: 8,
    position: 'relative',
    height: 300,
  },
  stepCircle: {
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    borderWidth: 5,
    borderColor: '#06b6d4',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
    elevation: 12,
  },
  stepCircleInner: { alignItems: 'center', justifyContent: 'center', padding: 20 },
  stepNumber: {
    fontSize: 64,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 4,
    fontFamily: 'Poppins-ExtraBold',
    textShadowColor: 'rgba(6, 182, 212, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  stepLabel: {
    fontSize: 18,
    color: '#cbd5e1',
    marginBottom: 12,
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
  },
  goalContainer: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: `${theme.colors.primary}20`,
  },
  goalText: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  progressRing: {
    position: 'absolute',
    width: 248,
    height: 248,
    borderRadius: 124,
    borderWidth: 4,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  progressFill: {
    width: '100%',
    backgroundColor: theme.colors.primary,
    position: 'absolute',
    bottom: 0,
  },
  progressBarContainer: { marginBottom: 24 },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.border,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 13,
    color: theme.colors.textTertiary,
    textAlign: 'center',
  },
  setGoalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    marginBottom: 20,
    marginTop: 4,
    gap: 10,
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  setGoalText: {
    fontSize: 16,
    color: '#06b6d4',
    fontWeight: '700',
    fontFamily: 'Poppins-SemiBold',
    letterSpacing: 0.3,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.15)',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginTop: 8,
    fontFamily: 'Poppins-Bold',
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    marginTop: 4,
  },
  trackButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  trackButtonActive: { opacity: 0.9 },
  trackButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    gap: 12,
  },
  trackButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  resetButtonText: {
    fontSize: 14,
    color: theme.colors.textTertiary,
  },
  streakCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 20,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSecondary,
  },
  streakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  streakTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  streakStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  streakItem: {
    alignItems: 'center',
  },
  streakValue: {
    fontSize: 32,
    fontWeight: '800',
    color: theme.colors.error,
    marginBottom: 4,
  },
  streakLabel: {
    fontSize: 12,
    color: theme.colors.textTertiary,
  },
  achievementsCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 20,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSecondary,
  },
  achievementsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  achievementsTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  achievementsGrid: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  achievementItem: {
    width: (width - 80) / 2,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceElevated,
    gap: 8,
  },
  achievementIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievementText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text,
  },
  chartCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 20,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSecondary,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 160,
    marginTop: 16,
    gap: 8,
  },
  chartBarContainer: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  chartBar: {
    width: '100%',
    borderRadius: 4,
    marginBottom: 8,
  },
  chartLabel: {
    fontSize: 11,
    color: theme.colors.textTertiary,
    marginBottom: 4,
  },
  chartValue: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  statsSection: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSecondary,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 16,
  },
  weeklyStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  weeklyStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  weeklyStatValue: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.primary,
    marginBottom: 4,
  },
  weeklyStatLabel: {
    fontSize: 12,
    color: theme.colors.textTertiary,
  },
  bestDayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceElevated,
    gap: 8,
    marginTop: 12,
  },
  bestDayText: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  trendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceElevated,
    gap: 8,
    marginTop: 8,
  },
  trendText: {
    fontSize: 14,
    fontWeight: '600',
  },
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  bottomSheetContent: {
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 16,
    paddingBottom: 36,
    paddingHorizontal: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderBottomWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
    minHeight: 400,
    maxHeight: '90%',
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    alignSelf: 'center',
    marginBottom: 20,
  },
  bottomSheetHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  bottomSheetIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
  },
  bottomSheetTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 8,
    letterSpacing: -0.5,
    fontFamily: 'Poppins-Bold',
  },
  bottomSheetSubtitle: {
    fontSize: 14,
    color: theme.colors.textTertiary,
    fontWeight: '500',
  },
  bottomSheetBody: {
    marginBottom: 24,
  },
  goalInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 20,
  },
  goalInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: '900',
    color: theme.colors.text,
    letterSpacing: -1,
    padding: 0,
  },
  goalInputLabel: {
    fontSize: 18,
    color: theme.colors.textSecondary,
    fontWeight: '700',
    marginLeft: 12,
  },
  goalPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${theme.colors.success}15`,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 20,
    gap: 8,
  },
  goalPreviewText: {
    fontSize: 15,
    color: theme.colors.success,
    fontWeight: '700',
  },
  goalSuggestions: {
    marginTop: 8,
  },
  goalSuggestionsTitle: {
    fontSize: 13,
    color: theme.colors.textTertiary,
    fontWeight: '700',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  goalSuggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  goalSuggestionButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  goalSuggestionText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  bottomSheetFooter: {
    flexDirection: 'row',
    gap: 12,
  },
  bottomSheetButton: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  bottomSheetButtonCancel: {
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSheetButtonSave: {
    overflow: 'hidden',
  },
  bottomSheetButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  bottomSheetButtonTextCancel: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  bottomSheetButtonTextSave: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  bottomSheetButtonDelete: {
    backgroundColor: `${theme.colors.error}15`,
    borderWidth: 1,
    borderColor: `${theme.colors.error}30`,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  bottomSheetButtonTextDelete: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.error,
  },
  changeGoalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: `${theme.colors.primary}10`,
    borderWidth: 1,
    borderColor: `${theme.colors.primary}30`,
    marginBottom: 24,
    gap: 8,
  },
  changeGoalText: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  tutorialOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  tutorialContent: {
    width: '100%',
    maxWidth: 480,
    minHeight: 500,
    maxHeight: '90%',
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.borderSecondary,
  },
  tutorialGradient: {
    flex: 1,
  },
  tutorialHeader: {
    alignItems: 'center',
    padding: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSecondary,
  },
  tutorialIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${theme.colors.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  tutorialTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  tutorialSubtitle: {
    fontSize: 14,
    color: theme.colors.textTertiary,
    textAlign: 'center',
  },
  tutorialBody: {
    flex: 1,
    padding: 24,
  },
  tutorialStep: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 16,
  },
  tutorialStepNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tutorialStepNumberText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  tutorialStepContent: {
    flex: 1,
  },
  tutorialStepTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
  },
  tutorialStepDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  tutorialTips: {
    marginTop: 8,
    padding: 20,
    borderRadius: 16,
    backgroundColor: `${theme.colors.warning}15`,
    borderWidth: 1,
    borderColor: `${theme.colors.warning}30`,
  },
  tutorialTipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  tutorialTipsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  tutorialTipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  tutorialTipText: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  tutorialFooter: {
    padding: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSecondary,
  },
  tutorialButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  tutorialButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  tutorialButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
