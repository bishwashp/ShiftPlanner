import { ShiftDefinition } from '../contexts/ShiftDefinitionContext';

/**
 * Adapter to translate legacy backend keys (MORNING, EVENING) to 
 * region-specific dynamic shift names (e.g. AM, PM).
 * Tailored for ScheduleSnapshotData structure.
 */
export const adaptLegacySnapshot = (data: any, shiftDefinitions: ShiftDefinition[]) => {
    if (!data) return null;

    // If no definitions, return as is (Legacy Mode)
    if (!shiftDefinitions || shiftDefinitions.length === 0) {
        return data;
    }

    // Helper to map keys of an object based on definitions
    const adaptMap = (sourceObj: any) => {
        if (!sourceObj) return {};
        const targetObj: any = {};

        const sortedDefs = [...shiftDefinitions].sort((a, b) => a.startResult.localeCompare(b.startResult));
        const morningShift = sortedDefs[0]?.name; // e.g. AM
        const eveningShift = sortedDefs[1]?.name; // e.g. PM

        const mapKey = (key: string) => {
            if (key === 'MORNING' && morningShift) return morningShift;
            if (key === 'EVENING' && eveningShift) return eveningShift;
            return key;
        };

        Object.keys(sourceObj).forEach(key => {
            const newKey = mapKey(key);
            targetObj[newKey] = sourceObj[key];
        });

        return targetObj;
    };

    return {
        ...data,
        todaysScreeners: adaptMap(data.todaysScreeners),
        todaysCoverage: {
            ...data.todaysCoverage,
            counts: adaptMap(data.todaysCoverage?.counts),
            status: adaptMap(data.todaysCoverage?.status)
        }
    };
};
