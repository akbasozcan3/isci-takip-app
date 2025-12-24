import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export interface NetworkState {
    isConnected: boolean;
    isInternetReachable: boolean;
    type: string;
}

export function useNetworkStatus() {
    const [networkState, setNetworkState] = useState<NetworkState>({
        isConnected: true,
        isInternetReachable: true,
        type: 'unknown',
    });

    useEffect(() => {
        // Subscribe to network state updates
        const unsubscribe = NetInfo.addEventListener(state => {
            setNetworkState({
                isConnected: state.isConnected ?? false,
                isInternetReachable: state.isInternetReachable ?? false,
                type: state.type,
            });
        });

        // Cleanup subscription
        return () => unsubscribe();
    }, []);

    return networkState;
}

export async function checkNetworkConnection(): Promise<NetworkState> {
    const state = await NetInfo.fetch();
    return {
        isConnected: state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable ?? false,
        type: state.type,
    };
}
