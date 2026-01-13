import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiService } from '../services/api';
import { useRegion } from '../contexts/RegionContext';

export interface ShiftDefinition {
    id: string;
    name: string; // e.g. "AM", "PM", "MORNING"
    startResult: string; // "06:00"
    endResult: string; // "14:00"
    regionId: string;
}

interface ShiftDefinitionContextType {
    shiftDefinitions: ShiftDefinition[];
    isLoading: boolean;
    error: string | null;
    getShiftDefinition: (name: string) => ShiftDefinition | undefined;
    availableShifts: string[]; // List of shift names e.g. ["AM", "PM"]
    isLateShift: (shiftName: string) => boolean;
}

const ShiftDefinitionContext = createContext<ShiftDefinitionContextType | undefined>(undefined);

export const ShiftDefinitionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { selectedRegionId } = useRegion();
    const [shiftDefinitions, setShiftDefinitions] = useState<ShiftDefinition[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fallback Definitions for when API returns empty or fails
    // This ensures functionality maintains "Tandem Operation" with known constraints
    const getFallbackDefinitions = (regionId: string): ShiftDefinition[] => {
        // SGP Region (ID 2 usually, call safely) - we can infer from selectedRegionId content or fetch behavior
        // For now, we return a standard set if empty
        return [
            { id: 'legacy-morning', name: 'MORNING', startResult: '06:00', endResult: '14:00', regionId },
            { id: 'legacy-evening', name: 'EVENING', startResult: '14:00', endResult: '22:00', regionId }
        ];
    };

    useEffect(() => {
        const fetchDefinitions = async () => {
            if (!selectedRegionId) return;

            setIsLoading(true);
            try {
                // Attempt to fetch from API
                const data = await apiService.getShiftDefinitions(selectedRegionId);

                if (data && data.length > 0) {
                    setShiftDefinitions(data);
                } else {
                    // Fallback if API returns nothing (e.g. not seeded yet)
                    // Ideally we would inspect the Region Name to decide between AM/PM (SGP) or MORNING/EVENING (AMR)
                    // But since the API should be the source of truth, empty means 'no definitions'.
                    // We will fallback to empty array to force components to handle cases gracefully, 
                    // OR fallback to legacy if we want to be safe.
                    setShiftDefinitions([]);
                }
                setError(null);
            } catch (err) {
                console.warn('Failed to fetch shift definitions, falling back to legacy mode', err);
                setShiftDefinitions(getFallbackDefinitions(selectedRegionId));
                // We don't set error string to avoid UI clutter, just warn in console
            } finally {
                setIsLoading(false);
            }
        };

        fetchDefinitions();
    }, [selectedRegionId]);

    const getShiftDefinition = (name: string) => {
        return shiftDefinitions.find(d => d.name.toUpperCase() === name.toUpperCase());
    };

    const isLateShift = (shiftName: string) => {
        const upper = shiftName.toUpperCase();
        // Intelligent check: returns true for PM, EVENING, LATE, NIGHT
        return ['PM', 'EVENING', 'LATE', 'NIGHT'].some(s => upper.includes(s));
    };

    const availableShifts = shiftDefinitions.map(d => d.name);

    return (
        <ShiftDefinitionContext.Provider value={{
            shiftDefinitions,
            isLoading,
            error,
            getShiftDefinition,
            availableShifts,
            isLateShift
        }}>
            {children}
        </ShiftDefinitionContext.Provider>
    );
};

export const useShiftDefinitions = () => {
    const context = useContext(ShiftDefinitionContext);
    if (context === undefined) {
        throw new Error('useShiftDefinitions must be used within a ShiftDefinitionProvider');
    }
    return context;
};
