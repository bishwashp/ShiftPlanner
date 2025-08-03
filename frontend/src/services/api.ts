import axios from 'axios';
import moment from 'moment-timezone';

// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

// Request cache for reducing duplicate API calls
const requestCache = new Map<string, { data: any; timestamp: number; ttl: number }>();

// Debounce utility
const debounce = (func: Function, wait: number) => {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Cache utility
const getCachedData = (key: string, ttl: number = 30000): any | null => {
  const cached = requestCache.get(key);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }
  return null;
};

const setCachedData = (key: string, data: any, ttl: number = 30000): void => {
  requestCache.set(key, {
    data,
    timestamp: Date.now(),
    ttl
  });
};

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
    
    // Handle rate limiting specifically
    if (error.response?.status === 429) {
      const retryAfter = error.response.data?.retryAfter || 15;
      console.warn(`Rate limit exceeded. Retry after ${retryAfter} seconds.`);
      
      // Show user-friendly message
      if (typeof window !== 'undefined') {
        // You could dispatch a notification here
        console.warn('Rate limit exceeded. Please wait a moment before trying again.');
      }
    }
    
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

// Phase 3: Predictive Fairness & Advanced Analytics Interfaces
export interface LeaveRequestImpact {
  requestId: string;
  analystId: string;
  startDate: string;
  endDate: string;
  fairnessImpact: {
    beforeScore: number;
    afterScore: number;
    change: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  recommendations: string[];
  alternativeDates?: string[];
  metadata?: any;
}

export interface FairnessTrend {
  currentScore: number;
  predictedScore: number;
  trend: 'IMPROVING' | 'STABLE' | 'DETERIORATING';
  confidence: number;
  riskFactors: string[];
  mitigationStrategies: string[];
  timeRange: {
    startDate: string;
    endDate: string;
  };
}

export interface FairnessRecommendation {
  id: string;
  type: 'WORKLOAD_BALANCE' | 'WEEKEND_ROTATION' | 'SCREENER_DISTRIBUTION' | 'CONSECUTIVE_DAYS';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  expectedImprovement: number;
  confidence: number;
  affectedAnalysts: string[];
  suggestedActions: string[];
}

export interface FairnessAnomaly {
  id: string;
  type: 'UNUSUAL_WORKLOAD' | 'WEEKEND_IMBALANCE' | 'SCREENER_OVERLOAD' | 'FAIRNESS_DROP';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  detectedAt: string;
  affectedAnalysts: string[];
  impact: number;
  recommendations: string[];
}

export interface KPIMetrics {
  scheduleSuccessRate: number;
  averageFairnessScore: number;
  constraintViolationRate: number;
  userSatisfactionScore: number;
  conflictResolutionTime: number;
  lastUpdated: string;
  trend: 'IMPROVING' | 'STABLE' | 'DETERIORATING';
}

export interface KPIReport {
  timeRange: {
    startDate: string;
    endDate: string;
  };
  metrics: KPIMetrics;
  trends: {
    scheduleSuccess: 'IMPROVING' | 'STABLE' | 'DETERIORATING';
    fairness: 'IMPROVING' | 'STABLE' | 'DETERIORATING';
    violations: 'IMPROVING' | 'STABLE' | 'DETERIORATING';
    satisfaction: 'IMPROVING' | 'STABLE' | 'DETERIORATING';
    resolutionTime: 'IMPROVING' | 'STABLE' | 'DETERIORATING';
  };
  alerts: string[];
  recommendations: string[];
}

export interface BenchmarkComparison {
  metric: string;
  currentValue: number;
  industryAverage: number;
  percentile: number;
  status: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'BELOW_AVERAGE' | 'POOR';
  improvement: number;
}

export interface ExecutiveDashboard {
  kpiReport: KPIReport;
  fairnessTrend: FairnessTrend;
  benchmarks: BenchmarkComparison[];
  summary: {
    overallHealth: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'POOR';
    keyInsights: string[];
    recommendations: string[];
  };
}

export interface ManagerDashboard {
  teamId: string;
  fairnessTrend: FairnessTrend;
  recommendations: FairnessRecommendation[];
  workloadAnalysis: {
    totalAnalysts: number;
    averageWorkload: number;
    workloadDistribution: string;
  };
}

export interface AnalystDashboard {
  analystId: string;
  analystName: string;
  personalMetrics: {
    totalShifts: number;
    screenerShifts: number;
    weekendShifts: number;
    fairnessScore: number;
  };
  upcomingSchedule: Schedule[];
  recommendations: string[];
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

