/**
 * Professional Network Hook
 * Real-time internet connectivity monitoring using NetInfo
 * Similar to Trendyol's network monitoring
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { checkBackendReachability } from '../utils/network';

export interface NetworkState {
  isConnected: boolean;
  isBackendReachable: boolean;
  isInternetReachable: boolean;
  type: string | null;
  isChecking: boolean;
}

const initialState: NetworkState = {
  isConnected: true,
  isBackendReachable: false,
  isInternetReachable: true,
  type: null,
  isChecking: true,
};

/**
 * Hook for real-time network monitoring
 * Listens to network state changes and checks backend reachability
 */
export function useNetwork() {
  const [networkState, setNetworkState] = useState<NetworkState>(initialState);

  useEffect(() => {
    // Initial check
    checkNetworkStatus();

    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const isConnected = state.isConnected ?? false;
      const isInternetReachable = state.isInternetReachable ?? false;

      setNetworkState(prev => ({
        ...prev,
        isConnected,
        isInternetReachable,
        type: state.type,
        isChecking: false,
      }));

      // If internet is connected, check backend
      if (isConnected && isInternetReachable) {
        checkBackend();
      } else {
        setNetworkState(prev => ({
          ...prev,
          isBackendReachable: false,
        }));
      }
    });

    // Periodic backend check (every 60 seconds - less aggressive)
    const backendCheckInterval = setInterval(() => {
      if (networkState.isConnected && networkState.isInternetReachable) {
        checkBackend();
      }
    }, 60000);

    return () => {
      unsubscribe();
      clearInterval(backendCheckInterval);
    };
  }, []);

  const checkNetworkStatus = async () => {
    try {
      setNetworkState(prev => ({ ...prev, isChecking: true }));
      
      const state = await NetInfo.fetch();
      const isConnected = state.isConnected ?? false;
      const isInternetReachable = state.isInternetReachable ?? false;

      setNetworkState(prev => ({
        ...prev,
        isConnected,
        isInternetReachable,
        type: state.type,
        isChecking: false,
      }));

      // Check backend if internet is available
      if (isConnected && isInternetReachable) {
        await checkBackend();
      }
    } catch (error) {
      console.warn('[useNetwork] Network check error:', error);
      setNetworkState(prev => ({
        ...prev,
        isConnected: false,
        isInternetReachable: false,
        isChecking: false,
      }));
    }
  };

  const checkBackend = async () => {
    try {
      const isBackendReachable = await checkBackendReachability();
      setNetworkState(prev => ({
        ...prev,
        isBackendReachable,
      }));
    } catch (error) {
      setNetworkState(prev => ({
        ...prev,
        isBackendReachable: false,
      }));
    }
  };

  const refresh = async () => {
    await checkNetworkStatus();
  };

  return {
    ...networkState,
    refresh,
    hasConnection: networkState.isConnected && networkState.isInternetReachable,
    hasFullConnection: networkState.isConnected && 
                      networkState.isInternetReachable && 
                      networkState.isBackendReachable,
  };
}

