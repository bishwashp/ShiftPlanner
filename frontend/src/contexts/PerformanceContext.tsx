import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface PerformanceFlags {
    disableLiquidBackground: boolean;
    disableGlassEffects: boolean;
    useSolidSurfaces: boolean;
    simplifyCalendar: boolean;
}

interface PerformanceContextType {
    flags: PerformanceFlags;
    toggleFlag: (key: keyof PerformanceFlags) => void;
    resetFlags: () => void;
}

const defaultFlags: PerformanceFlags = {
    disableLiquidBackground: false,
    disableGlassEffects: false,
    useSolidSurfaces: false,
    simplifyCalendar: false,
};

const PerformanceContext = createContext<PerformanceContextType | undefined>(undefined);

export const PerformanceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // Initialize from localStorage if available
    const [flags, setFlags] = useState<PerformanceFlags>(() => {
        const saved = localStorage.getItem('perf-debug-flags');
        return saved ? JSON.parse(saved) : defaultFlags;
    });

    // Save to localStorage on change
    useEffect(() => {
        localStorage.setItem('perf-debug-flags', JSON.stringify(flags));
    }, [flags]);

    const toggleFlag = (key: keyof PerformanceFlags) => {
        setFlags(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const resetFlags = () => {
        setFlags(defaultFlags);
    };

    return (
        <PerformanceContext.Provider value={{ flags, toggleFlag, resetFlags }}>
            {children}
        </PerformanceContext.Provider>
    );
};

export const usePerformance = () => {
    const context = useContext(PerformanceContext);
    if (context === undefined) {
        // Fallback to default flags if used outside provider (e.g. in AuthProvider)
        return {
            flags: defaultFlags,
            toggleFlag: () => console.warn('Performance context not available'),
            resetFlags: () => console.warn('Performance context not available')
        };
    }
    return context;
};
