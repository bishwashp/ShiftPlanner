# Calendar Component Analysis

**Stage 0, Task 0.1: Map Calendar Components**  
**Date:** November 22, 2024

---

## Executive Summary

ShiftPlanner has **5 calendar-related components** with overlapping responsibilities. After analysis:

**Primary Implementation:** `SimplifiedScheduleView` → delegates to `CalendarGrid` (month) + `WeekScheduleView` (week)  
**Entry Point:** `ScheduleView` (thin wrapper, 29 lines)  
**Dashboard Widget:** `ScheduleSnapshot` (separate, not part of main calendar)

**Key Finding:** The calendar architecture is actually **more consolidated** than initially suspected. There are 3 core components working together, not 5 competing implementations.

---

## Component Breakdown

### 1. **ScheduleView.tsx** (Entry Point)

**File:** `/frontend/src/components/ScheduleView.tsx`  
**Size:** 861 bytes (29 lines)  
**Purpose:** Thin wrapper that delegates to SimplifiedScheduleView  
**Status:** ✅ **Functional passthrough**

**Code:**
```typescript
const ScheduleView: React.FC<ScheduleViewProps> = (props) => {
  return (
    <SimplifiedScheduleView {...props} />
  );
};
```

**Features:**
- None - pure passthrough
- Exists for backward compatibility
- Could be removed, update `App.tsx` to use `SimplifiedScheduleView` directly

**Dependencies:**
- Imports: `SimplifiedScheduleView`
- Used by: `App.tsx` (line 173 in schedule view)

**Verdict:** **Keep but rename**, or **remove** and update `App.tsx`

---

### 2. **SimplifiedScheduleView.tsx** (Main Orchestrator)

**File:** `/frontend/src/components/calendar/simplified/SimplifiedScheduleView.tsx`  
**Size:** 18,107 bytes (528 lines)  
**Purpose:** Main calendar controller, manages data fetching, view switching, filtering  
**Status:** ✅ **Primary implementation**

**Features:**
- ✅ Data fetching (schedules + analysts)
- ✅ View switching (Month ↔ Week)
- ✅ Mobile swipe navigation
- ✅ Filtering system integration
- ✅ Performance tracking
- ✅ Loading/error states
- ❌ **NO create/edit modals** (only shows action prompt on date click)
- ❌ **NO delete functionality**
- ❌ **NO validation integration**

**Architecture:**
```
SimplifiedScheduleView (orchestrator)
  ├─→ CalendarGrid (month view)
  └─→ WeekScheduleView (week view when showWeekView=true)
```

**Key Code Sections:**

**Data Fetching (lines 256-303):**
```typescript
const fetchSchedulesAndAnalysts = useCallback(async () => {
  const analystsData = await apiService.getAnalysts();
  const schedulesData = await apiService.getSchedules(startDate, endDate);
  setSchedules(schedulesData);
  setAnalysts(activeAnalysts);
}, [startDate, endDate]);
```
✅ Works - fetches data on date range change

**Date Click Handler (lines 218-252):**
```typescript
const handleDateSelect = useCallback((date: Date) => {
  showImportantPrompt(
    'Create Schedule',
    `Would you like to create a new schedule for ${dateString}?`,
    [/* action prompt buttons */]
  );
}, [isMobile, showImportantPrompt]);
```
❌ **Broken** - Shows prompt but doesn't open modal or create schedule

**View Switching (lines 411-424):**
```typescript
if (showWeekView) {
  return (
    <WeekScheduleView
      date={date}
      timezone={timezone}
      events={calendarEvents}
      analysts={analysts}
      onScheduleUpdate={handleScheduleUpdate}
    />
  );
}
```
✅ Works - switches to WeekScheduleView

**Filtering (lines 153-155):**
```typescript
const filterHook = useCalendarFilters(schedules, analysts);
const { filters, filteredSchedules, toggleSidebar } = filterHook;
```
✅ Works - filtering panel functional

**Dependencies:**
- Imports: `CalendarGrid`, `WeekScheduleView`, `CalendarFilterPanel`, `apiService`
- Used by: `ScheduleView`
- Uses: `useCalendarFilters` hook, `useActionPrompts` context

**Verdict:** **Keep as primary**, needs enhancement:
- Add create/edit modal integration
- Add delete functionality
- Add constraint validation

---

### 3. **CalendarGrid.tsx** (Month View Grid)

