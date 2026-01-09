import axios from 'axios';
import moment from 'moment';
import { cacheService } from './cacheService';
// Importing debounce for potential future use
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { debounce } from '../hooks/useDebounce';

// Define AxiosRequestConfig type for compatibility
type AxiosRequestConfig = any;

// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

// Request throttling configuration
const THROTTLE_DELAY = 300; // 300ms between requests
const CACHE_TTL = 30000; // 30 seconds cache TTL for GET requests
const MAX_RETRIES = 3; // Maximum number of retries for failed requests
const RETRY_DELAY = 1000; // 1 second delay between retries

// Create axios instance with default config
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request queue to manage concurrent requests
const requestQueue: {
  config: AxiosRequestConfig;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  retryCount: number;
}[] = [];
let isProcessingQueue = false;

// Process the request queue with throttling
const processQueue = async () => {
  if (requestQueue.length === 0 || isProcessingQueue) {
    return;
  }

  isProcessingQueue = true;
  const { config, resolve, reject, retryCount } = requestQueue.shift()!;

  try {
    // Check cache for GET requests
    if (config.method?.toLowerCase() === 'get' && config.url) {
      const cacheKey = `${config.url}${config.params ? JSON.stringify(config.params) : ''}`;
      const cachedData = cacheService.get(cacheKey);

      if (cachedData) {
        console.log(`Cache hit for: ${config.url}`);
        resolve(cachedData);
        setTimeout(processQueue, 0);
        isProcessingQueue = false;
        return;
      }
    }

    const response = await axios(config);

    // Cache successful GET responses
    if (config.method?.toLowerCase() === 'get' && config.url) {
      const cacheKey = `${config.url}${config.params ? JSON.stringify(config.params) : ''}`;
      cacheService.set(cacheKey, response, CACHE_TTL);
    }

    resolve(response);
  } catch (error: any) {
    // Retry on rate limit errors
    if (error.response?.status === 429 && retryCount < MAX_RETRIES) {
      const retryAfter = error.response.headers['retry-after']
        ? parseInt(error.response.headers['retry-after']) * 1000
        : RETRY_DELAY;

      console.log(`Rate limited. Retrying after ${retryAfter}ms (Attempt ${retryCount + 1}/${MAX_RETRIES})`);

      setTimeout(() => {
        requestQueue.push({ config, resolve, reject, retryCount: retryCount + 1 });
        processQueue();
      }, retryAfter);
    } else {
      reject(error);
    }
  } finally {
    setTimeout(() => {
      isProcessingQueue = false;
      processQueue();
    }, THROTTLE_DELAY);
  }
};

// Throttled request function
const throttledRequest = (config: AxiosRequestConfig) => {
  return new Promise((resolve, reject) => {
    requestQueue.push({ config, resolve, reject, retryCount: 0 });
    processQueue();
  });
};

// Override axios methods with throttled versions
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const originalRequest = apiClient.request;
// @ts-ignore - Ignore type checking for this line as we're using a custom implementation
apiClient.request = function (config) {
  return throttledRequest(config);
};

// Add Authorization header with JWT token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      // Ensure headers object exists
      config.headers = config.headers || {};
      // Use non-null assertion since we just initialized it
      config.headers!.Authorization = `Bearer ${token}`;
    }

    // Add Region Context Header (unless explicitly overridden)
    // If the request already has x-region-id header set (even to empty), don't override
    const regionId = localStorage.getItem('user_selected_region_id');
    if (regionId && !('x-region-id' in (config.headers || {}))) {
      config.headers = config.headers || {};
      config.headers!['x-region-id'] = regionId;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

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

    // Handle rate limiting errors
    if (error.response?.status === 429) {
      const retryAfter = error.response.data?.retryAfter || 60;
      console.warn(`Rate limit exceeded. Retry after ${retryAfter} seconds.`);
    }

    return Promise.reject(error);
  }
);

