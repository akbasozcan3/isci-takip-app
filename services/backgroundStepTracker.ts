import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { Pedometer } from 'expo-sensors';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const BACKGROUND_STEP_TASK = 'BACKGROUND_STEP_TRACKING';

// 1. Task Definition
TaskManager.defineTask(BACKGROUND_STEP_TASK, async () => {
    try {
        const end = new Date();
        const start = new Date();
        start.setHours(0, 0, 0, 0);

        // 2. Fetch steps
        const result = await Pedometer.getStepCountAsync(start, end);

        if (result) {
            const steps = result.steps;

            // Calculate derived data
            const calories = Math.floor(steps * 0.04);
            // const distance = (steps * 0.762 / 1000).toFixed(2);

            // 3. Update Notification (Sticky)
            await updateStepNotification(steps, calories);

            // Optional: Sync with backend here if needed
            // await syncWithBackend(steps);

            return BackgroundFetch.BackgroundFetchResult.NewData;
        }

        return BackgroundFetch.BackgroundFetchResult.NoData;
    } catch (error) {
        console.error('[BackgroundSteps] Task failed:', error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
    }
});

// Helper to update sticky notification
async function updateStepNotification(steps: number, calories: number) {
    // Only update if steps > 0
    if (steps <= 0) return;

    // We need to set up a channel for Android foreground service-like behavior
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('step-tracking', {
            name: 'Adım Takibi',
            importance: Notifications.AndroidImportance.LOW, // Low importance to avoid sound/vibration spam
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    // Check if we should send a milestone notification or just update the sticky one
    // For now, let's just show current progress
    await Notifications.scheduleNotificationAsync({
        content: {
            title: 'Yürüyüş Devam Ediyor 🚶',
            body: `${steps.toLocaleString()} adım • ${calories} kcal`,
            sticky: true, // Android only: keeps it in notification center
            autoDismiss: false,
            priority: Notifications.AndroidNotificationPriority.LOW,
            data: { steps },
            color: '#06b6d4', // Cyan color
        },
        trigger: null, // Show immediately
    });
}

// 4. Register Task Function
export async function registerBackgroundStepTask() {
    try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_STEP_TASK);
        if (!isRegistered) {
            await BackgroundFetch.registerTaskAsync(BACKGROUND_STEP_TASK, {
                minimumInterval: 60 * 15, // 15 minutes
                stopOnTerminate: false, // Continue after app kill (iOS handles this differently)
                startOnBoot: true, // Android
            });
            console.log('[BackgroundSteps] Task registered');
        }
    } catch (err) {
        console.warn('[BackgroundSteps] Registration failed:', err);
    }
}

// 5. Unregister
export async function unregisterBackgroundStepTask() {
    try {
        await BackgroundFetch.unregisterTaskAsync(BACKGROUND_STEP_TASK);
        // Remove all notifications
        await Notifications.dismissAllNotificationsAsync();
    } catch (err) {
        console.warn('[BackgroundSteps] Unregistration failed:', err);
    }
}