  // Real-time constraint validation
  validateConstraintRealTime: async (data: {
    constraint: Partial<SchedulingConstraint>;
    operation?: 'CREATE' | 'UPDATE' | 'DELETE';
    originalConstraint?: SchedulingConstraint;
  }): Promise<{
    isValid: boolean;
    warnings: Array<{
      type: 'OVERLAP' | 'FAIRNESS' | 'COVERAGE' | 'OPTIMIZATION';
      message: string;
      details?: any;
    }>;
    errors: Array<{
      type: 'CONFLICT' | 'INVALID_DATE' | 'INVALID_ANALYST' | 'LOGIC_ERROR';
      message: string;
      field?: string;
      details?: any;
    }>;
    suggestions: string[];
    estimatedImpact: {
      severity: 'LOW' | 'MEDIUM' | 'HIGH';
      affectedDays: number;
      affectedSchedules: number;
      conflictProbability: number;
    };
    responseTime: number;
  }> => {
    const response = await apiClient.post('/constraints/validate-realtime', data);
    return response.data as {
      isValid: boolean;
      warnings: Array<{
        type: 'OVERLAP' | 'FAIRNESS' | 'COVERAGE' | 'OPTIMIZATION';
        message: string;
        details?: any;
      }>;
      errors: Array<{
        type: 'CONFLICT' | 'INVALID_DATE' | 'INVALID_ANALYST' | 'LOGIC_ERROR';
        message: string;
        field?: string;
        details?: any;
      }>;
      suggestions: string[];
      estimatedImpact: {
        severity: 'LOW' | 'MEDIUM' | 'HIGH';
        affectedDays: number;
        affectedSchedules: number;
        conflictProbability: number;
      };
      responseTime: number;
    };
  },

  // Comprehensive constraint validation
  validateConstraint: async (data: {
    constraint: Partial<SchedulingConstraint>;
    dateRange: { startDate: string; endDate: string };
  }): Promise<{
    isValid: boolean;
    preview: {
      estimatedImpact: 'LOW' | 'MEDIUM' | 'HIGH';
      affectedDaysCount: number;
      estimatedConflicts: number;
      message: string;
    };
    impact: {
      conflictCount: number;
      affectedDays: number;
      affectedAnalysts: number;
      recommendations: string[];
    };
  }> => {
    const response = await apiClient.post('/constraints/validate', data);
    return response.data as {
      isValid: boolean;
      preview: {
        estimatedImpact: 'LOW' | 'MEDIUM' | 'HIGH';
        affectedDaysCount: number;
        estimatedConflicts: number;
        message: string;
      };
      impact: {
        conflictCount: number;
        affectedDays: number;
        affectedAnalysts: number;
        recommendations: string[];
      };
    };
  },

  // Constraint impact preview
  getConstraintImpactPreview: async (data: {
    constraintChange: {
      type: 'CREATE' | 'UPDATE' | 'DELETE';
      constraint: Partial<SchedulingConstraint>;
      originalConstraint?: SchedulingConstraint;
    };
  }): Promise<{
    estimatedImpact: 'LOW' | 'MEDIUM' | 'HIGH';
    affectedDaysCount: number;
    estimatedConflicts: number;
    message: string;
  }> => {
    const response = await apiClient.post('/constraints/impact-preview', data);
    return response.data as {
      estimatedImpact: 'LOW' | 'MEDIUM' | 'HIGH';
      affectedDaysCount: number;
      estimatedConflicts: number;
      message: string;
    };
  },

