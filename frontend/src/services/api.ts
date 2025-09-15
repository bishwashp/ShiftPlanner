import axios from 'axios';
import moment from 'moment';

// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request interceptor for logging
apiClient.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('API Response Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Type definitions
export interface Analyst {
  id: string;
  name: string;
  email: string;
  shiftType: 'MORNING' | 'EVENING';  // AM or PM shift assignment
  isActive: boolean;
  customAttributes?: any;
  skills?: string[];
  createdAt: string;
  updatedAt: string;
  preferences?: AnalystPreference[];
  schedules?: Schedule[];
  vacations?: Vacation[];
  constraints?: SchedulingConstraint[];
}

export interface AnalystPreference {
  id: string;
  analystId: string;
  shiftType: 'MORNING' | 'EVENING';
  dayOfWeek: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
  preference: 'PREFERRED' | 'AVAILABLE' | 'UNAVAILABLE';
  createdAt: string;
  updatedAt: string;
}

export interface Vacation {
  id: string;
  analystId: string;
  startDate: string;
  endDate: string;
  reason?: string;
  isApproved: boolean;
  createdAt: string;
  updatedAt: string;
  analyst?: Analyst;
}

export interface SchedulingConstraint {
  id: string;
  analystId?: string;
  shiftType?: 'MORNING' | 'EVENING';
  startDate: string;
  endDate: string;
  constraintType: 'BLACKOUT_DATE' | 'MAX_SCREENER_DAYS' | 'MIN_SCREENER_DAYS' | 'PREFERRED_SCREENER' | 'UNAVAILABLE_SCREENER';
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  analyst?: Analyst;
}

export interface Schedule {
  id: string;
  analystId: string;
  date: string;
  shiftType: 'MORNING' | 'EVENING';
  isScreener: boolean;  // Whether this analyst is designated as Screener for this shift
  createdAt: string;
  updatedAt: string;
  analyst?: Analyst;
}

export interface AlgorithmConfig {
  id: string;
  name: string;
  description?: string;
  config: any;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SchedulePreview {
  startDate: string;
  endDate: string;
  algorithmType: string;
  proposedSchedules: Array<{
    date: string;
    analystId: string;
    analystName: string;
    shiftType: 'MORNING' | 'EVENING';
    isScreener: boolean;
    type: 'NEW_SCHEDULE';
  }>;
  conflicts: Array<{
    date: string;
    type: string;
    description: string;
  }>;
  overwrites: Array<{
    date: string;
    existingAnalyst: string;
    newAnalyst: string;
    type: string;
  }>;
  summary: {
    totalDays: number;
    totalSchedules: number;
    newSchedules: number;
    overwrittenSchedules: number;
    conflicts: number;
  };
}

export interface ScheduleResult {
  message: string;
  createdSchedules: Schedule[];
  updatedSchedules: Schedule[];
  deletedSchedules: Schedule[];
  conflicts: Array<{
    date: string;
    type: string;
    description: string;
  }>;
}

export interface DashboardStats {
  totalAnalysts: number;
  activeAnalysts: number;
  scheduledShifts: number;
  pendingSchedules: number;
}

export interface ExportRequest {
  schedules: Schedule[];
  format: string;
  dateRange: {
    start: string;
    end: string;
  };
  analysts: Analyst[];
}

export interface WebhookConfig {
  url: string;
  events: string[];
  enabled: boolean;
}

// API Service Functions
export const apiService = {
  // Health Check
  health: async (): Promise<{ status: string; timestamp: string; version: string }> => {
    const response = await apiClient.get('/health');
    return response.data as { status: string; timestamp: string; version: string };
  },

  // Analysts
  getAnalysts: async (): Promise<Analyst[]> => {
    const response = await apiClient.get('/analysts');
    return response.data as Analyst[];
  },

  getAnalyst: async (id: string): Promise<Analyst> => {
    const response = await apiClient.get(`/analysts/${id}`);
    return response.data as Analyst;
  },

  createAnalyst: async (data: { name: string; email: string; shiftType: 'MORNING' | 'EVENING', customAttributes?: any, skills?: string[] }): Promise<Analyst> => {
    const response = await apiClient.post('/analysts', data);
    return response.data as Analyst;
  },

  updateAnalyst: async (id: string, data: { name?: string; email?: string; shiftType?: 'MORNING' | 'EVENING'; isActive?: boolean, customAttributes?: any, skills?: string[] }): Promise<Analyst> => {
    const response = await apiClient.put(`/analysts/${id}`, data);
    return response.data as Analyst;
  },

  deleteAnalyst: async (id: string): Promise<void> => {
    await apiClient.delete(`/analysts/${id}`);
  },

  getAnalystPreferences: async (id: string): Promise<AnalystPreference[]> => {
    const response = await apiClient.get(`/analysts/${id}/preferences`);
    return response.data as AnalystPreference[];
  },

  updateAnalystPreference: async (id: string, data: { shiftType: 'MORNING' | 'EVENING'; dayOfWeek: string; preference: 'PREFERRED' | 'AVAILABLE' | 'UNAVAILABLE' }): Promise<AnalystPreference> => {
    const response = await apiClient.put(`/analysts/${id}/preferences`, data);
    return response.data as AnalystPreference;
  },

  // Vacations
  getVacations: async (analystId?: string): Promise<Vacation[]> => {
    const params = analystId ? { analystId } : {};
    const response = await apiClient.get('/vacations', { params });
    return response.data as Vacation[];
  },

  createVacation: async (data: { analystId: string; startDate: string; endDate: string; reason?: string; isApproved?: boolean }): Promise<Vacation> => {
    const response = await apiClient.post('/vacations', data);
    return response.data as Vacation;
  },

  updateVacation: async (id: string, data: { startDate?: string; endDate?: string; reason?: string; isApproved?: boolean }): Promise<Vacation> => {
    const response = await apiClient.put(`/vacations/${id}`, data);
    return response.data as Vacation;
  },

  deleteVacation: async (id: string): Promise<void> => {
    await apiClient.delete(`/vacations/${id}`);
  },

  // Scheduling Constraints
  getConstraints: async (analystId?: string): Promise<SchedulingConstraint[]> => {
    const params = analystId ? { analystId } : {};
    const response = await apiClient.get('/constraints', { params });
    return response.data as SchedulingConstraint[];
  },

  createConstraint: async (data: { analystId?: string; shiftType?: 'MORNING' | 'EVENING'; startDate: string; endDate: string; constraintType: 'BLACKOUT_DATE' | 'MAX_SCREENER_DAYS' | 'MIN_SCREENER_DAYS' | 'PREFERRED_SCREENER' | 'UNAVAILABLE_SCREENER'; description?: string; isActive?: boolean }): Promise<SchedulingConstraint> => {
    const response = await apiClient.post('/constraints', data);
    return response.data as SchedulingConstraint;
  },

  updateConstraint: async (id: string, data: { startDate?: string; endDate?: string; constraintType?: 'BLACKOUT_DATE' | 'MAX_SCREENER_DAYS' | 'MIN_SCREENER_DAYS' | 'PREFERRED_SCREENER' | 'UNAVAILABLE_SCREENER'; description?: string; isActive?: boolean }): Promise<SchedulingConstraint> => {
    const response = await apiClient.put(`/constraints/${id}`, data);
    return response.data as SchedulingConstraint;
  },

  deleteConstraint: async (id: string): Promise<void> => {
    await apiClient.delete(`/constraints/${id}`);
  },

  // Schedules
  getSchedules: async (startDate: string, endDate: string): Promise<Schedule[]> => {
    const response = await apiClient.get('/schedules', { params: { startDate, endDate } });
    return response.data as Schedule[];
  },

  getSchedule: async (id: string): Promise<Schedule> => {
    const response = await apiClient.get(`/schedules/${id}`);
    return response.data as Schedule;
  },

  createSchedule: async (data: { analystId: string; date: string; shiftType: 'MORNING' | 'EVENING'; isScreener: boolean }): Promise<Schedule> => {
    const response = await apiClient.post('/schedules', data);
    return response.data as Schedule;
  },

  updateSchedule: async (id: string, data: { analystId?: string; date?: string; shiftType?: 'MORNING' | 'EVENING'; isScreener?: boolean }): Promise<Schedule> => {
    const response = await apiClient.put(`/schedules/${id}`, data);
    return response.data as Schedule;
  },

  deleteSchedule: async (id: string): Promise<void> => {
    await apiClient.delete(`/schedules/${id}`);
  },

  getScheduleHealth: async (params?: { startDate: string; endDate: string }): Promise<Array<{
    date: string; 
    message: string; 
    type: string; 
    missingShifts: string[]; 
    severity: string;
  }>> => {
    const response = await apiClient.get('/schedules/health/conflicts', { params });
    return response.data as Array<{
      date: string; 
      message: string; 
      type: string; 
      missingShifts: string[]; 
      severity: string;
    }>;
  },

  createBulkSchedules: async (schedules: Array<{ analystId: string; date: string; shiftType: 'MORNING' | 'EVENING'; isScreener?: boolean }>): Promise<{ message: string; count: number }> => {
    const response = await apiClient.post('/schedules/bulk', { schedules });
    return response.data as { message: string; count: number };
  },

  // MVP Schedule Generation (New Implementation)
  generateSchedule: async (data: { startDate: string; endDate: string; algorithm?: string }): Promise<{
    message: string;
    summary: {
      totalConflicts: number;
      criticalConflicts: number;
      assignmentsNeeded: number;
      estimatedTime: string;
    };
    suggestedAssignments: Array<{
      date: string;
      analystId: string;
      analystName: string;
      shiftType: 'MORNING' | 'EVENING';
      isScreener: boolean;
      strategy: string;
    }>;
    dateRange: {
      startDate: string;
      endDate: string;
    };
    existingSchedules: number;
    newAssignments: number;
  }> => {
    const response = await apiClient.post('/schedules/generate', data);
    return response.data as {
      message: string;
      summary: {
        totalConflicts: number;
        criticalConflicts: number;
        assignmentsNeeded: number;
        estimatedTime: string;
      };
      suggestedAssignments: Array<{
        date: string;
        analystId: string;
        analystName: string;
        shiftType: 'MORNING' | 'EVENING';
        isScreener: boolean;
        strategy: string;
      }>;
      dateRange: {
        startDate: string;
        endDate: string;
      };
      existingSchedules: number;
      newAssignments: number;
    };
  },

  // Legacy Automated Scheduling (for compatibility)
  generateSchedulePreview: async (data: { startDate: string; endDate: string; shiftType?: 'MORNING' | 'EVENING'; algorithmType?: string }): Promise<SchedulePreview> => {
    const response = await apiClient.post('/algorithms/generate-preview', data);
    return response.data as SchedulePreview;
  },

  applyAutomatedSchedule: async (data: { startDate: string; endDate: string; shiftType?: 'MORNING' | 'EVENING'; algorithmType?: string; overwriteExisting?: boolean }): Promise<ScheduleResult> => {
    const response = await apiClient.post('/algorithms/apply-schedule', data);
    return response.data as ScheduleResult;
  },

  // Algorithms
  getAlgorithms: async (): Promise<AlgorithmConfig[]> => {
    const response = await apiClient.get('/algorithms');
    return response.data as AlgorithmConfig[];
  },

  getAlgorithm: async (id: string): Promise<AlgorithmConfig> => {
    const response = await apiClient.get(`/algorithms/${id}`);
    return response.data as AlgorithmConfig;
  },

  createAlgorithm: async (data: { name: string; description?: string; config: any }): Promise<AlgorithmConfig> => {
    const response = await apiClient.post('/algorithms', data);
    return response.data as AlgorithmConfig;
  },

  updateAlgorithm: async (id: string, data: { name?: string; description?: string; config?: any; isActive?: boolean }): Promise<AlgorithmConfig> => {
    const response = await apiClient.put(`/algorithms/${id}`, data);
    return response.data as AlgorithmConfig;
  },

  deleteAlgorithm: async (id: string): Promise<void> => {
    await apiClient.delete(`/algorithms/${id}`);
  },

  activateAlgorithm: async (id: string): Promise<AlgorithmConfig> => {
    const response = await apiClient.post(`/algorithms/${id}/activate`);
    return response.data as AlgorithmConfig;
  },

  getActiveAlgorithm: async (): Promise<AlgorithmConfig> => {
    const response = await apiClient.get('/algorithms/active/current');
    return response.data as AlgorithmConfig;
  },

  // Analytics
  getWorkDayTally: async (month: number, year: number): Promise<Array<{ 
    analystId: string; 
    analystName: string; 
    month: number;
    year: number;
    totalWorkDays: number;
    regularShiftDays: number;
    screenerDays: number;
    weekendDays: number;
    consecutiveWorkDayStreaks: number;
    fairnessScore: number;
  }>> => {
    const response = await apiClient.get(`/analytics/monthly-tallies/${year}/${month}`);
    return (response.data as any).data as Array<{ 
      analystId: string; 
      analystName: string; 
      month: number;
      year: number;
      totalWorkDays: number;
      regularShiftDays: number;
      screenerDays: number;
      weekendDays: number;
      consecutiveWorkDayStreaks: number;
      fairnessScore: number;
    }>;
  },

  // Enhanced Analytics Endpoints
  getFairnessReport: async (startDate: string, endDate: string): Promise<any> => {
    const response = await apiClient.get('/analytics/fairness-report', { 
      params: { startDate, endDate } 
    });
    return (response.data as any).data;
  },

  getAnalyticsHealth: async (): Promise<any> => {
    const response = await apiClient.get('/analytics/health');
    return (response.data as any).data;
  },

  // Dashboard Stats (computed from other endpoints)
  getDashboardStats: async (): Promise<DashboardStats> => {
    try {
      const startDate = moment().startOf('month').format('YYYY-MM-DD');
      const endDate = moment().endOf('month').format('YYYY-MM-DD');

      const [analysts, schedules] = await Promise.all([
        apiService.getAnalysts(),
        apiService.getSchedules(startDate, endDate)
      ]);

      const activeAnalysts = analysts.filter(a => a.isActive).length;

      return {
        totalAnalysts: analysts.length,
        activeAnalysts: activeAnalysts,
        scheduledShifts: schedules.length,
        pendingSchedules: 0, // Placeholder
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      // Return a default/empty state on error
      return {
        totalAnalysts: 0,
        activeAnalysts: 0,
        scheduledShifts: 0,
        pendingSchedules: 0,
      };
    }
  },

  // Fetches all schedules within a given date range
  getAllConflicts: async (startDate: string, endDate: string): Promise<{ critical: any[], recommended: any[] }> => {
    const response = await apiClient.get('/schedules/health/conflicts', { params: { startDate, endDate } });
    return response.data as { critical: any[], recommended: any[] };
  },

  // Gets auto-fix proposals from the intelligent scheduler
  autoFixConflicts: async (params: { startDate: string, endDate: string }): Promise<any> => {
    const response = await apiClient.post('/schedules/auto-fix-conflicts', params);
    return response.data;
  },

  // Applies a list of assignments to resolve conflicts
  applyAutoFix: async (data: { assignments: any[] }): Promise<{ 
    message: string; 
    createdSchedules: any[]; 
    errors?: Array<{ assignment: any; error: string }> 
  }> => {
    const response = await apiClient.post('/schedules/apply-auto-fix', data);
    return response.data as { 
      message: string; 
      createdSchedules: any[]; 
      errors?: Array<{ assignment: any; error: string }> 
    };
  },

  // Calendar Export & Integration
  exportCalendar: async (data: ExportRequest): Promise<any> => {
    const response = await apiClient.post('/calendar/export', data, {
      responseType: 'blob'
    });
    return response;
  },

  generateICal: async (schedules: Schedule[], analysts: Analyst[]): Promise<string> => {
    const response = await apiClient.post('/calendar/ical', { schedules, analysts });
    return response.data as string;
  },

  setupWebhook: async (config: WebhookConfig): Promise<{ message: string; webhookId: string }> => {
    const response = await apiClient.post('/calendar/webhook', config);
    return response.data as { message: string; webhookId: string };
  },

  getWebhookStatus: async (): Promise<{ enabled: boolean; url?: string; lastTriggered?: string }> => {
    const response = await apiClient.get('/calendar/webhook/status');
    return response.data as { enabled: boolean; url?: string; lastTriggered?: string };
  },

  deleteWebhook: async (): Promise<{ message: string }> => {
    const response = await apiClient.delete('/calendar/webhook');
    return response.data as { message: string };
  },

  // External Calendar Integration
  exportToGoogleCalendar: async (schedules: Schedule[]): Promise<{ message: string; calendarUrl: string }> => {
    const response = await apiClient.post('/calendar/google', { schedules });
    return response.data as { message: string; calendarUrl: string };
  },

  exportToOutlook: async (schedules: Schedule[]): Promise<{ message: string; calendarUrl: string }> => {
    const response = await apiClient.post('/calendar/outlook', { schedules });
    return response.data as { message: string; calendarUrl: string };
  },

  exportToAppleCalendar: async (schedules: Schedule[]): Promise<{ message: string; calendarUrl: string }> => {
    const response = await apiClient.post('/calendar/apple', { schedules });
    return response.data as { message: string; calendarUrl: string };
  },
};

export default apiService; 