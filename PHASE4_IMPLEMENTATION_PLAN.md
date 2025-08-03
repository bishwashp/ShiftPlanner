# Phase 4 Implementation Plan: V0.6.4.1 - Multi-Layer Calendar Foundation

## 📋 **Release Overview**
**Version**: V0.6.4.1 | **Duration**: 1 week | **Priority**: MEDIUM | **Status**: PLANNING

### 🎯 **Objective**
Implement the foundational multi-layer calendar architecture with basic toggle system and layer preferences management.

### 📊 **Problem Statements to Address**
- "How can we provide a better calendar experience with multiple views and layers?"
- "How to make the calendar clutter free and use advanced but easy to understand toggles?"
- "How do we devise an excellent UI to show different shifts across Day/Week/Month views?"

### 🏗️ **Current State Analysis**
✅ **Existing**: Basic calendar view with shift assignments  
✅ **Existing**: Constraint management and conflict detection  
✅ **Existing**: Fairness tracking and analytics  
❌ **Missing**: Multi-layer calendar visualization  
❌ **Missing**: Layer toggle system  
❌ **Missing**: Layer preferences management  

---

## 🏗️ **V0.6.4.1 Implementation Strategy**

### **Core Calendar Layer Architecture**

#### **Calendar Layers Definition:**
1. **Base Layer**: Assigned shifts (always visible, core functionality)
2. **Constraint Layer**: Blackout dates and restrictions (toggle)
3. **Vacation Layer**: Approved time off (toggle)
4. **Event Layer**: Special events and coverage needs (toggle)
5. **Fairness Layer**: Color-coded fairness indicators (toggle)

#### **Layer Properties:**
```typescript
interface CalendarLayer {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  opacity: number; // 0.0 to 1.0
  color: string; // Hex color code
  orderIndex: number;
  dataType: 'shifts' | 'constraints' | 'vacations' | 'events' | 'fairness';
  icon?: string;
}
```

---

## 🔧 **Backend Implementation**

### **New Services**

#### **1. CalendarLayerService**
```typescript
// src/services/CalendarLayerService.ts
export class CalendarLayerService {
  async getCalendarLayers(dateRange: DateRange, userId: string): Promise<CalendarLayers>
  async getLayerData(layerId: string, dateRange: DateRange): Promise<LayerData>
  async toggleLayer(layerId: string, enabled: boolean, userId: string): Promise<void>
  async updateLayerPreferences(userId: string, preferences: LayerPreferences): Promise<void>
  async getDefaultLayerPreferences(): Promise<LayerPreferences>
  async getLayerConflicts(layerId: string, dateRange: DateRange): Promise<Conflict[]>
}
```

#### **2. ViewManagementService**
```typescript
// src/services/ViewManagementService.ts
export class ViewManagementService {
  async getViewContext(viewType: 'day' | 'week' | 'month', date: Date): Promise<ViewContext>
  async getViewData(viewType: string, dateRange: DateRange, layers: string[]): Promise<ViewData>
  async saveViewPreferences(userId: string, preferences: ViewPreferences): Promise<void>
  async getRecommendedLayers(viewType: string): Promise<string[]>
}
```

### **Database Schema Updates**

#### **1. Calendar Layer Preferences Table**
```sql
-- Migration: 20250804000000_add_calendar_layer_preferences.sql
CREATE TABLE calendar_layer_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  layer_id VARCHAR(50) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  opacity DECIMAL(3,2) DEFAULT 1.0,
  color VARCHAR(7) DEFAULT '#3B82F6',
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, layer_id)
);

-- Index for performance
CREATE INDEX idx_calendar_layer_preferences_user_id ON calendar_layer_preferences(user_id);
CREATE INDEX idx_calendar_layer_preferences_layer_id ON calendar_layer_preferences(layer_id);
```

#### **2. View Preferences Table**
```sql
-- Migration: 20250804000001_add_view_preferences.sql
CREATE TABLE view_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  view_type VARCHAR(20) NOT NULL, -- 'day', 'week', 'month'
  default_layers TEXT[], -- Array of enabled layer IDs
  zoom_level INTEGER DEFAULT 1,
  show_conflicts BOOLEAN DEFAULT true,
  show_fairness_indicators BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, view_type)
);

-- Index for performance
CREATE INDEX idx_view_preferences_user_id ON view_preferences(user_id);
CREATE INDEX idx_view_preferences_view_type ON view_preferences(view_type);
```

### **API Endpoints**