  // Full constraint impact simulation
  simulateConstraintImpact: async (data: {
    constraintChange: {
      type: 'CREATE' | 'UPDATE' | 'DELETE';
      constraint: Partial<SchedulingConstraint>;
      originalConstraint?: SchedulingConstraint;
    };
    dateRange: { startDate: string; endDate: string };
    algorithmConfig?: any;
    includeReschedule?: boolean;
  }): Promise<{
    affectedDates: string[];
    affectedAnalysts: string[];
    scheduleChanges: {
      before: Schedule[];
      after: Schedule[];
      conflicts: Array<{
        date: string;
        message: string;
        severity: 'HIGH' | 'MEDIUM' | 'LOW';
        analystId?: string;
      }>;
    };
    fairnessImpact: {
      before: number;
      after: number;
      change: number;
    };
    coverageImpact: {
      gapsIntroduced: number;
      gapsResolved: number;
      netCoverageChange: number;
    };
    recommendations: string[];
  }> => {
    const response = await apiClient.post('/constraints/impact-simulation', data);
    return response.data as {
      affectedDates: string[];
      affectedAnalysts: string[];
      scheduleChanges: {
        before: Schedule[];
        after: Schedule[];
        conflicts: Array<{
          date: string;
          message: string;
          severity: 'LOW' | 'MEDIUM' | 'HIGH';
          analystId?: string;
        }>;
      };
      fairnessImpact: {
        before: number;
        after: number;
        change: number;
      };
      coverageImpact: {
        gapsIntroduced: number;
        gapsResolved: number;
        netCoverageChange: number;
      };
      recommendations: string[];
    };
  },

  // What-if scenario modeling
  analyzeScenario: async (data: {
    name: string;
    description?: string;
    changes: Array<{
      type: 'CREATE' | 'UPDATE' | 'DELETE';
      constraint: Partial<SchedulingConstraint>;
      originalConstraint?: SchedulingConstraint;
    }>;
    dateRange: { startDate: string; endDate: string };
    includeReschedule?: boolean;
    includePredictions?: boolean;
  }): Promise<any> => {
    const response = await apiClient.post('/constraints/scenario/analyze', data);
    return response.data;
  },

  compareScenarios: async (data: {
    scenarios: Array<{
      name: string;
      description?: string;
      changes: Array<{
        type: 'CREATE' | 'UPDATE' | 'DELETE';
        constraint: Partial<SchedulingConstraint>;
        originalConstraint?: SchedulingConstraint;
      }>;
      dateRange: { startDate: string; endDate: string };
    }>;
  }): Promise<any> => {
    const response = await apiClient.post('/constraints/scenario/compare', data);
    return response.data;
  },

  testIncrementalChanges: async (data: {
    name: string;
    changes: Array<{
      type: 'CREATE' | 'UPDATE' | 'DELETE';
      constraint: Partial<SchedulingConstraint>;
      originalConstraint?: SchedulingConstraint;
    }>;
    dateRange: { startDate: string; endDate: string };
  }): Promise<any> => {
    const response = await apiClient.post('/constraints/scenario/incremental', data);
    return response.data;
  },

