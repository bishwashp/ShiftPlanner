import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

// Types
export interface CompOffBalance {
    analystId: string;
    analystName: string;
    regionId: string;
    regionName: string;
    earned: number;
    used: number;
    available: number;
    lastTransaction: string | null;
}

export interface CompOffTransaction {
    id: string;
    analystId: string;
    analystName: string;
    amount: number;
    reason: string;
    constraintId: string | null;
    absenceId: string | null;
    createdAt: string;
    runningBalance: number;
}

export interface TransactionHistoryResponse {
    transactions: CompOffTransaction[];
    total: number;
}

export interface EligibilityDay {
    date: string;
    daysWorkedInWindow: number;
    excessDays: number;
    isHoliday: boolean;
}

export interface EligibilityResult {
    isEligible: boolean;
    eligibleDays: EligibilityDay[];
    suggestedUnits: number;
    reason: string;
}

export interface EligibilitySummary {
    analystName: string;
    regionName: string;
    requestedRange: { start: string; end: string };
    eligibility: EligibilityResult;
    currentBalance: { earned: number; used: number; available: number };
}

// API Client with auth
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// CompOff Service
export const compOffService = {
    /**
     * Get all analysts' compoff balances
     */
    async getAllBalances(regionId?: string): Promise<CompOffBalance[]> {
        const params = regionId ? { regionId } : {};
        const response = await apiClient.get<CompOffBalance[]>('/compoff', { params });
        return response.data;
    },

    /**
     * Get transaction history with filtering
     */
    async getTransactionHistory(options: {
        regionId?: string;
        analystId?: string;
        startDate?: string;
        endDate?: string;
        limit?: number;
        offset?: number;
    } = {}): Promise<TransactionHistoryResponse> {
        const response = await apiClient.get<TransactionHistoryResponse>('/compoff/transactions', { params: options });
        return response.data;
    },

    /**
     * Get a specific analyst's balance
     */
    async getAnalystBalance(analystId: string): Promise<{ earned: number; used: number; available: number }> {
        const response = await apiClient.get<{ earned: number; used: number; available: number }>(`/compoff/${analystId}`);
        return response.data;
    },

    /**
     * Get total liability
     */
    async getTotalLiability(): Promise<{ totalEarned: number; totalUsed: number; totalOutstanding: number }> {
        const response = await apiClient.get<{ totalEarned: number; totalUsed: number; totalOutstanding: number }>('/compoff/liability');
        return response.data;
    },

    /**
     * Credit compoff to an analyst (admin only)
     */
    async creditCompOff(analystId: string, units: number, reason: string, constraintId?: string): Promise<any> {
        const response = await apiClient.post(`/compoff/${analystId}/credit`, {
            units,
            reason,
            constraintId,
        });
        return response.data;
    },

    /**
     * Debit compoff from an analyst (admin only)
     */
    async debitCompOff(analystId: string, units: number, absenceId?: string): Promise<any> {
        const response = await apiClient.post(`/compoff/${analystId}/debit`, {
            units,
            absenceId,
        });
        return response.data;
    },

    /**
     * Validate eligibility for missing compoff report
     */
    async validateEligibility(analystId: string, startDate: string, endDate: string): Promise<EligibilitySummary> {
        const response = await apiClient.post<EligibilitySummary>('/compoff/validate-eligibility', {
            analystId,
            startDate,
            endDate,
        });
        return response.data;
    },

    /**
     * Report missing compoff
     */
    async reportMissingCompOff(analystId: string, startDate: string, endDate: string, notes?: string): Promise<any> {
        const response = await apiClient.post('/compoff/report-missing', {
            analystId,
            startDate,
            endDate,
            notes,
        });
        return response.data;
    },

    /**
     * Check if analyst has sufficient balance
     */
    async checkBalance(analystId: string, units: number): Promise<{ hasAvailableBalance: boolean }> {
        const response = await apiClient.get<{ hasAvailableBalance: boolean }>(`/compoff/${analystId}/check/${units}`);
        return response.data;
    },

    /**
     * Delete a compoff transaction (Admin only)
     */
    async deleteTransaction(transactionId: string): Promise<void> {
        await apiClient.delete(`/compoff/transactions/${transactionId}`);
    },

    /**
     * Update a compoff transaction (Admin only)
     */
    async updateTransaction(transactionId: string, updates: { amount?: number; reason?: string }): Promise<CompOffTransaction> {
        const response = await apiClient.put(`/compoff/transactions/${transactionId}`, updates);
        return response.data as CompOffTransaction;
    },
    /**
     * Delete an analyst's entire comp-off balance (Admin only)
     */
    async deleteBalance(analystId: string): Promise<void> {
        await apiClient.delete(`/compoff/balance/${analystId}`);
    },

    /**
     * Update an analyst's balance directly (Admin only)
     */
    async updateBalance(analystId: string, updates: { earnedUnits?: number; usedUnits?: number; reason?: string }): Promise<CompOffBalance> {
        const response = await apiClient.put<CompOffBalance>(`/compoff/balance/${analystId}`, updates);
        return response.data;
    },
};

export default compOffService;