// Type definitions
export interface Analyst {
  id: string;
  name: string;
  email: string;
  shiftType: string;  // AM, PM, LDN, or legacy MORNING/EVENING
  employeeType: 'EMPLOYEE' | 'CONTRACTOR';  // Employee type classification
  isActive: boolean;
  customAttributes?: any;
  skills?: string[];
  createdAt: string;
  updatedAt: string;
  preferences?: AnalystPreference[];
  schedules?: Schedule[];
  vacations?: Vacation[];
  constraints?: SchedulingConstraint[];
  // Phase 1: ShiftDefinition relation (optional for backward compatibility)
  shiftDefinitionId?: string;
  shiftDefinition?: {
    id: string;
    name: string;
    regionId: string;
    startResult: string;
    endResult: string;
  };
  regionId?: string;
  region?: {
    id: string;
    name: string;
    timezone: string;
  };
}


export interface AnalystPreference {
  id: string;
  analystId: string;
  shiftType: string;
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
  shiftType?: string;
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
  shiftType: string;
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

export interface ScheduleGenerationLog {
  id: string;
  generatedBy: string;
  algorithmType: string;
  startDate: string;
  endDate: string;
  schedulesGenerated: number;
  conflictsDetected: number;
  fairnessScore?: number;
  executionTime?: number;
  status: 'SUCCESS' | 'FAILED' | 'PARTIAL';
  errorMessage?: string;
  metadata?: any;
  createdAt: string;
}

export interface Activity {
  id: string;
  type: string;
  category: string;
  title: string;
  description: string;
  performedBy?: string;
  resourceType?: string;
  resourceId?: string;
  impact: string;
  createdAt: string;
  metadata?: any;
}

export interface GenerationStats {
  totalGenerations: number;
  successfulGenerations: number;
  failedGenerations: number;
  totalSchedulesGenerated: number;
  averageExecutionTime: number;
  mostUsedAlgorithm: string;
}

export interface FairnessMetrics {
  analystId: string;
  analystName: string;
  totalDaysWorked: number;
  weekendDaysWorked: number;
  holidayDaysWorked: number;
  screenerDaysAssigned: number;
  consecutiveWorkDays: number[];
  averageWorkload: number;
}

export interface FairnessReport {
  dateRange: {
    startDate: string;
    endDate: string;
  };
  schedulesAnalyzed: number;
  analystsCount: number;
  overallScore: number;
  components: {
    workload: number;
    weekend: number;
    screener: number;
    holiday: number;
  };
  analystMetrics: FairnessMetrics[];
  recommendations: string[];
}

export interface MonthlyTally {
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
}

export interface BurnoutRisk {
  analystId: string;
  analystName: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore: number;
  factors: string[];
  recommendations: string[];
}

export interface SchedulePreview {
  startDate: string;
  endDate: string;
  algorithmType: string;
  proposedSchedules: Array<{
    date: string;
    analystId: string;
    analystName: string;
    shiftType: string;
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

// Dashboard Types
export interface DashboardOperationalStatus {
  currentShift: {
    id: string;
    name: string;
    isOvernight: boolean;
  } | null;
  nextHandover: {
    id: string;
    sourceShift: string;
    targetRegion: string;
    targetShift: string;
    handoverTime: string;
    timestamp?: string; // ISO string calculated by server
    timeUntil: number; // seconds
  } | null;
}

// Global Dashboard Status (region-agnostic)
export interface GlobalDashboardStatus {
  nextHandover: {
    id: string;
    sourceRegion: string;
    sourceShift: string;
    targetRegion: string;
    targetShift: string;
    handoverTime: string;
    handoverTimeUtc: string;
    timeUntil: number;
    timestamp: string;
  } | null;
}

// API Service Functions
export const apiService = {
  // Dashboard Status (region-scoped)
  getDashboardStatus: async (): Promise<DashboardOperationalStatus> => {
    const response = await apiClient.get('/dashboard/status');
    return response.data as DashboardOperationalStatus;
  },

  // Global Dashboard Status (region-agnostic)
  getGlobalDashboardStatus: async (): Promise<GlobalDashboardStatus> => {
    const response = await apiClient.get('/dashboard/global-status');
    return response.data as GlobalDashboardStatus;
  },

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

  createAnalyst: async (data: { name: string; email: string; shiftType: string; employeeType: 'EMPLOYEE' | 'CONTRACTOR'; customAttributes?: any, skills?: string[] }): Promise<Analyst> => {
    const response = await apiClient.post('/analysts', data);
    return response.data as Analyst;
  },

  updateAnalyst: async (id: string, data: { name?: string; email?: string; shiftType?: string; employeeType?: 'EMPLOYEE' | 'CONTRACTOR'; isActive?: boolean, customAttributes?: any, skills?: string[] }): Promise<Analyst> => {
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

  updateAnalystPreference: async (id: string, data: { shiftType: string; dayOfWeek: string; preference: 'PREFERRED' | 'AVAILABLE' | 'UNAVAILABLE' }): Promise<AnalystPreference> => {
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
    const response = await apiClient.post('/absences', data);
    return response.data as Vacation;
  },

  updateVacation: async (id: string, data: { startDate?: string; endDate?: string; reason?: string; isApproved?: boolean; denialReason?: string; status?: string }): Promise<Vacation> => {
    const response = await apiClient.put(`/absences/${id}`, data);
    return response.data as Vacation;
  },

  deleteVacation: async (id: string): Promise<void> => {
    await apiClient.delete(`/absences/${id}`);
  },

  // Absence Impact Analysis
  analyzeAbsenceImpact: async (data: { analystId: string; startDate: string; endDate: string; type: string }): Promise<any> => {
    const response = await apiClient.post('/absences/impact', data);
    return response.data;
  },

  // Notifications
  getNotifications: async (userId?: string, analystId?: string, userRole?: string, unreadOnly?: boolean): Promise<any[]> => {
    const params: any = {};
    if (userId) params.userId = userId;
    if (analystId) params.analystId = analystId;
    if (userRole) params.userRole = userRole;
    if (unreadOnly) params.unreadOnly = unreadOnly;

    const response = await apiClient.get('/notifications', { params });
    return response.data as any[];
  },

  markNotificationRead: async (id: string): Promise<void> => {
    await apiClient.put(`/notifications/${id}/read`);
  },

  markAllNotificationsRead: async (userId?: string, analystId?: string, userRole?: string): Promise<void> => {
    await apiClient.put('/notifications/read-all', { userId, analystId, userRole });
  },

  deleteAllNotifications: async (userId?: string, analystId?: string, userRole?: string): Promise<void> => {
    // Axios DELETE with data/body
    await apiClient.delete('/notifications/all', { data: { userId, analystId, userRole } } as any);
  },

  deleteNotification: async (id: string): Promise<void> => {
    await apiClient.delete(`/notifications/${id}`);
  },

  // Scheduling Constraints
  getConstraints: async (analystId?: string): Promise<SchedulingConstraint[]> => {
    const params = analystId ? { analystId } : {};
    const response = await apiClient.get('/constraints', { params });
    return response.data as SchedulingConstraint[];
  },

  createConstraint: async (data: { analystId?: string; shiftType?: string; startDate: string; endDate: string; constraintType: 'BLACKOUT_DATE' | 'MAX_SCREENER_DAYS' | 'MIN_SCREENER_DAYS' | 'PREFERRED_SCREENER' | 'UNAVAILABLE_SCREENER'; description?: string; isActive?: boolean }): Promise<SchedulingConstraint> => {
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

  // Schedules (region-scoped via interceptor)
  getSchedules: async (startDate: string, endDate: string): Promise<Schedule[]> => {
    const response = await apiClient.get('/schedules', { params: { startDate, endDate } });
    return response.data as Schedule[];
  },

  // Schedules (global - bypasses region interceptor, fetches ALL regions)
  getSchedulesGlobal: async (startDate: string, endDate: string): Promise<Schedule[]> => {
    const response = await apiClient.get('/schedules', {
      params: { startDate, endDate },
      headers: { 'x-region-id': '' } // Bypass region interceptor
    });
    return response.data as Schedule[];
  },

  getSchedule: async (id: string): Promise<Schedule> => {
    const response = await apiClient.get(`/schedules/${id}`);
    return response.data as Schedule;
  },

  createSchedule: async (data: { analystId: string; date: string; shiftType: string; isScreener: boolean }): Promise<Schedule> => {
    const response = await apiClient.post('/schedules', data);
    return response.data as Schedule;
  },

  updateSchedule: async (id: string, data: { analystId?: string; date?: string; shiftType?: string; isScreener?: boolean }): Promise<Schedule> => {
    // Fix for potential ID corruption (e.g. :1 suffix)
    const cleanId = id.includes(':') ? id.split(':')[0] : id;
    console.log(`apiService.updateSchedule called with id: ${id} -> cleaned to ${cleanId}`, data);
    const response = await apiClient.put(`/schedules/${cleanId}`, data);
    return response.data as Schedule;
  },

  deleteSchedule: async (id: string): Promise<void> => {
    const cleanId = id.includes(':') ? id.split(':')[0] : id;
    console.log(`apiService.deleteSchedule called with id: ${id} -> cleaned to ${cleanId}`);
    await apiClient.delete(`/schedules/${cleanId}`);
  },

  validateSchedule: async (data: { analystId: string; date: string; shiftType: string; isScreener?: boolean; scheduleId?: string }): Promise<{ isValid: boolean; violations: any[] }> => {
    const response = await apiClient.post('/schedules/validate', data);
    return response.data as { isValid: boolean; violations: any[] };
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

  createBulkSchedules: async (schedules: Array<{ analystId: string; date: string; shiftType: string; isScreener?: boolean }>): Promise<{ message: string; count: number }> => {
    const response = await apiClient.post('/schedules/bulk', { schedules });
    return response.data as { message: string; count: number };
  },

  // MVP Schedule Generation (New Implementation)
  generateSchedule: async (data: { startDate: string; endDate: string; algorithm?: string }): Promise<{
    message: string;
    result: {
      proposedSchedules: Array<{
        date: string;
        analystId: string;
        analystName: string;
        shiftType: string;
        isScreener: boolean;
        type: 'NEW_SCHEDULE';
      }>;
      conflicts: Array<{
        date: string;
        type: string;
        description: string;
        severity: string;
      }>;
      fairnessMetrics: {
        workloadDistribution: {
          standardDeviation: number;
          giniCoefficient: number;
          maxMinRatio: number;
        };
        screenerDistribution: {
          standardDeviation: number;
          maxMinRatio: number;
          fairnessScore: number;
          recommendations: string[];
        };
        weekendDistribution: {
          standardDeviation: number;
          maxMinRatio: number;
          fairnessScore: number;
        };
        overallFairnessScore: number;
        recommendations: string[];
      };
    };
  }> => {
    const response = await apiClient.post('/schedules/generate', data);
    return response.data as any;
  },

  // Legacy Automated Scheduling (for compatibility)
  generateSchedulePreview: async (data: { startDate: string; endDate: string; shiftType?: string; algorithmType?: string }): Promise<SchedulePreview> => {
    const response = await apiClient.post('/algorithms/generate-preview', data);
    return response.data as SchedulePreview;
  },

  applyAutomatedSchedule: async (data: { startDate: string; endDate: string; shiftType?: string; algorithmType?: string; overwriteExisting?: boolean }): Promise<ScheduleResult> => {
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

  // ML Services
  getWorkloadPrediction: async (date: string): Promise<any> => {
    const response = await apiClient.get(`/ml/workload-prediction/${date}`);
    return (response.data as any).data;
  },

  getBurnoutRiskAssessment: async (): Promise<any> => {
    const response = await apiClient.get('/ml/burnout-risk');
    return (response.data as any).data;
  },

  getOptimalAssignment: async (date: string, shiftType: string): Promise<any> => {
    const response = await apiClient.get('/ml/optimal-assignment', {
      params: { date, shiftType }
    });
    return (response.data as any).data;
  },

  getDemandForecast: async (period: 'WEEK' | 'MONTH'): Promise<any> => {
    const response = await apiClient.get(`/ml/demand-forecast/${period}`);
    return (response.data as any).data;
  },

  // Shift Definitions
  getShiftDefinitions: async (regionId?: string): Promise<any[]> => {
    const headers: any = {};
    if (regionId) {
      headers['x-region-id'] = regionId;
    }
    const response = await apiClient.get('/shift-definitions', { headers });
    return response.data as any[];
  },

  getConflictPrediction: async (startDate: string, endDate: string): Promise<any> => {
    const response = await apiClient.get('/ml/conflict-prediction', {
      params: { startDate, endDate }
    });
    return (response.data as any).data;
  },

  getMLHealth: async (): Promise<any> => {
    const response = await apiClient.get('/ml/health');
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

  // Schedule Generation Logging
  getRecentActivity: async (limit: number = 10): Promise<ScheduleGenerationLog[]> => {
    const response = await apiClient.get(`/algorithms/recent-activity?limit=${limit}`);
    return response.data as ScheduleGenerationLog[];
  },

  // Activity Management
  getRecentActivities: async (limit: number = 10): Promise<Activity[]> => {
    const response = await apiClient.get(`/activities/recent?limit=${limit}`);
    return response.data as Activity[];
  },

  getActivities: async (filters?: {
    category?: string;
    type?: string;
    performedBy?: string;
    impact?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<Activity[]> => {
    const params = new URLSearchParams();
    if (filters?.category) params.append('category', filters.category);
    if (filters?.type) params.append('type', filters.type);
    if (filters?.performedBy) params.append('performedBy', filters.performedBy);
    if (filters?.impact) params.append('impact', filters.impact);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await apiClient.get(`/activities?${params.toString()}`);
    return response.data as Activity[];
  },

  getActivityStats: async (days: number = 30): Promise<{
    totalActivities: number;
    activitiesByCategory: Record<string, number>;
    activitiesByImpact: Record<string, number>;
    mostActiveUser: string | null;
    recentActivityTrend: Array<{ date: string; count: number }>;
  }> => {
    const response = await apiClient.get(`/activities/stats?days=${days}`);
    return response.data as {
      totalActivities: number;
      activitiesByCategory: Record<string, number>;
      activitiesByImpact: Record<string, number>;
      mostActiveUser: string | null;
      recentActivityTrend: Array<{ date: string; count: number }>;
    };
  },

  getGenerationStats: async (days: number = 30): Promise<GenerationStats> => {
    const response = await apiClient.get(`/algorithms/generation-stats?days=${days}`);
    return response.data as GenerationStats;
  },

  // Fairness Metrics
  getFairnessMetrics: async (startDate: string, endDate: string): Promise<FairnessReport> => {
    const response = await apiClient.get(`/algorithms/fairness-metrics`, {
      params: { startDate, endDate }
    });
    return response.data as FairnessReport;
  },

  // Holidays
  getHolidays: async (year?: number, timezone?: string, isActive?: boolean): Promise<any[]> => {
    const params: any = {};
    if (year) params.year = year;
    if (timezone) params.timezone = timezone;
    if (isActive !== undefined) params.isActive = isActive;

    const response = await apiClient.get('/holidays', { params });
    return response.data as any[];
  },

  getHoliday: async (id: string): Promise<any> => {
    const response = await apiClient.get(`/holidays/${id}`);
    return response.data as any;
  },

  createHoliday: async (data: { name: string; date: string; timezone?: string; isRecurring?: boolean; year?: number; description?: string; isActive?: boolean }): Promise<any> => {
    const response = await apiClient.post('/holidays', data);
    return response.data as any;
  },

  updateHoliday: async (id: string, data: { name?: string; date?: string; timezone?: string; isRecurring?: boolean; year?: number; description?: string; isActive?: boolean }): Promise<any> => {
    const response = await apiClient.put(`/holidays/${id}`, data);
    return response.data as any;
  },

  deleteHoliday: async (id: string): Promise<void> => {
    await apiClient.delete(`/holidays/${id}`);
  },

  getHolidaysForYear: async (year: number, timezone?: string): Promise<any[]> => {
    const params = timezone ? { timezone } : {};
    const response = await apiClient.get(`/holidays/year/${year}`, { params });
    return response.data as any[];
  },

  initializeDefaultHolidays: async (year: number, timezone?: string, regionId?: string): Promise<any> => {
    const response = await apiClient.post('/holidays/initialize-defaults', {
      year,
      timezone: timezone || 'America/New_York',
      regionId
    });
    return response.data as any;
  },



  // Absences
  getAbsences: async (analystId?: string, type?: string, isApproved?: boolean, isPlanned?: boolean, startDate?: string, endDate?: string, status?: string): Promise<any[]> => {
    const params: any = {};
    if (analystId) params.analystId = analystId;
    if (type) params.type = type;
    if (isApproved !== undefined) params.isApproved = isApproved;
    if (isPlanned !== undefined) params.isPlanned = isPlanned;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (status) params.status = status;

    const response = await apiClient.get('/absences', { params });
    return response.data as any[];
  },

  getAbsence: async (id: string): Promise<any> => {
    const response = await apiClient.get(`/absences/${id}`);
    return response.data as any;
  },

  createAbsence: async (data: { analystId: string; startDate: string; endDate: string; type: string; reason?: string; isApproved?: boolean; isPlanned?: boolean }): Promise<any> => {
    const response = await apiClient.post('/absences', data);
    return response.data as any;
  },

  updateAbsence: async (id: string, data: { startDate?: string; endDate?: string; type?: string; reason?: string; isApproved?: boolean; isPlanned?: boolean }): Promise<any> => {
    const response = await apiClient.put(`/absences/${id}`, data);
    return response.data as any;
  },

  deleteAbsence: async (id: string): Promise<void> => {
    await apiClient.delete(`/absences/${id}`);
  },

  getAnalystAbsences: async (analystId: string, startDate?: string, endDate?: string): Promise<any[]> => {
    const params: any = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    const response = await apiClient.get(`/absences/analyst/${analystId}`, { params });
    return response.data as any[];
  },

  approveAbsence: async (id: string, isApproved: boolean): Promise<any> => {
    const response = await apiClient.patch(`/absences/${id}/approve`, { isApproved });
    return response.data as any;
  },

  // Schedule Snapshot
  getScheduleSnapshot: async (): Promise<{
    todaysScreeners: {
      MORNING: string[];
      EVENING: string[];
      WEEKEND: string[];
    };
    upcomingHoliday: {
      name: string;
      date: string;
      daysUntil: number;
    } | null;
    todaysCoverage: {
      counts: {
        MORNING: number;
        EVENING: number;
        WEEKEND: number;
      };
      status: {
        MORNING: 'LOW' | 'MEDIUM' | 'HIGH';
        EVENING: 'LOW' | 'MEDIUM' | 'HIGH';
        WEEKEND: 'LOW' | 'MEDIUM' | 'HIGH';
      };
    };
  }> => {
    const response = await apiClient.get('/schedule-snapshot');
    return response.data as {
      todaysScreeners: {
        MORNING: string[];
        EVENING: string[];
        WEEKEND: string[];
      };
      upcomingHoliday: {
        name: string;
        date: string;
        daysUntil: number;
      } | null;
      todaysCoverage: {
        counts: {
          MORNING: number;
          EVENING: number;
          WEEKEND: number;
        };
        status: {
          MORNING: 'LOW' | 'MEDIUM' | 'HIGH';
          EVENING: 'LOW' | 'MEDIUM' | 'HIGH';
          WEEKEND: 'LOW' | 'MEDIUM' | 'HIGH';
        };
      };
    };
  },
  // Shift Swaps
  createSwapRequest: async (data: { requestingShiftDate: string; targetAnalystId?: string; targetShiftDate?: string; isBroadcast?: boolean; parentId?: string }): Promise<ShiftSwap> => {
    const response = await apiClient.post('/shift-swaps', data);
    return response.data as ShiftSwap;
  },

  getMySwaps: async (): Promise<{ incoming: ShiftSwap[]; outgoing: ShiftSwap[]; history: ShiftSwap[] }> => {
    const response = await apiClient.get('/shift-swaps/mine');
    return response.data as { incoming: ShiftSwap[]; outgoing: ShiftSwap[]; history: ShiftSwap[] };
  },

  getBroadcasts: async (): Promise<ShiftSwap[]> => {
    const response = await apiClient.get('/shift-swaps/broadcasts');
    return response.data as ShiftSwap[];
  },

  approveSwap: async (id: string): Promise<ShiftSwap> => {
    const response = await apiClient.post(`/shift-swaps/${id}/approve`);
    return response.data as ShiftSwap;
  },
};

// Shift Swap Types
export interface ShiftSwap {
  id: string;
  requestingAnalystId: string;
  requestingShiftDate: string;
  targetAnalystId?: string;
  targetShiftDate?: string;
  isBroadcast: boolean;
  status: 'PENDING_PARTNER' | 'OPEN' | 'COMPLETED' | 'CANCELLED';
  parentId?: string;
  createdAt: string;
  updatedAt: string;
  requestingAnalyst?: Analyst;
  targetAnalyst?: Analyst;
  parent?: ShiftSwap;
  offers?: ShiftSwap[];
}

export default apiService; 