**File:** `/frontend/src/components/calendar/simplified/CalendarGrid.tsx`  
**Size:** 14,623 bytes (397 lines)  
**Purpose:** Renders month grid with smart name box stacking  
**Status:** ✅ **Functional month view**

**Features:**
- ✅ Month grid rendering (weeks × 7 days)
- ✅ Smart event stacking (max 4 visible, "+N more" button)
- ✅ Keyboard navigation (arrow keys, home/end, page up/down)
- ✅ Accessibility (ARIA labels, screen reader support)
- ✅ Empty state (shows "+" button on hover)
- ✅ "+N more" click → triggers week view
- ❌ **NO drag-and-drop** (not implemented here)
- ❌ **Double-click triggers action but doesn't open modal**

**Key Code Sections:**

**Name Box Rendering (lines 122-177):**
```typescript
const renderNameBoxes = (dayEvents, dayDate) => {
  const visibleEvents = dayEvents.slice(0, config.maxVisible); // Max 4
  const overflowCount = dayEvents.length - config.maxVisible;
  
  return (
    <>
      {visibleEvents.map(event => (
        <NameBox
          name={event.title}
          shiftType={event.resource.shiftType}
          isScreener={event.resource.isScreener}
        />
      ))}
      {overflowCount > 0 && (
        <button onClick={() => onShowMoreClick(dayDate)}>
          +{overflowCount} more
        </button>
      )}
    </>
  );
};
```
✅ Works - stacking and overflow work correctly

**Keyboard Navigation (lines 59-114):**
```typescript
const handleKeyDown = (e: KeyboardEvent) => {
  switch (e.key) {
    case 'ArrowLeft': // Previous day
    case 'ArrowRight': // Next day
    case 'ArrowUp': // Previous week
    case 'ArrowDown': // Next week
    case 'Enter': onDateSelect(currentDate);
    case 'PageUp': // Previous month
    case 'PageDown': // Next month
  }
};
```
✅ Works - full keyboard navigation

**Empty State (lines 355-372):**
```typescript
{day.events.length === 0 && (
  <button
    className="opacity-0 hover:opacity-30"
    onDoubleClick={() => onDateSelect(day.date)}
  >
    +
  </button>
)}
```
❌ **Partial** - Shows button but `onDateSelect` doesn't open modal

**Dependencies:**
- Imports: `NameBox` component
- Used by: `SimplifiedScheduleView`
- Props from parent: `events`, `isMobile`, `onDateSelect`, `onShowMoreClick`

**Verdict:** **Keep as is**, works well for month view. Needs parent to implement:
- `onDateSelect` → open create modal
- `onEventSelect` → open edit modal (currently unused)

---

### 4. **WeekScheduleView.tsx** (Week Detail View)

**File:** `/frontend/src/components/calendar/simplified/WeekScheduleView.tsx`  
**Size:** 13,116 bytes (352 lines)  
**Purpose:** Detailed week view with drag-and-drop  
**Status:** 🟡 **Partially functional**

**Features:**
- ✅ Week grid (7 days, morning/evening sections)
- ✅ Drag-and-drop schedules between days
- ✅ Conflict detection (visual indicators)
- ✅ Navigation (prev/next week, return to month)
- ✅ Screener badges
- ❌ **NO validation during drag-drop** (drops always succeed)
- ❌ **NO edit/delete on click**
- ❌ **Conflicts displayed but not actionable**

**Key Code Sections:**

**Drag-and-Drop (lines 132-181):**
```typescript
const handleDragStart = (e, schedule) => {
  setDraggedSchedule(schedule);
};

const handleDrop = async (e, targetDay) => {
  const newDate = targetDay.toDate();
  
  // Update schedule date
  await apiService.updateSchedule(draggedSchedule.id, {
    date: newDate.toISOString(),
    shiftType: draggedSchedule.shiftType,
    isScreener: draggedSchedule.isScreener
  });
  
  onScheduleUpdate(updatedSchedules);
};
```
✅ **Works** - drag-drop updates database  
❌ **Missing** - No constraint validation before drop

**Conflict Detection (lines 72-114):**
```typescript
const conflicts: string[] = [];
if (morningScreeners.length > 1) conflicts.push('Multiple morning screeners');
if (eveningScreeners.length > 1) conflicts.push('Multiple evening screeners');
if (morningSchedules.length === 0) conflicts.push('No morning coverage');
```
✅ Works - detects conflicts  
❌ **Missing** - Conflicts displayed but no fix action

