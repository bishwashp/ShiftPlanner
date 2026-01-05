import React, { createContext, useContext, useState, useEffect } from 'react';

interface RegionContextType {
    selectedRegionId: string;
    setSelectedRegionId: (id: string) => void;
    isLoading: boolean;
}

const RegionContext = createContext<RegionContextType | undefined>(undefined);

// Default to AMR if nothing selected (assuming standard ID or we fetch it)
// For robustness, better to fetch, but we can default to null and handle loading.
const STORAGE_KEY = 'user_selected_region_id';

export const RegionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Initialize state directly from localStorage to avoid race conditions
    const [selectedRegionId, setSelectedRegionId] = useState<string>(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored || '';
    });

    // We can consider 'loading' done immediately since we read synchronously
    const [isLoading, setIsLoading] = useState(false);

    const handleSetRegion = (id: string) => {
        setSelectedRegionId(id);
        localStorage.setItem(STORAGE_KEY, id);
        // Reload page to ensure all API calls refresh with new header?
        // Or just rely on React state updates if we use contexts correctly.
        // However, many components fetch on mount. A reload is safer for Phase 3 
        // to ensure complete isolation without refactoring every useEffect dependency.
        // Decision: Let's NOT auto-reload yet, let's try to make it reactive. 
        // actually, for this specific request "Verify End-to-End", reloading is a pragmatic way to guarantee state reset.
        // But let's try reactive first.
    };

    return (
        <RegionContext.Provider value={{ selectedRegionId, setSelectedRegionId: handleSetRegion, isLoading }}>
            {children}
        </RegionContext.Provider>
    );
};

export const useRegion = () => {
    const context = useContext(RegionContext);
    if (context === undefined) {
        throw new Error('useRegion must be used within a RegionProvider');
    }
    return context;
};
