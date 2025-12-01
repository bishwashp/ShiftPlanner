import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Period = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

interface PeriodContextType {
    period: Period;
    setPeriod: (period: Period) => void;
    dateOffset: number;
    setDateOffset: React.Dispatch<React.SetStateAction<number>>;
}

const PeriodContext = createContext<PeriodContextType | undefined>(undefined);

export const PeriodProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [period, setPeriod] = useState<Period>('MONTHLY');
    const [dateOffset, setDateOffset] = useState<number>(0);

    // Reset offset when period changes
    React.useEffect(() => {
        setDateOffset(0);
    }, [period]);

    return (
        <PeriodContext.Provider value={{ period, setPeriod, dateOffset, setDateOffset }}>
            {children}
        </PeriodContext.Provider>
    );
};

export const usePeriod = () => {
    const context = useContext(PeriodContext);
    if (context === undefined) {
        throw new Error('usePeriod must be used within a PeriodProvider');
    }
    return context;
};