#### **Calendar Layer Management (8 endpoints)**
```typescript
// GET /api/calendar/layers
// Get all available calendar layers with user preferences
GET /api/calendar/layers

// GET /api/calendar/layers/:layerId/data
// Get data for specific layer within date range
GET /api/calendar/layers/:layerId/data?startDate=2025-08-01&endDate=2025-08-31

// POST /api/calendar/layers/:layerId/toggle
// Toggle layer visibility
POST /api/calendar/layers/:layerId/toggle
Body: { enabled: boolean }

// PUT /api/calendar/layers/preferences
// Update layer preferences (opacity, color, order)
PUT /api/calendar/layers/preferences
Body: { layerId: string, opacity?: number, color?: string, orderIndex?: number }

// GET /api/calendar/layers/conflicts
// Get conflicts across all enabled layers
GET /api/calendar/layers/conflicts?startDate=2025-08-01&endDate=2025-08-31

// POST /api/calendar/layers/reset
// Reset layer preferences to defaults
POST /api/calendar/layers/reset

// GET /api/calendar/view/:type
// Get optimized data for specific view type
GET /api/calendar/view/:type?date=2025-08-01

// PUT /api/calendar/view/preferences
// Save view preferences
PUT /api/calendar/view/preferences
Body: { viewType: string, defaultLayers: string[], zoomLevel?: number }
```

### **GraphQL Schema Updates**

#### **Add to schema.ts**
```typescript
// Calendar Layer Types
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

type ViewPreferences {
  viewType: String!
  defaultLayers: [String!]!
  zoomLevel: Int!
  showConflicts: Boolean!
  showFairnessIndicators: Boolean!
}

# Queries
extend type Query {
  calendarLayers(dateRange: DateRangeInput!): [CalendarLayer!]!
  layerData(layerId: ID!, dateRange: DateRangeInput!): LayerData!
  viewData(viewType: String!, date: String!): ViewData!
  viewPreferences(viewType: String!): ViewPreferences!
}

# Mutations
extend type Mutation {
  toggleLayer(layerId: ID!, enabled: Boolean!): Boolean!
  updateLayerPreferences(layerId: ID!, preferences: LayerPreferencesInput!): Boolean!
  saveViewPreferences(preferences: ViewPreferencesInput!): Boolean!
  resetLayerPreferences: Boolean!
}
```

---

## 🎨 **Frontend Implementation**

### **New Components**

#### **1. MultiLayerCalendar Component**
```typescript
// src/components/MultiLayerCalendar.tsx
interface MultiLayerCalendarProps {
  dateRange: DateRange;
  layers: CalendarLayer[];
  onLayerToggle: (layerId: string, enabled: boolean) => void;
  onEventClick: (event: CalendarEvent) => void;
  viewType: 'day' | 'week' | 'month';
}

const MultiLayerCalendar: React.FC<MultiLayerCalendarProps> = ({
  dateRange,
  layers,
  onLayerToggle,
  onEventClick,
  viewType
}) => {
  // Implementation with layer rendering
  // Conflict highlighting
  // Event interaction handling
};
```

#### **2. CalendarLayerControl Component**
```typescript
// src/components/CalendarLayerControl.tsx
interface CalendarLayerControlProps {
  layers: CalendarLayer[];
  onLayerToggle: (layerId: string, enabled: boolean) => void;
  onPreferenceChange: (layerId: string, preferences: Partial<LayerPreferences>) => void;
  onReset: () => void;
}

const CalendarLayerControl: React.FC<CalendarLayerControlProps> = ({
  layers,
  onLayerToggle,
  onPreferenceChange,
  onReset
}) => {
  // Layer toggle switches
  // Opacity sliders
  // Color pickers
  // Reset button
};
```

#### **3. CalendarLegend Component**
```typescript
// src/components/CalendarLegend.tsx
interface CalendarLegendProps {
  layers: CalendarLayer[];
  conflicts: Conflict[];
  onLayerClick: (layerId: string) => void;
}

const CalendarLegend: React.FC<CalendarLegendProps> = ({
  layers,
  conflicts,
  onLayerClick
}) => {
  // Layer legend with colors and icons
  // Conflict indicators
  // Interactive layer highlighting
};
```

#### **4. Enhanced ScheduleView Component**
```typescript
// src/components/ScheduleView.tsx (Enhanced)
interface EnhancedScheduleViewProps {
  dateRange: DateRange;
  viewType: 'day' | 'week' | 'month';
  showLayerControls?: boolean;
  showLegend?: boolean;
}

const EnhancedScheduleView: React.FC<EnhancedScheduleViewProps> = ({
  dateRange,
  viewType,
  showLayerControls = true,
  showLegend = true
}) => {
  // Integration with MultiLayerCalendar
  // Layer control integration
  // Legend integration
  // View switching logic
};
```