**Schedule Display (lines 275-297):**
```typescript
{day.morningSchedules.map((schedule) => (
  <div
    draggable
    onDragStart={(e) => handleDragStart(e, schedule)}
    className={schedule.isScreener ? 'bg-yellow-200' : 'bg-blue-100'}
  >
    {getAnalystName(schedule.analystId)}
  </div>
))}
```
✅ Works - displays schedules  
❌ **Missing** - No click handler for edit/delete

**Dependencies:**
- Imports: `apiService`, `Analyst`, `Schedule`
- Used by: `SimplifiedScheduleView`
- Props from parent: `events`, `analysts`, `onScheduleUpdate`

**Verdict:** **Keep**, enhance:
- Add validation API call before drop
- Add click handler for edit/delete
- Make conflicts actionable (auto-fix button)

---

### 5. **ScheduleSnapshot.tsx** (Dashboard Widget)

**File:** `/frontend/src/components/ScheduleSnapshot.tsx`  
**Size:** 9,312 bytes (243 lines)  
**Purpose:** Dashboard summary widget (today's screeners, coverage, holidays)  
**Status:** ✅ **Functional (separate concern)**

**Features:**
- ✅ Today's screeners display
- ✅ Upcoming holiday display
- ✅ Today's coverage status
- ✅ Loading/error states
- ✅ Gradient card designs

**Key Code:**
```typescript
const [data, setData] = useState<ScheduleSnapshotData | null>(null);

const fetchSnapshotData = async () => {
  const snapshotData = await apiService.getScheduleSnapshot();
  setData(snapshotData);
};
```

**Used By:** `Dashboard.tsx` (line 393)

**Verdict:** **Keep separate** - This is NOT a calendar view, it's a dashboard widget. Leave as is.

---

## Feature Comparison Matrix

| Feature | ScheduleView | SimplifiedScheduleView | CalendarGrid | WeekScheduleView | ScheduleSnapshot |
|---------|--------------|----------------------|--------------|-----------------|-----------------|
| **Display schedules** | ➡️ Passthrough | ✅ Orchestrates | ✅ Month grid | ✅ Week detail | ✅ Summary cards |
| **Month view** | ➡️ | ✅ Delegates | ✅ Renders | ❌ | ❌ |
| **Week view** | ➡️ | ✅ Delegates | ❌ | ✅ Renders | ❌ |
| **Day view** | ➡️ | ⚠️ Placeholder | ❌ | ❌ | ❌ |
| **Data fetching** | ❌ | ✅ | ❌ (uses props) | ❌ (uses props) | ✅ |
| **Create schedule** | ❌ | ❌ (prompt only) | ❌ | ❌ | ❌ |
| **Edit schedule** | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Delete schedule** | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Drag-and-drop** | ❌ | ❌ | ❌ | ✅ (no validation) | ❌ |
| **Filtering** | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Conflict detection** | ❌ | ❌ | ❌ | ✅ (display only) | ❌ |
| **Keyboard navigation** | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Mobile gestures** | ❌ | ✅ Swipe | ❌ | ❌ | ❌ |
| **Accessibility** | ❌ | ✅ | ✅ Full ARIA | ❌ | ❌ |

---

## Dependency Graph

```
App.tsx
  └─→ ScheduleView (29 lines - wrapper)
        └─→ SimplifiedScheduleView (528 lines - orchestrator)
              ├─→ CalendarGrid (397 lines - month view)
              │     └─→ NameBox (shift display component)
              ├─→ WeekScheduleView (352 lines - week view)
              └─→ CalendarFilterPanel (filtering sidebar)

Dashboard.tsx
  └─→ ScheduleSnapshot (243 lines - summary widget, independent)
```

**External Dependencies:**
- `apiService` - Used by SimplifiedScheduleView and ScheduleSnapshot
- `useCalendarFilters` - Custom hook for filtering
- `useActionPrompts` - Context for action prompts
- `useTheme` - Theme switching context
- `moment-timezone` - Date manipulation

---

## What Works vs. What's Broken

### ✅ **Working Features**

1. **Month View Display**
   - CalendarGrid renders correctly
   - Smart stacking (max 4 boxes, "+N more")
   - Keyboard navigation
   - Accessibility labels

2. **Week View Display**
   - WeekScheduleView renders Monday-Sunday
   - Morning/evening sections
   - Conflict visual indicators
   - Drag-and-drop updates database

3. **Data Flow**
   - Fetches schedules from API
   - Fetches analysts from API
   - Transforms to calendar events
   - Passes to child components

4. **View Switching**
   - Month ↔ Week navigation works
   - "+N more" button triggers week view
   - Return to month button works

5. **Mobile Support**
   - Swipe gestures for month navigation
   - Responsive layouts
   - Touch-optimized controls

### ❌ **Broken/Missing Features**

1. **Create Schedule**
   - Double-click shows action prompt
   - Prompt doesn't open modal
   - No create schedule modal exists

2. **Edit Schedule**
   - Click on schedule does nothing
   - No edit modal exists
   - No way to modify existing schedules

3. **Delete Schedule**
   - No delete functionality anywhere
   - No confirmation dialog

4. **Validation**
   - Drag-drop doesn't validate constraints
   - No API call to check validity before save
   - Conflicts detected but not enforced

5. **Conflict Resolution**
   - Conflicts displayed in week view
   - No "Fix" or "Auto-resolve" button
   - Not actionable

---

## Recommendations

### **Immediate Actions (Stage 1: Calendar UI Consolidation)**

#### **1. Remove ScheduleView Wrapper**
- Update `App.tsx` line 173 to directly use `SimplifiedScheduleView`
- Delete `/frontend/src/components/ScheduleView.tsx`
- **Justification:** Unnecessary indirection, 29 lines of passthrough code

#### **2. Rename SimplifiedScheduleView → ScheduleCalendar**
- More descriptive name
- Update imports in `App.tsx`
- File: `/frontend/src/components/ScheduleCalendar.tsx`

#### **3. Keep CalendarGrid + WeekScheduleView**
- These are NOT duplicates, they're complementary views
- CalendarGrid = Month view renderer
- WeekScheduleView = Week detail renderer
- Both used by ScheduleCalendar (renamed SimplifiedScheduleView)

#### **4. Keep ScheduleSnapshot Separate**
- Different purpose (dashboard widget, not calendar)
- Used only in Dashboard.tsx
- No overlap with calendar functionality

### **Missing Functionality to Add**

#### **Must Build:**

1. **Create Schedule Modal**
   ```typescript
   // Add to SimplifiedScheduleView
   const [showCreateModal, setShowCreateModal] = useState(false);
   const [selectedDate, setSelectedDate] = useState<Date | null>(null);
   
   const handleDateSelect = (date: Date) => {
     setSelectedDate(date);
     setShowCreateModal(true);
   };
   ```

2. **Edit Schedule Modal**
   ```typescript
   const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
   
   const handleEventSelect = (event: CalendarEvent) => {
     setEditingSchedule(event.resource);
     setShowEditModal(true);
   };
   ```

3. **Delete Confirmation**
   ```typescript
   const handleDeleteSchedule = async (scheduleId: string) => {
     if (confirm('Delete this schedule?')) {
       await apiService.deleteSchedule(scheduleId);
       await fetchSchedulesAndAnalysts();
     }
   };
   ```

4. **Validation Integration**
   ```typescript
   // In WeekScheduleView handleDrop
   const handleDrop = async (e, targetDay) => {
     // BEFORE saving:
     const validation = await apiService.validateSchedule({
       analystId: draggedSchedule.analystId,
       date: targetDay,
       shiftType: draggedSchedule.shiftType
     });
     
     if (validation.hardViolations.length > 0) {
       alert(validation.hardViolations[0].message);
       return; // Block save
     }
     
     // Proceed with save...
   };
   ```

---

## Conclusion

**Findings:**
- ✅ Architecture is **more consolidated** than initially thought
- ✅ Three components work together (not 5 competing implementations)
- ❌ CRUD operations (create/edit/delete) are **completely missing**
- ❌ Validation integration is **absent**

**Actual Component Count:**
- **1 wrapper** (ScheduleView - can be removed)
- **1 orchestrator** (SimplifiedScheduleView - rename to ScheduleCalendar)
- **2 view renderers** (CalendarGrid, WeekScheduleView - keep both)
- **1 separate widget** (ScheduleSnapshot - dashboard only, unrelated)

**Next Steps:**
✅ Stage 0, Task 0.1 complete  
→ Proceed to Task 0.2: Map Algorithm Dependencies  
→ Then Task 0.3: Test current functionality manually