  simulateRollback: async (data: {
    currentConstraints: SchedulingConstraint[];
    changes: Array<{
      type: 'CREATE' | 'UPDATE' | 'DELETE';
      constraint: Partial<SchedulingConstraint>;
      originalConstraint?: SchedulingConstraint;
    }>;
  }): Promise<any> => {
    const response = await apiClient.post('/constraints/scenario/rollback', data);
    return response.data;
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

  // Automated Scheduling
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
  getWorkDayTally: async (month: number, year: number): Promise<Array<{ analystId: string; analystName: string; workDays: number }>> => {
    const response = await apiClient.get('/analytics/tally', { params: { month, year } });
    return response.data as Array<{ analystId: string; analystName: string; workDays: number }>;
  },

  // Phase 3: Predictive Fairness & Advanced Analytics API Methods

  // Phase 3: Predictive Fairness & Advanced Analytics API Methods
  calculateLeaveRequestImpact: async (data: { analystId: string; startDate: string; endDate: string; reason?: string }): Promise<LeaveRequestImpact> => {
    const response = await apiClient.post('/api/analytics/leave-request-impact', data);
    return (response.data as any).data as LeaveRequestImpact;
  },

  getFairnessTrends: async (startDate: string, endDate: string): Promise<FairnessTrend> => {
    const response = await apiClient.get('/analytics/fairness-trends', { params: { startDate, endDate } });
    return response.data as FairnessTrend;
  },

  getFairnessRecommendations: async (): Promise<FairnessRecommendation[]> => {
    const response = await apiClient.get('/analytics/fairness-recommendations');
    return response.data as FairnessRecommendation[];
  },

  getFairnessAnomalies: async (): Promise<FairnessAnomaly[]> => {
    const response = await apiClient.get('/analytics/fairness-anomalies');
    return response.data as FairnessAnomaly[];
  },

  getCurrentKPIMetrics: async (): Promise<KPIMetrics> => {
    const response = await apiClient.get('/analytics/kpi/current');
    return response.data as KPIMetrics;
  },

  getKPIHistory: async (startDate: string, endDate: string): Promise<KPIReport> => {
    const response = await apiClient.get('/analytics/kpi/history', { params: { startDate, endDate } });
    return response.data as KPIReport;
  },

  getKPISummary: async (): Promise<{
    currentMetrics: KPIMetrics;
    trends: 'IMPROVING' | 'STABLE' | 'DETERIORATING';
    alerts: string[];
    benchmarks: BenchmarkComparison[];
    performanceHealth: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'POOR';
  }> => {
    const response = await apiClient.get('/api/analytics/kpi/summary');
    return (response.data as any).data as {
      currentMetrics: KPIMetrics;
      trends: 'IMPROVING' | 'STABLE' | 'DETERIORATING';
      alerts: string[];
      benchmarks: BenchmarkComparison[];
      performanceHealth: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'POOR';
    };
  },

  getKPITrends: async (): Promise<{
    scheduleSuccess: { date: string; value: number }[];
    fairness: { date: string; value: number }[];
    violations: { date: string; value: number }[];
    satisfaction: { date: string; value: number }[];
    resolutionTime: { date: string; value: number }[];
  }> => {
    const response = await apiClient.get('/api/analytics/kpi/trends');
    return (response.data as any).data as {
      scheduleSuccess: { date: string; value: number }[];
      fairness: { date: string; value: number }[];
      violations: { date: string; value: number }[];
      satisfaction: { date: string; value: number }[];
      resolutionTime: { date: string; value: number }[];
    };
  },

  getKPIAlerts: async (): Promise<string[]> => {
    const response = await apiClient.get('/api/analytics/kpi/alerts');
    return (response.data as any).data as string[];
  },

  getBenchmarkComparison: async (): Promise<BenchmarkComparison[]> => {
    const response = await apiClient.get('/api/analytics/kpi/benchmarks');
    return (response.data as any).data as BenchmarkComparison[];
  },

  trackKPIMetric: async (type: 'schedule_generation' | 'fairness_score' | 'constraint_violation' | 'user_satisfaction', data: any): Promise<void> => {
    await apiClient.post('/analytics/kpi/track', { type, data });
  },

  getExecutiveDashboard: async (timeRange: 'week' | 'month' | 'quarter' = 'month'): Promise<ExecutiveDashboard> => {
    const response = await apiClient.get('/api/analytics/executive/dashboard', { params: { timeRange } });
    return (response.data as any).data as ExecutiveDashboard;
  },

  getManagerDashboard: async (teamId: string, timeRange: 'week' | 'month' = 'week'): Promise<ManagerDashboard> => {
    const response = await apiClient.get(`/api/analytics/manager/dashboard/${teamId}`, { params: { timeRange } });
    return (response.data as any).data as ManagerDashboard;
  },

  getAnalystDashboard: async (analystId: string, timeRange: 'week' | 'month' = 'month'): Promise<AnalystDashboard> => {
    const response = await apiClient.get(`/api/analytics/analyst/dashboard/${analystId}`, { params: { timeRange } });
    return (response.data as any).data as AnalystDashboard;
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
  applyAutoFix: async (data: { assignments: any[] }): Promise<{ message: string; created: number }> => {
    const response = await apiClient.post('/schedules/apply-auto-fix', data);
    return response.data as { message: string; created: number };
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

  // Early Warning System
  getWarnings: async (severity?: string): Promise<any> => {
    const params = severity ? { severity } : {};
    const response = await apiClient.get('/constraints/warnings', { params });
    return response.data;
  },

  getWarningMetrics: async (): Promise<any> => {
    const response = await apiClient.get('/constraints/warnings/metrics');
    return response.data;
  },

  performWarningCheck: async (): Promise<any> => {
    const response = await apiClient.post('/constraints/warnings/check');
    return response.data;
  },

  resolveWarning: async (warningId: string, resolvedBy: string, notes?: string): Promise<any> => {
    const response = await apiClient.post(`/constraints/warnings/${warningId}/resolve`, {
      resolvedBy,
      notes
    });
    return response.data;
  },

  updateWarningConfig: async (config: any): Promise<any> => {
    const response = await apiClient.put('/constraints/warnings/config', config);
    return response.data;
  },

  // Risk Assessment & Conflict Probability
  getUpcomingRisks: async (days: number = 30): Promise<any> => {
    const response = await apiClient.get('/constraints/risk-assessment/upcoming', {
      params: { days }
    });
    return response.data;
  },

  calculateDateRisk: async (date: string): Promise<any> => {
    const response = await apiClient.get(`/constraints/risk-assessment/date/${date}`);
    return response.data;
  },

  calculateRangeRisk: async (startDate: string, endDate: string): Promise<any> => {
    const response = await apiClient.post('/constraints/risk-assessment/range', {
      startDate,
      endDate
    });
    return response.data;
  },

  getRiskFactors: async (): Promise<any> => {
    const response = await apiClient.get('/constraints/risk-assessment/factors');
    return response.data;
  },

  updateRiskConfig: async (config: any): Promise<any> => {
    const response = await apiClient.put('/constraints/risk-assessment/config', config);
    return response.data;
  },

  clearRiskCache: async (): Promise<any> => {
    const response = await apiClient.post('/constraints/risk-assessment/clear-cache');
    return response.data;
  },

  // Event Management
  getEvents: async (days: number = 30): Promise<any> => {
    const response = await apiClient.get('/constraints/events', { params: { days } });
    return response.data;
  },

  getEventDefinitions: async (): Promise<any> => {
    const response = await apiClient.get('/constraints/events/definitions');
    return response.data;
  },

  createEventDefinition: async (definition: any): Promise<any> => {
    const response = await apiClient.post('/constraints/events/definitions', definition);
    return response.data;
  },

  updateEventDefinition: async (id: string, updates: any): Promise<any> => {
    const response = await apiClient.put(`/constraints/events/definitions/${id}`, updates);
    return response.data;
  },

  deleteEventDefinition: async (id: string): Promise<any> => {
    const response = await apiClient.delete(`/constraints/events/definitions/${id}`);
    return response.data;
  },

  generateEventInstances: async (startDate: string, endDate: string): Promise<any> => {
    const response = await apiClient.post('/constraints/events/generate', {
      startDate,
      endDate
    });
    return response.data;
  },

  applyEventConstraints: async (): Promise<any> => {
    const response = await apiClient.post('/constraints/events/apply-constraints');
    return response.data;
  },

  getHolidays: async (startDate: string, endDate: string): Promise<any> => {
    const response = await apiClient.get('/constraints/events/holidays', {
      params: { startDate, endDate }
    });
    return response.data;
  },

  getEventsForDate: async (date: string): Promise<any> => {
    const response = await apiClient.get(`/constraints/events/date/${date}`);
    return response.data;
  },

  getEventStats: async (): Promise<any> => {
    const response = await apiClient.get('/constraints/events/stats');
    return response.data;
  },

  // Template Management
  getTemplates: async (filters?: any): Promise<any> => {
    const response = await apiClient.get('/constraints/templates', { params: filters });
    return response.data;
  },

  getTemplate: async (id: string): Promise<any> => {
    const response = await apiClient.get(`/constraints/templates/${id}`);
    return response.data;
  },

  createTemplate: async (template: any): Promise<any> => {
    const response = await apiClient.post('/constraints/templates', template);
    return response.data;
  },

  updateTemplate: async (id: string, updates: any): Promise<any> => {
    const response = await apiClient.put(`/constraints/templates/${id}`, updates);
    return response.data;
  },

  deleteTemplate: async (id: string): Promise<any> => {
    const response = await apiClient.delete(`/constraints/templates/${id}`);
    return response.data;
  },

  applyTemplate: async (id: string, application: any): Promise<any> => {
    const response = await apiClient.post(`/constraints/templates/${id}/apply`, application);
    return response.data;
  },

  getTemplateCategories: async (): Promise<any> => {
    const response = await apiClient.get('/constraints/templates/categories/stats');
    return response.data;
  },

  getPopularTemplates: async (limit: number = 10): Promise<any> => {
    const response = await apiClient.get(`/constraints/templates/popular/${limit}`);
    return response.data;
  },

  getTopRatedTemplates: async (limit: number = 10): Promise<any> => {
    const response = await apiClient.get(`/constraints/templates/top-rated/${limit}`);
    return response.data;
  },

  searchTemplates: async (query: string): Promise<any> => {
    const response = await apiClient.get(`/constraints/templates/search/${encodeURIComponent(query)}`);
    return response.data;
  },

  getTemplateLibraryStats: async (): Promise<any> => {
    const response = await apiClient.get('/constraints/templates/stats/library');
    return response.data;
  },

  createTemplateFromConstraints: async (constraintIds: string[], templateData: any): Promise<any> => {
    const response = await apiClient.post('/constraints/templates/create-from-constraints', {
      constraintIds,
      templateData
    });
    return response.data;
  },

  // Calendar Layer Management
  getCalendarLayers: async (startDate: string, endDate: string): Promise<any> => {
    const cacheKey = `calendar_layers_${startDate}_${endDate}`;
    const cached = getCachedData(cacheKey, 60000); // 1 minute cache
    if (cached) return cached;

    const response = await apiClient.get('/calendar/layers', {
      params: { startDate, endDate }
    });
    setCachedData(cacheKey, response.data, 60000);
    return response.data;
  },

  getLayerData: async (layerId: string, startDate: string, endDate: string): Promise<any> => {
    const cacheKey = `layer_data_${layerId}_${startDate}_${endDate}`;
    const cached = getCachedData(cacheKey, 30000); // 30 second cache
    if (cached) return cached;

    const response = await apiClient.get(`/calendar/layers/${layerId}/data`, {
      params: { startDate, endDate }
    });
    setCachedData(cacheKey, response.data, 30000);
    return response.data;
  },

  toggleLayer: async (layerId: string, enabled: boolean): Promise<any> => {
    const response = await apiClient.post(`/calendar/layers/${layerId}/toggle`, { enabled });
    return response.data;
  },

  updateLayerPreferences: async (layerId: string, preferences: any): Promise<any> => {
    const response = await apiClient.put('/calendar/layers/preferences', {
      layerId,
      ...preferences
    });
    return response.data;
  },

  getLayerConflicts: async (startDate: string, endDate: string): Promise<any> => {
    const response = await apiClient.get('/calendar/layers/conflicts', {
      params: { startDate, endDate }
    });
    return response.data;
  },

  resetLayerPreferences: async (): Promise<any> => {
    const response = await apiClient.post('/calendar/layers/reset');
    return response.data;
  },

  getViewData: async (viewType: string, date: string, layers?: string[]): Promise<any> => {
    const params: any = { date };
    if (layers) {
      params.layers = layers.join(',');
    }
    const response = await apiClient.get(`/calendar/view/${viewType}`, { params });
    return response.data;
  },

  saveViewPreferences: async (preferences: any): Promise<any> => {
    const response = await apiClient.put('/calendar/view/preferences', preferences);
    return response.data;
  },

  getViewPreferences: async (viewType: string): Promise<any> => {
    const response = await apiClient.get(`/calendar/view/${viewType}/preferences`);
    return response.data;
  },
};

export default apiService; 