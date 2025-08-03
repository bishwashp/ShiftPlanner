// Calendar Layer Management Types

export interface CalendarLayer {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  opacity: number;
  color: string;
  orderIndex: number;
  dataType: 'shifts' | 'constraints' | 'vacations' | 'events' | 'fairness';
  icon?: string;
}

export interface LayerData {
  layerId: string;
  events: CalendarEvent[];
  conflicts: Conflict[];
  metadata?: any;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  type: string;
  layer: string;
  analystId?: string;
  shiftType?: string;
  constraintType?: string;
  reason?: string;
  eventType?: string;
  description?: string;
  overallScore?: number;
  workloadFairness?: number;
  weekendFairness?: number;
}

export interface Conflict {
  id: string;
  type: string;
  scheduleId?: string;
  constraintId?: string;
  date: string;
  analystId?: string;
  description: string;
}

export interface ViewPreferences {
  viewType: string;
  defaultLayers: string[];
  zoomLevel: number;
  showConflicts: boolean;
  showFairnessIndicators: boolean;
}

export interface ViewData {
  viewType: string;
  dateRange: DateRange;
  events: CalendarEvent[];
  conflicts: Conflict[];
  metadata: any;
}

export interface ViewContext {
  viewType: 'day' | 'week' | 'month';
  date: string;
  dateRange: DateRange;
  recommendedLayers: string[];
  defaultZoomLevel: number;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface LayerPreferences {
  layerId: string;
  enabled?: boolean;
  opacity?: number;
  color?: string;
  orderIndex?: number;
}

export interface CalendarLayers {
  layers: CalendarLayer[];
  conflicts: Conflict[];
}

// API Response Types
export interface CalendarLayersResponse {
  layers: CalendarLayer[];
  conflicts: Conflict[];
}

export interface LayerDataResponse {
  layerId: string;
  events: CalendarEvent[];
  conflicts: Conflict[];
  metadata?: any;
}

export interface ViewDataResponse {
  viewType: string;
  dateRange: DateRange;
  events: CalendarEvent[];
  conflicts: Conflict[];
  metadata: any;
  context: ViewContext;
}

// Component Props Types
export interface MultiLayerCalendarProps {
  dateRange: DateRange;
  layers: CalendarLayer[];
  onLayerToggle: (layerId: string, enabled: boolean) => void;
  onEventClick: (event: CalendarEvent) => void;
  viewType: 'day' | 'week' | 'month';
}

export interface CalendarLayerControlProps {
  layers: CalendarLayer[];
  onLayerToggle: (layerId: string, enabled: boolean) => void;
  onPreferenceChange: (layerId: string, preferences: Partial<LayerPreferences>) => void;
  onReset: () => void;
}

export interface CalendarLegendProps {
  layers: CalendarLayer[];
  conflicts: Conflict[];
  onLayerClick: (layerId: string) => void;
}

export interface EnhancedScheduleViewProps {
  dateRange: DateRange;
  viewType: 'day' | 'week' | 'month';
  showLayerControls?: boolean;
  showLegend?: boolean;
} 