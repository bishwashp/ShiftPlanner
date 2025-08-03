import { gql } from 'graphql-tag';

export const typeDefs = gql`
  # Scalar types
  scalar DateTime
  scalar JSON

  # Enums
  enum ShiftType {
    MORNING
    EVENING
    WEEKEND
  }

  enum SchedulingConflictType {
    BLACKOUT_DATE
    INSUFFICIENT_STAFF
    CONSTRAINT_VIOLATION
    FAIRNESS_VIOLATION
  }

  enum ConflictSeverity {
    LOW
    MEDIUM
    HIGH
    CRITICAL
  }

  enum OptimizationStrategy {
    GREEDY
    HILL_CLIMBING
    SIMULATED_ANNEALING
    GENETIC
  }

  enum ScreenerAssignmentStrategy {
    ROUND_ROBIN
    EXPERIENCE_BASED
    WORKLOAD_BALANCE
    SKILL_BASED
  }

  enum WeekendRotationStrategy {
    SEQUENTIAL
    FAIRNESS_OPTIMIZED
    CONSTRAINT_AWARE
  }

  # Core Types
  type Analyst {
    id: ID!
    name: String!
    email: String!
    shiftType: ShiftType!
    isActive: Boolean!
    customAttributes: JSON
    skills: [String!]!
    createdAt: DateTime!
    updatedAt: DateTime!
    
    # Relationships
    preferences: [AnalystPreference!]!
    schedules: [Schedule!]!
    vacations: [Vacation!]!
    constraints: [SchedulingConstraint!]!
    
    # Computed fields
    totalWorkDays: Int
    screenerDays: Int
    weekendDays: Int
    fairnessScore: Float
    workloadAnalysis: WorkloadAnalysis
  }

  type AnalystPreference {
    id: ID!
    analystId: ID!
    analyst: Analyst!
    preferredShifts: [ShiftType!]!
    blackoutDates: [DateTime!]!
    maxConsecutiveDays: Int
    preferredWeekendFrequency: Int
    skillLevel: String
    trainingCertifications: [String!]!
    performanceHistory: JSON
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Vacation {
    id: ID!
    analystId: ID!
    analyst: Analyst!
    startDate: DateTime!
    endDate: DateTime!
    reason: String
    isApproved: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type SchedulingConstraint {
    id: ID!
    analystId: ID
    analyst: Analyst
    constraintType: String!
    startDate: DateTime!
    endDate: DateTime!
    description: String
    isActive: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Schedule {
    id: ID!
    analystId: ID!
    analyst: Analyst!
    date: DateTime!
    shiftType: ShiftType!
    isScreener: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type AlgorithmConfig {
    id: ID!
    name: String!
    description: String
    config: JSON!
    isActive: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  # Enhanced Schedule Types
  type ProposedSchedule {
    date: String!
    analystId: ID!
    analystName: String!
    shiftType: ShiftType!
    isScreener: Boolean!
    type: String!
    assignmentReason: AssignmentReason
    fairnessScore: Float
    constraintSatisfaction: ConstraintSatisfaction
  }

  type AssignmentReason {
    primaryReason: String!
    secondaryFactors: [String!]!
    workWeight: Float!
    computationCost: String!
    confidence: Float!
  }

  type ConstraintSatisfaction {
    hardConstraints: HardConstraintValidation!
    softConstraints: SoftConstraintValidation!
    overallScore: Float!
  }

  type HardConstraintValidation {
    satisfied: Boolean!
    violations: [String!]!
  }

  type SoftConstraintValidation {
    score: Float!
    violations: [String!]!
  }

  type ScheduleOverwrite {
    date: String!
    analystId: ID!
    analystName: String!
    from: ScheduleChange!
    to: ScheduleChange!
    reason: String
  }

  type ScheduleChange {
    shiftType: String!
    isScreener: Boolean!
  }

  type SchedulingConflict {
    date: String!
    type: SchedulingConflictType!
    description: String!
    severity: ConflictSeverity!
    affectedAnalysts: [String!]
    suggestedResolution: String
  }

  # Fairness and Performance Metrics
  type FairnessMetrics {
    workloadDistribution: WorkloadDistribution!
    screenerDistribution: DistributionMetrics!
    weekendDistribution: DistributionMetrics!
    overallFairnessScore: Float!
    recommendations: [String!]!
  }

  type WorkloadDistribution {
    standardDeviation: Float!
    giniCoefficient: Float!
    maxMinRatio: Float!
  }

  type DistributionMetrics {
    standardDeviation: Float!
    maxMinRatio: Float!
    fairnessScore: Float!
  }

  type PerformanceMetrics {
    totalQueries: Int!
    averageQueryTime: Float!
    slowQueries: Int!
    cacheHitRate: Float!
    algorithmExecutionTime: Float!
    memoryUsage: Float!
    optimizationIterations: Int!
  }

  type CalendarExport {
    format: String!
    content: String!
    filename: String!
  }

  type WorkloadAnalysis {
    analystId: ID!
    analystName: String!
    totalWorkDays: Int!
    regularShiftDays: Int!
    screenerDays: Int!
    weekendDays: Int!
    consecutiveWorkDays: Int!
    averageWorkloadPerWeek: Float!
    fairnessScore: Float!
    recommendations: [String!]!
  }

  # Algorithm Configuration
  type AlgorithmConfiguration {
    fairnessWeight: Float!
    efficiencyWeight: Float!
    constraintWeight: Float!
    optimizationStrategy: OptimizationStrategy!
    maxIterations: Int!
    convergenceThreshold: Float!
    randomizationFactor: Float!
    screenerAssignmentStrategy: ScreenerAssignmentStrategy!
    weekendRotationStrategy: WeekendRotationStrategy!
  }

  # Schedule Generation Results
  type ScheduleGenerationResult {
    proposedSchedules: [ProposedSchedule!]!
    conflicts: [SchedulingConflict!]!
    overwrites: [ScheduleOverwrite!]!
    fairnessMetrics: FairnessMetrics!
    performanceMetrics: PerformanceMetrics!
  }

  type SchedulePreview {
    startDate: String!
    endDate: String!
    algorithmType: String!
    proposedSchedules: [ProposedSchedule!]!
    conflicts: [SchedulingConflict!]!
    overwrites: [ScheduleOverwrite!]!
    fairnessMetrics: FairnessMetrics
    performanceMetrics: PerformanceMetrics
    summary: ScheduleSummary!
  }

  type ScheduleSummary {
    totalDays: Int!
    totalSchedules: Int!
    newSchedules: Int!
    overwrittenSchedules: Int!
    conflicts: Int!
    fairnessScore: Float!
    executionTime: Int!
  }

  # Analytics Types
  type AnalyticsData {
    id: ID!
    analystId: ID!
    analyst: Analyst!
    startDate: DateTime!
    endDate: DateTime!
    totalWorkDays: Int!
    regularShiftDays: Int!
    screenerDays: Int!
    weekendDays: Int!
    consecutiveWorkDayStreaks: Int!
    fairnessScore: Float!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type MonthlyTally {
    analystId: ID!
    analystName: String!
    month: Int!
    year: Int!
    totalWorkDays: Int!
    regularShiftDays: Int!
    screenerDays: Int!
    weekendDays: Int!
    consecutiveWorkDayStreaks: Int!
    fairnessScore: Float!
  }

  type FairnessReport {
    dateRange: DateRange!
    overallFairnessScore: Float!
    workloadDistribution: WorkloadDistribution!
    screenerDistribution: DistributionMetrics!
    weekendDistribution: DistributionMetrics!
    individualScores: [IndividualScore!]!
    recommendations: [String!]!
  }

  type DateRange {
    startDate: DateTime!
    endDate: DateTime!
  }

  type WorkloadDistribution {
    standardDeviation: Float!
    giniCoefficient: Float!
    maxMinRatio: Float!
  }

  type DistributionMetrics {
    fairnessScore: Float!
    distribution: JSON!
  }

  type IndividualScore {
    analystId: ID!
    analystName: String!
    fairnessScore: Float!
    workload: Int!
    screenerDays: Int!
    weekendDays: Int!
  }

  type WorkloadPrediction {
    date: DateTime!
    predictedWorkload: Int!
    confidence: Float!
    factors: [String!]!
  }

  type OptimizationOpportunity {
    type: String!
    severity: ConflictSeverity!
    description: String!
    impact: Float!
    suggestedActions: [String!]!
    affectedAnalysts: [ID!]!
  }

  type StaffingPrediction {
    date: DateTime!
    predictedRequiredStaff: Int!
    confidence: Float!
    factors: [String!]!
    riskLevel: String!
  }

  type BurnoutAssessment {
    analystId: ID!
    analystName: String!
    riskLevel: String!
    riskScore: Float!
    factors: [String!]!
    recommendations: [String!]!
    lastAssessment: DateTime!
  }

  type RotationSuggestion {
    type: String!
    description: String!
    expectedImpact: Float!
    implementationSteps: [String!]!
    affectedAnalysts: [ID!]!
    priority: String!
  }

  type ConflictForecast {
    date: DateTime!
    probability: Float!
    conflictType: String!
    severity: ConflictSeverity!
    description: String!
    preventiveActions: [String!]!
  }

  type DashboardData {
    summary: DashboardSummary!
    fairnessMetrics: DashboardFairnessMetrics!
    workloadDistribution: DashboardWorkloadDistribution!
    recentActivity: [RecentActivity!]!
    alerts: [DashboardAlert!]!
    predictions: PredictionData!
    performanceMetrics: DashboardPerformanceMetrics!
  }

  type DashboardSummary {
    totalAnalysts: Int!
    activeAnalysts: Int!
    totalSchedules: Int!
    upcomingSchedules: Int!
    conflicts: Int!
    averageFairnessScore: Float!
  }

  type DashboardFairnessMetrics {
    overallScore: Float!
    workloadFairness: Float!
    screenerFairness: Float!
    weekendFairness: Float!
    trend: String!
  }

  type DashboardWorkloadDistribution {
    averageWorkload: Float!
    standardDeviation: Float!
    distribution: [WorkloadDistributionItem!]!
  }

  type WorkloadDistributionItem {
    analystName: String!
    workload: Int!
    fairnessScore: Float!
  }

  type RecentActivity {
    id: ID!
    type: String!
    description: String!
    timestamp: DateTime!
    analystName: String
    impact: String!
  }

  type DashboardAlert {
    id: ID!
    type: String!
    severity: ConflictSeverity!
    message: String!
    timestamp: DateTime!
    actionable: Boolean!
    suggestedActions: [String!]
  }

  type PredictionData {
    staffingNeeds: [StaffingNeed!]!
    burnoutRisks: [BurnoutRisk!]!
    conflictForecasts: [ConflictForecast!]!
  }

  type StaffingNeed {
    date: DateTime!
    required: Int!
    confidence: Float!
  }

  type BurnoutRisk {
    analystName: String!
    riskLevel: String!
    riskScore: Float!
  }

  type DashboardPerformanceMetrics {
    averageQueryTime: Float!
    cacheHitRate: Float!
    activeConnections: Int!
    systemHealth: String!
  }

  type CustomReport {
    id: ID!
    name: String!
    type: String!
    generatedAt: DateTime!
    data: JSON!
    summary: String!
    recommendations: [String!]!
  }

  type ExportResult {
    success: Boolean!
    data: JSON
    fileUrl: String
    error: String
    generatedAt: DateTime!
  }

  # Health and Performance
  type HealthStatus {
    status: String!
    timestamp: DateTime!
    version: String!
    database: DatabaseHealth!
    cache: CacheHealth!
  }

  type DatabaseHealth {
    status: String!
    performance: DatabasePerformance
    error: String
  }

  type DatabasePerformance {
    totalQueries: Int!
    slowQueries: Int!
    averageDuration: Float!
    slowQueryPercentage: Float!
  }

  type CacheHealth {
    status: String!
    stats: CacheStats
  }

  type CacheStats {
    keys: Int!
    memory: Float!
    hitRate: Float!
  }

  # Input Types
  input CreateAnalystInput {
    name: String!
    email: String!
    shiftType: ShiftType!
    customAttributes: JSON
    skills: [String!]
  }

  input UpdateAnalystInput {
    name: String
    email: String
    shiftType: ShiftType
    isActive: Boolean
    customAttributes: JSON
    skills: [String!]
  }

  input CreateVacationInput {
    analystId: ID!
    startDate: DateTime!
    endDate: DateTime!
    reason: String
  }

  input CreateConstraintInput {
    analystId: ID
    constraintType: String!
    startDate: DateTime!
    endDate: DateTime!
    description: String
  }

  input ScheduleGenerationInput {
    startDate: DateTime!
    endDate: DateTime!
    algorithmType: String!
    algorithmConfig: AlgorithmConfigurationInput
  }

  input AlgorithmConfigurationInput {
    fairnessWeight: Float
    efficiencyWeight: Float
    constraintWeight: Float
    optimizationStrategy: OptimizationStrategy
    maxIterations: Int
    convergenceThreshold: Float
    randomizationFactor: Float
    screenerAssignmentStrategy: ScreenerAssignmentStrategy
    weekendRotationStrategy: WeekendRotationStrategy
  }

  input AnalystFilter {
    isActive: Boolean
    shiftType: ShiftType
    skills: [String!]
  }

  input ScheduleFilter {
    startDate: DateTime
    endDate: DateTime
    analystId: ID
    shiftType: ShiftType
    isScreener: Boolean
  }

  # Calendar Layer Management Types
  type CalendarLayer {
    id: ID!
    name: String!
    description: String!
    enabled: Boolean!
    opacity: Float!
    color: String!
    orderIndex: Int!
    dataType: String!
    icon: String
  }

  type LayerData {
    layerId: ID!
    events: [CalendarEvent!]!
    conflicts: [Conflict!]!
    metadata: JSON
  }

  type CalendarEvent {
    id: ID!
    title: String!
    startDate: DateTime!
    endDate: DateTime!
    type: String!
    layer: String!
    analystId: ID
    shiftType: String
    constraintType: String
    reason: String
    eventType: String
    description: String
    overallScore: Float
    workloadFairness: Float
    weekendFairness: Float
  }

  type Conflict {
    id: ID!
    type: String!
    scheduleId: ID
    constraintId: ID
    date: DateTime!
    analystId: ID
    description: String!
  }

  type ViewPreferences {
    viewType: String!
    defaultLayers: [String!]!
    zoomLevel: Int!
    showConflicts: Boolean!
    showFairnessIndicators: Boolean!
  }

  type ViewData {
    viewType: String!
    dateRange: DateRange!
    events: [CalendarEvent!]!
    conflicts: [Conflict!]!
    metadata: JSON!
  }

  input DateRangeInput {
    startDate: DateTime!
    endDate: DateTime!
  }

  input LayerPreferencesInput {
    layerId: ID!
    enabled: Boolean
    opacity: Float
    color: String
    orderIndex: Int
  }

  input ViewPreferencesInput {
    viewType: String!
    defaultLayers: [String!]!
    zoomLevel: Int
    showConflicts: Boolean
    showFairnessIndicators: Boolean
  }

  # Queries
  type Query {
    # Health and system
    health: HealthStatus!
    
    # Analysts
    analysts(filter: AnalystFilter): [Analyst!]!
    analyst(id: ID!): Analyst
    
    # Schedules
    schedules(filter: ScheduleFilter): [Schedule!]!
    schedule(id: ID!): Schedule
    
    # Vacations
    vacations(analystId: ID): [Vacation!]!
    vacation(id: ID!): Vacation
    
    # Constraints
    constraints(analystId: ID): [SchedulingConstraint!]!
    constraint(id: ID!): SchedulingConstraint
    
    # Algorithm configurations
    algorithmConfigs: [AlgorithmConfig!]!
    algorithmConfig(id: ID!): AlgorithmConfig
    
    # Schedule generation
    generateSchedulePreview(input: ScheduleGenerationInput!): SchedulePreview!
    
    # Analytics
    analyticsData(analystId: ID, startDate: DateTime, endDate: DateTime): [AnalyticsData!]!
    workloadAnalysis(analystId: ID): WorkloadAnalysis
    
    # Advanced Analytics
    monthlyTallies(month: Int!, year: Int!): [MonthlyTally!]!
    fairnessReport(startDate: DateTime!, endDate: DateTime!): FairnessReport!
    workloadPredictions(months: Int!): [WorkloadPrediction!]!
    optimizationOpportunities(dateRange: String): [OptimizationOpportunity!]!
    
    # Predictive Intelligence
    staffingPrediction(date: DateTime!): StaffingPrediction!
    burnoutRiskAssessments(includeLowRisk: Boolean): [BurnoutAssessment!]!
    rotationSuggestions: [RotationSuggestion!]!
    conflictForecasts(pattern: JSON!): [ConflictForecast!]!
    
    # Dashboard
    dashboard: DashboardData!
    
    # Reports and Exports
    customReport(config: JSON!): CustomReport!
    exportAnalytics(format: JSON!, filters: JSON!): ExportResult!
    
    # Fairness metrics
    fairnessMetrics(schedules: [ID!]!): FairnessMetrics!
    
    # Performance metrics
    performanceMetrics: PerformanceMetrics!
    
      # Calendar exports
  calendarExport(analystId: ID!, format: String!, options: JSON): CalendarExport!
  teamCalendarExport(format: String!, options: JSON): CalendarExport!
  
  # Calendar Layer Management
  calendarLayers(dateRange: DateRangeInput!): [CalendarLayer!]!
  layerData(layerId: ID!, dateRange: DateRangeInput!): LayerData!
  viewData(viewType: String!, date: String!): ViewData!
  viewPreferences(viewType: String!): ViewPreferences!
  }

  # Mutations
  type Mutation {
    # Analysts
    createAnalyst(input: CreateAnalystInput!): Analyst!
    updateAnalyst(id: ID!, input: UpdateAnalystInput!): Analyst!
    deleteAnalyst(id: ID!): Boolean!
    
    # Vacations
    createVacation(input: CreateVacationInput!): Vacation!
    updateVacation(id: ID!, input: CreateVacationInput!): Vacation!
    deleteVacation(id: ID!): Boolean!
    approveVacation(id: ID!): Vacation!
    
    # Constraints
    createConstraint(input: CreateConstraintInput!): SchedulingConstraint!
    updateConstraint(id: ID!, input: CreateConstraintInput!): SchedulingConstraint!
    deleteConstraint(id: ID!): Boolean!
    
    # Schedules
    createSchedule(analystId: ID!, date: DateTime!, shiftType: ShiftType!, isScreener: Boolean!): Schedule!
    updateSchedule(id: ID!, shiftType: ShiftType, isScreener: Boolean): Schedule!
    deleteSchedule(id: ID!): Boolean!
    
    # Algorithm configurations
    createAlgorithmConfig(name: String!, description: String, config: JSON!): AlgorithmConfig!
    updateAlgorithmConfig(id: ID!, name: String, description: String, config: JSON, isActive: Boolean): AlgorithmConfig!
    deleteAlgorithmConfig(id: ID!): Boolean!
    
    # Schedule generation
    generateSchedules(input: ScheduleGenerationInput!): ScheduleGenerationResult!
    applySchedules(input: ScheduleGenerationInput!, overwriteExisting: Boolean): ScheduleGenerationResult!
    
      # System operations
  warmCache: Boolean!
  
  # Calendar Layer Management
  toggleLayer(layerId: ID!, enabled: Boolean!): Boolean!
  updateLayerPreferences(layerId: ID!, preferences: LayerPreferencesInput!): Boolean!
  saveViewPreferences(preferences: ViewPreferencesInput!): Boolean!
  resetLayerPreferences: Boolean!
  }
`; 