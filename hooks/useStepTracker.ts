import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { Pedometer } from 'expo-sensors';
import * as Haptics from 'expo-haptics';

interface StepTrackerConfig {
    onStepDetected?: (steps: number) => void;
}

export function useStepTracker(isTracking: boolean, config: StepTrackerConfig = {}) {
    const { onStepDetected } = config;

    const [currentSteps, setCurrentSteps] = useState(0);
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
    const [pastStepCount, setPastStepCount] = useState(0);

    const subscriptionRef = useRef<any>(null);
    const appStateRef = useRef(AppState.currentState);

    // Initial availability check
    useEffect(() => {
        Pedometer.isAvailableAsync().then(
            (result) => {
                setIsAvailable(result);
            },
            (error) => {
                setIsAvailable(false);
            }
        );
    }, []);

    const startTracking = useCallback(async () => {
        // --- EMULATOR SIMULATION CHECK ---
        if (isAvailable === false) {
            // Emulator Mode: sensor unavailable, do not start Pedometer subscription
            return;
        }

        // Stop any existing subscription
        if (subscriptionRef.current) {
            subscriptionRef.current.remove();
        }

        try {
            // Get steps from the beginning of the day to sync
            const end = new Date();
            const start = new Date();
            start.setHours(0, 0, 0, 0);

            const pastStepsResult = await Pedometer.getStepCountAsync(start, end);
            if (pastStepsResult) {
                setPastStepCount(pastStepsResult.steps);
                setCurrentSteps(pastStepsResult.steps);
            }

            // Start real-time monitoring
            subscriptionRef.current = Pedometer.watchStepCount((result) => {
                // result.steps is the number of steps taken since the subscription started
                // So total = pastSteps + result.steps
                const totalSteps = pastStepsResult.steps + result.steps;
                setCurrentSteps(totalSteps);

                if (onStepDetected) {
                    onStepDetected(totalSteps);
                }
            });
        } catch (error) {
            console.warn('[Pedometer] Tracking error:', error);
        }
    }, [isAvailable, onStepDetected]);

    const stopTracking = useCallback(() => {
        if (subscriptionRef.current) {
            subscriptionRef.current.remove();
            subscriptionRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (isTracking) {
            startTracking();
        } else {
            stopTracking();
        }
        return () => stopTracking();
    }, [isTracking, startTracking, stopTracking]);

    // --- EMULATOR SIMULATION LOGIC ---
    useEffect(() => {
        let timer: NodeJS.Timeout;

        // Check if we need simulation: Tracking ON + Sensor Unavailable
        const needsSimulation = isTracking && isAvailable === false;

        if (needsSimulation) {
            console.log('[StepTracker] 👻 Simulation Mode (Ghost Walker) ACTIVATED');

            // Initial bump if zero to show it's working
            if (currentSteps === 0) {
                const initial = 15;
                setCurrentSteps(initial);
                if (onStepDetected) onStepDetected(initial);
            }

            timer = setInterval(() => {
                setCurrentSteps(prev => {
                    const increment = Math.floor(Math.random() * 5) + 2; // Random 2-6 steps
                    const next = prev + increment;
                    console.log(`[StepTracker] 👻 Simulating steps: ${prev} -> ${next}`);
                    if (onStepDetected) onStepDetected(next);
                    return next;
                });
            }, 3000); // Update every 3 seconds
        }

        return () => {
            if (timer) clearInterval(timer);
        };
    }, [isTracking, isAvailable]);

    // Background/Foreground handling
    useEffect(() => {
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            if (
                appStateRef.current.match(/inactive|background/) &&
                nextAppState === 'active'
            ) {
                // App came to foreground, sync steps immediately
                if (isTracking && isAvailable !== false) {
                    // Re-sync logic: get total steps again
                    const end = new Date();
                    const start = new Date();
                    start.setHours(0, 0, 0, 0);
                    Pedometer.getStepCountAsync(start, end).then(result => {
                        setCurrentSteps(result.steps);
                        if (onStepDetected) onStepDetected(result.steps);
                    });
                }
            }
            appStateRef.current = nextAppState;
        };

        const sub = AppState.addEventListener('change', handleAppStateChange);
        return () => sub.remove();
    }, [isTracking, onStepDetected, isAvailable]);

    return {
        currentSteps,
        setCurrentSteps,
        isAvailable
    };
}
