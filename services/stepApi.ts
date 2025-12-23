/**
 * Step Counter API Service
 * Communicates with backend for step data sync
 */

import { getApiBase } from '../utils/api';
import * as SecureStore from 'expo-secure-store';

const API_BASE = getApiBase();

async function getAuthToken() {
    try {
        return await SecureStore.getItemAsync('authToken');
    } catch {
        return null;
    }
}

export interface StepData {
    steps: number;
    distance: number;
    calories: number;
    duration: number;
    date?: string;
}

export interface StepResponse {
    success: boolean;
    data?: any;
    message?: string;
    error?: string;
}

/**
 * Sync step data with backend
 */
export async function syncSteps(data: StepData): Promise<StepResponse> {
    try {
        const token = await getAuthToken();
        if (!token) {
            return { success: false, error: 'AUTH_REQUIRED' };
        }

        const response = await fetch(`${API_BASE}/api/steps/sync`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        return result;
    } catch (error: any) {
        console.error('[StepAPI] Sync error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get today's steps from backend
 */
export async function getTodaySteps(): Promise<StepResponse> {
    try {
        const token = await getAuthToken();
        if (!token) {
            return { success: false, error: 'AUTH_REQUIRED' };
        }

        const response = await fetch(`${API_BASE}/api/steps/today`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();
        return result;
    } catch (error: any) {
        console.error('[StepAPI] Get today error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get step history
 */
export async function getStepHistory(days: number = 7): Promise<StepResponse> {
    try {
        const token = await getAuthToken();
        if (!token) {
            return { success: false, error: 'AUTH_REQUIRED' };
        }

        const response = await fetch(`${API_BASE}/api/steps/history?days=${days}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();
        return result;
    } catch (error: any) {
        console.error('[StepAPI] Get history error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get statistics
 */
export async function getStepStats(period: 'week' | 'month' | 'year' = 'week'): Promise<StepResponse> {
    try {
        const token = await getAuthToken();
        if (!token) {
            return { success: false, error: 'AUTH_REQUIRED' };
        }

        const response = await fetch(`${API_BASE}/api/steps/stats?period=${period}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();
        return result;
    } catch (error: any) {
        console.error('[StepAPI] Get stats error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get streak
 */
export async function getStreak(): Promise<StepResponse> {
    try {
        const token = await getAuthToken();
        if (!token) {
            return { success: false, error: 'AUTH_REQUIRED' };
        }

        const response = await fetch(`${API_BASE}/api/steps/streak`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();
        return result;
    } catch (error: any) {
        console.error('[StepAPI] Get streak error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Set daily goal
 */
export async function setStepGoal(goal: number): Promise<StepResponse> {
    try {
        const token = await getAuthToken();
        if (!token) {
            return { success: false, error: 'AUTH_REQUIRED' };
        }

        const response = await fetch(`${API_BASE}/api/steps/goal`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ goal })
        });

        const result = await response.json();
        return result;
    } catch (error: any) {
        console.error('[StepAPI] Set goal error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get current goal
 */
export async function getStepGoal(): Promise<StepResponse> {
    try {
        const token = await getAuthToken();
        if (!token) {
            return { success: false, error: 'AUTH_REQUIRED' };
        }

        const response = await fetch(`${API_BASE}/api/steps/goal`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();
        return result;
    } catch (error: any) {
        console.error('[StepAPI] Get goal error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Delete goal
 */
export async function deleteStepGoal(): Promise<StepResponse> {
    try {
        const token = await getAuthToken();
        if (!token) {
            return { success: false, error: 'AUTH_REQUIRED' };
        }

        const response = await fetch(`${API_BASE}/api/steps/goal`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();
        return result;
    } catch (error: any) {
        console.error('[StepAPI] Delete goal error:', error);
        return { success: false, error: error.message };
    }
}

// ============= PREMIUM APIs =============

/**
 * Get weekly comparison
 */
export async function getWeeklyComparison(): Promise<StepResponse> {
    try {
        const token = await getAuthToken();
        if (!token) {
            return { success: false, error: 'AUTH_REQUIRED' };
        }

        const response = await fetch(`${API_BASE}/api/steps/analytics/weekly-comparison`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();
        return result;
    } catch (error: any) {
        console.error('[StepAPI] Weekly comparison error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get personalized insights
 */
export async function getInsights(): Promise<StepResponse> {
    try {
        const token = await getAuthToken();
        if (!token) {
            return { success: false, error: 'AUTH_REQUIRED' };
        }

        const response = await fetch(`${API_BASE}/api/steps/analytics/insights`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();
        return result;
    } catch (error: any) {
        console.error('[StepAPI] Insights error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get next week prediction
 */
export async function getPrediction(): Promise<StepResponse> {
    try {
        const token = await getAuthToken();
        if (!token) {
            return { success: false, error: 'AUTH_REQUIRED' };
        }

        const response = await fetch(`${API_BASE}/api/steps/analytics/prediction`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();
        return result;
    } catch (error: any) {
        console.error('[StepAPI] Prediction error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get health score
 */
export async function getHealthScore(): Promise<StepResponse> {
    try {
        const token = await getAuthToken();
        if (!token) {
            return { success: false, error: 'AUTH_REQUIRED' };
        }

        const response = await fetch(`${API_BASE}/api/steps/analytics/health-score`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();
        return result;
    } catch (error: any) {
        console.error('[StepAPI] Health score error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Send background notification
 */
export async function sendBackgroundNotification(steps: number, calories: number, goal?: number): Promise<StepResponse> {
    try {
        const token = await getAuthToken();
        if (!token) {
            return { success: false, error: 'AUTH_REQUIRED' };
        }

        const response = await fetch(`${API_BASE}/api/steps/background-notification`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ steps, calories, goal })
        });

        const result = await response.json();
        return result;
    } catch (error: any) {
        console.error('[StepAPI] Background notification error:', error);
        return { success: false, error: error.message };
    }
}
