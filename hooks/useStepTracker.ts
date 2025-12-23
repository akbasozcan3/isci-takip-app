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
        // If tracking is ON but Sensor is NOT AVAILABLE (Emulator) -> Start Simulation
        if (isTracking && isAvailable === false) {
            console.log('[StepTracker] Starting Simulation Mode (Ghost Walker)');
            // Init with random steps if starting from 0 to look realistic
            if (currentSteps === 0) setCurrentSteps(1240);

            timer = setInterval(() => {
                setCurrentSteps(prev => {
                    const next = prev + Math.floor(Math.random() * 3) + 1; // 1-3 steps random increment
                    if (onStepDetected) onStepDetected(next);
                    return next;
                });
            }, 2000); // Every 2 seconds
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
