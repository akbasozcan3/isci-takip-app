import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define the Group type based on usage in track.tsx and location-features.tsx
export interface ActiveGroup {
    id: string;
    code: string;
    name: string;
    address: string;
    lat: number | null;
    lng: number | null;
    memberCount: number;
    onlineCount: number;
    userRole: string;
    isAdmin: boolean;
}

interface GroupContextType {
    selectedGroup: ActiveGroup | null;
    setSelectedGroup: (group: ActiveGroup | null) => void;
    isLoading: boolean;
}

const GroupContext = createContext<GroupContextType | undefined>(undefined);

export function GroupProvider({ children }: { children: React.ReactNode }) {
    const [selectedGroup, setSelectedGroupState] = useState<ActiveGroup | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Load from storage on mount
    useEffect(() => {
        const loadGroup = async () => {
            try {
                const stored = await AsyncStorage.getItem('selectedGroup');
                if (stored) {
                    setSelectedGroupState(JSON.parse(stored));
                }
            } catch (e) {
                console.error('[GroupContext] Failed to load group', e);
            } finally {
                setIsLoading(false);
            }
        };
        loadGroup();
    }, []);

    // Intercept state changes to persist them
    const setSelectedGroup = async (group: ActiveGroup | null) => {
        setSelectedGroupState(group);
        try {
            if (group) {
                await AsyncStorage.setItem('selectedGroup', JSON.stringify(group));
                console.log('[GroupContext] Saved group:', group.name);
            } else {
                await AsyncStorage.removeItem('selectedGroup');
                console.log('[GroupContext] Removed group');
            }
        } catch (e) {
            console.error('[GroupContext] Failed to save group', e);
        }
    };

    return (
        <GroupContext.Provider value={{ selectedGroup, setSelectedGroup, isLoading }}>
            {children}
        </GroupContext.Provider>
    );
}

export function useGroup() {
    const context = useContext(GroupContext);
    if (context === undefined) {
        throw new Error('useGroup must be used within a GroupProvider');
    }
    return context;
}
