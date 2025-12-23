/**
 * App Flow Component
 * Manages application flow: splash -> onboarding -> main app
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Onboarding from '../Onboarding';
import SplashScreen from '../SplashScreen';
import { useTheme } from '../ui/theme';

const ONBOARDING_KEY = '@bavaxe:onboarding_completed';

interface AppFlowProps {
  children: React.ReactNode;
}

export const AppFlow: React.FC<AppFlowProps> = ({ children }) => {
  const theme = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      const completed = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (completed === 'true') {
        setOnboardingCompleted(true);
      } else {
        setShowOnboarding(true);
      }
    } catch (error) {
      setShowOnboarding(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSplashFinish = () => {
    setShowSplash(false);
  };

  const handleOnboardingComplete = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      setOnboardingCompleted(true);
      setShowOnboarding(false);
    } catch (error) {
      setOnboardingCompleted(true);
      setShowOnboarding(false);
    }
  };

  if (isLoading || showSplash) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  if (showOnboarding && !onboardingCompleted) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default AppFlow;