### **Enhanced Services**

#### **1. Calendar API Service**
```typescript
// src/services/api.ts (Enhanced)
export const calendarApi = {
  // Layer Management
  getCalendarLayers: (dateRange: DateRange) => 
    api.get(`/calendar/layers`, { params: dateRange }),
  
  getLayerData: (layerId: string, dateRange: DateRange) =>
    api.get(`/calendar/layers/${layerId}/data`, { params: dateRange }),
  
  toggleLayer: (layerId: string, enabled: boolean) =>
    api.post(`/calendar/layers/${layerId}/toggle`, { enabled }),
  
  updateLayerPreferences: (layerId: string, preferences: LayerPreferences) =>
    api.put(`/calendar/layers/preferences`, { layerId, ...preferences }),
  
  // View Management
  getViewData: (viewType: string, date: string) =>
    api.get(`/calendar/view/${viewType}`, { params: { date } }),
  
  saveViewPreferences: (preferences: ViewPreferences) =>
    api.put(`/calendar/view/preferences`, preferences),
  
  // Utility
  resetLayerPreferences: () =>
    api.post(`/calendar/layers/reset`),
  
  getLayerConflicts: (dateRange: DateRange) =>
    api.get(`/calendar/layers/conflicts`, { params: dateRange })
};
```

---

## 📊 **Success Metrics & Validation**

### **Performance Metrics:**
- **Calendar layers load within 200ms**
- **Layer toggle response time <100ms**
- **View switching response time <300ms**
- **Memory usage increase <20%**

### **User Experience Metrics:**
- **95%+ user satisfaction with layer management**
- **Zero visual conflicts between layers**
- **Layer preferences persist across sessions**
- **Intuitive layer toggle interface**

### **Technical Metrics:**
- **100% API endpoint success rate**
- **Zero TypeScript compilation errors**
- **Complete frontend-backend integration**
- **Database schema deployed successfully**

---

## 🧪 **Testing Strategy**

### **Unit Testing:**
```typescript
// Backend Services
- CalendarLayerService.test.ts
- ViewManagementService.test.ts

// Frontend Components  
- MultiLayerCalendar.test.tsx
- CalendarLayerControl.test.tsx
- CalendarLegend.test.tsx
```

### **Integration Testing:**
```typescript
// API Endpoints
- Calendar layer management endpoints
- View management endpoints
- Database integration

// Frontend-Backend Integration
- Layer toggle functionality
- Data loading and rendering
- Preference persistence
```

### **End-to-End Testing:**
```typescript
// Complete Workflows
- Calendar layer toggle workflow
- View switching workflow
- Preference management workflow
- Conflict visualization workflow
```

---

## 🚀 **Deployment Plan**

### **Day 1-2: Backend Foundation**
- Database schema migrations
- CalendarLayerService implementation
- ViewManagementService implementation
- API endpoints development
- GraphQL schema updates

### **Day 3-4: Frontend Components**
- MultiLayerCalendar component
- CalendarLayerControl component
- CalendarLegend component
- Enhanced ScheduleView integration
- API service integration

### **Day 5: Integration & Testing**
- Frontend-backend integration testing
- End-to-end workflow testing
- Performance optimization
- Bug fixes and refinements

### **Day 6: Documentation & Deployment**
- Update documentation
- Deploy to staging environment
- User acceptance testing
- Production deployment preparation

### **Day 7: Production Deployment**
- Production deployment
- Monitoring and validation
- User feedback collection
- Post-deployment optimization

---

## 📋 **Deliverables Checklist**

### **Backend Deliverables:**
- [ ] CalendarLayerService implementation
- [ ] ViewManagementService implementation
- [ ] Database schema migrations (2 tables)
- [ ] 8 new API endpoints
- [ ] GraphQL schema updates
- [ ] Unit tests for all services

### **Frontend Deliverables:**
- [ ] MultiLayerCalendar component
- [ ] CalendarLayerControl component
- [ ] CalendarLegend component
- [ ] Enhanced ScheduleView integration
- [ ] Calendar API service updates
- [ ] Component unit tests

### **Integration Deliverables:**
- [ ] Frontend-backend integration testing
- [ ] End-to-end workflow testing
- [ ] Performance validation
- [ ] Documentation updates

---

*This implementation plan focuses specifically on V0.6.4.1 - Multi-Layer Calendar Foundation, providing the essential infrastructure for advanced calendar visualization while maintaining manageable scope and complexity.* 