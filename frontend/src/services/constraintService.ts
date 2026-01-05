import { apiClient, SchedulingConstraint } from './api';

export interface ImpactPreview {
    affectedSchedules: {
        scheduleId: string;
        date: string;
        analystId: string;
        analystName: string;
        shiftType: string;
        action: 'REMOVE' | 'MODIFY' | 'CONFLICT';
        reason: string;
    }[];
    fairnessDelta: {
        before: number;
        after: number;
        change: number;
    };
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    alternatives: {
        type: string;
        description: string;
        fairnessScore: number;
    }[];
    summary: string;
}

export interface RecalculationResult {
    success: boolean;
    schedulesRemoved: number;
    schedulesCreated: number;
    schedulesModified: number;
    affectedAnalysts: string[];
    fairnessScore: number;
    message: string;
}

export const constraintService = {
    /**
     * Preview impact of a new constraint before creating it
     */
    previewImpact: async (constraintData: Partial<SchedulingConstraint>): Promise<ImpactPreview> => {
        const response = await apiClient.post('/constraints/preview', constraintData);
        return (response.data as any).assessment as ImpactPreview;
    },

    /**
     * Preview impact of deleting a constraint
     */
    previewDeletion: async (id: string): Promise<ImpactPreview> => {
        const response = await apiClient.post(`/constraints/${id}/preview-deletion`);
        return (response.data as any).assessment as ImpactPreview;
    },

    /**
     * Create a constraint with assessment confirmation
     */
    createWithPreview: async (constraintData: Partial<SchedulingConstraint>): Promise<{
        success: boolean;
        constraint: SchedulingConstraint;
        assessment: ImpactPreview;
        step: 'PREVIEW' | 'CONFIRMED';
    }> => {
        const response = await apiClient.post('/constraints/with-preview?confirm=true', constraintData);
        return response.data as any;
    },

    /**
     * Trigger recalculation for a constraint
     */
    recalculate: async (constraintId: string): Promise<{ success: boolean; result: RecalculationResult }> => {
        const response = await apiClient.post(`/constraints/${constraintId}/recalculate`);
        return response.data as { success: boolean; result: RecalculationResult };
    },

    /**
     * Grant comp-off instead of recalculating
     */
    grantCompOff: async (constraintId: string): Promise<{ success: boolean; result: any }> => {
        const response = await apiClient.post(`/constraints/${constraintId}/grant-compoff`);
        return response.data as { success: boolean; result: any };
    },

    /**
     * Get available constraint templates
     */
    getTemplates: async (): Promise<any[]> => {
        const response = await apiClient.get('/constraint-templates');
        return response.data as any[];
    },

    // ========================================
    // Holiday Constraint Config (Singleton)
    // ========================================

    /**
     * Get the global holiday constraint configuration
     */
    getHolidayConstraintConfig: async (): Promise<{
        staffingCount: number | null;
        screenerCount: number | null;
        skipScreener: boolean;
        skipConsecutive: boolean;
        isActive: boolean;
        isDefault?: boolean;
    }> => {
        const response = await apiClient.get('/holiday-constraint');
        return response.data as any;
    },

    /**
     * Update the global holiday constraint configuration
     */
    updateHolidayConstraintConfig: async (config: {
        staffingCount?: number | null;
        screenerCount?: number | null;
        skipScreener?: boolean;
        skipConsecutive?: boolean;
    }): Promise<{ success: boolean; config: any }> => {
        const response = await apiClient.put('/holiday-constraint', config);
        return response.data as any;
    },

    // ========================================
    // Special Events
    // ========================================

    /**
     * Get all special events
     */
    getSpecialEvents: async (): Promise<SchedulingConstraint[]> => {
        const response = await apiClient.get('/special-events');
        return response.data as SchedulingConstraint[];
    },

    /**
     * Get special event templates and saved presets
     */
    getSpecialEventTemplates: async (): Promise<{
        systemTemplates: any[];
        savedPresets: any[];
    }> => {
        const response = await apiClient.get('/special-events/templates');
        return response.data as any;
    },

    /**
     * Create a special event
     */
    createSpecialEvent: async (eventData: {
        name: string;
        startDate: string;
        endDate: string;
        constraintType?: string;
        templateId?: string;
        templateParams?: Record<string, any>;
        skipContinuity?: boolean;
        skipConflictCheck?: boolean;
        grantCompOff?: boolean;
        description?: string;
    }): Promise<{ success: boolean; constraint: SchedulingConstraint; assessment: ImpactPreview }> => {
        const response = await apiClient.post('/special-events', eventData);
        return response.data as any;
    },

    /**
     * Delete a special event
     */
    deleteSpecialEvent: async (id: string): Promise<{ success: boolean }> => {
        const response = await apiClient.delete(`/special-events/${id}`);
        return response.data as any;
    }
};
