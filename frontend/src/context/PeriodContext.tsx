import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Period = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

interface PeriodContextType {
    period: Period;
    setPeriod: (period: Period) => void;
}

const PeriodContext = createContext<PeriodContextType | undefined>(undefined);

export const PeriodProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [period, setPeriod] = useState<Period>('MONTHLY');

    return (
        <PeriodContext.Provider value={{ period, setPeriod }}>
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
