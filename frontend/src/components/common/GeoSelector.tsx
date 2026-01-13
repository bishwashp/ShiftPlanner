import React, { useEffect, useState } from 'react';
import { useRegion } from '../../contexts/RegionContext';
import { apiClient as api } from '../../services/api';
import SpringDropdown from '../ui/SpringDropdown';

interface Region {
    id: string;
    name: string;
    timezone: string;
}

// Map region names to flags (temporary until DB supports it)
const REGION_FLAGS: Record<string, string> = {
    'AMR': '🇺🇸',
    'SGP': '🇸🇬',
    'LDN': '🇬🇧',
};

interface GeoSelectorProps {
    className?: string;
}

export const GeoSelector: React.FC<GeoSelectorProps> = ({ className = '' }) => {
    const { selectedRegionId, setSelectedRegionId } = useRegion();
    const [regions, setRegions] = useState<Region[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRegions = async () => {
            try {
                const response = await api.get<any>('/regions');

                // Robust data extraction:
                // If response is the array itself (some interceptors unwrap it) -> use response
                // If response has .data property which is array (Axios standard) -> use response.data
                const data = Array.isArray(response) ? response : (Array.isArray(response?.data) ? response.data : []);

                if (data.length > 0) {
                    setRegions(data);

                    // Auto-select if none selected or invalid
                    const amr = data.find((r: Region) => r.name === 'AMR');
                    const defaultId = amr ? amr.id : data[0].id;

                    // If no selection, OR if selection is invalid (not in list), pick default
                    const isValidSelection = selectedRegionId && data.some((r: Region) => r.id === selectedRegionId);

                    if (!selectedRegionId || !isValidSelection) {
                        console.log('GeoSelector: Auto-correcting selection to', defaultId);
                        setSelectedRegionId(defaultId);
                    }
                } else {
                    console.warn('GeoSelector: Extracted data is empty or not an array', data);
                }
            } catch (error) {
                console.error('GeoSelector: Failed to load regions', error);
            } finally {
                setLoading(false);
            }
        };
        fetchRegions();
    }, [selectedRegionId, setSelectedRegionId]); // Fixed: Added missing dependencies

    if (loading) return <span className="text-sm text-gray-400">Loading Regions...</span>;

    if (regions.length === 0) {
        return <span className="text-sm text-red-500 font-bold">No Regions Found (Check Console)</span>;
    }

    return (
        <div className={`flex items-center ${className}`}>
            <SpringDropdown
                value={selectedRegionId}
                onChange={(val) => {
                    const regionName = regions.find(r => r.id === val)?.name || 'Unknown';
                    console.log(`GeoSelector: User selected ${regionName} (${val})`);
                    setSelectedRegionId(val);
                    // REMOVED: window.location.reload();
                    // Region change is now handled reactively via key={selectedRegionId} in App.tsx
                    // This forces child components to remount with fresh state, without losing auth
                }}
                options={regions.map(r => ({
                    value: r.id,
                    label: `${REGION_FLAGS[r.name] || '🌍'} ${r.name}`
                }))}
                className="font-bold"
                variant="ghost"
                size="lg"
            />
        </div>
    );
};
