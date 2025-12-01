# ShiftPlanner v1.0 Implementation Plan

**Goal**: Fix core functionality so users can create, view, edit, and delete schedules via calendar.

**Approach**: Sequential, isolated tasks with validation at each step. Work on one thing at a time.

---

## 🎯 Implementation Strategy

### Working Style
- **One task at a time** - Complete and validate before moving to next
- **Isolated changes** - Each task is self-contained and testable
- **Validation gates** - Must pass success criteria before proceeding
- **Agentic windows** - Each stage can be worked on independently

### Success Criteria Per Task
- ✅ Code works (no critical bugs)
- ✅ Manual testing passes
- ✅ Integration with existing code works
- ✅ Performance acceptable (<300ms UI, <3s operations)

---

## 📋 Stage 0: Discovery & Dependency Mapping (PREREQUISITE)

**Goal**: Understand current state before making changes

### Task 0.1: Map Calendar Components
- [ ] Identify which calendar component is actually used in production
- [ ] List all 5 calendar components and their dependencies
- [ ] Document what works vs. broken in each
- [ ] Create dependency graph: `frontend/src/components/calendar/`

**Deliverable**: `CALENDAR_ANALYSIS.md` with:
- Which component is primary (SimplifiedScheduleView)
- What features each component has
- What's broken (drag-drop, editing, etc.)
- Dependencies between components

### Task 0.2: Map Algorithm Dependencies
- [ ] Trace all callers of `CoreWeekendRotationScheduler.generateSchedules()`
- [ ] Identify embedded fairness/constraint logic in algorithm
- [ ] Map which services use which algorithms
- [ ] Document algorithm → constraint → fairness flow

**Deliverable**: `ALGORITHM_DEPENDENCIES.md` with:
- Call graph of algorithm usage
- Duplicated logic locations
- Service dependencies

### Task 0.3: Test Current Functionality
- [ ] Manual test: Can user create schedule via calendar? (Expected: ❌)
- [ ] Manual test: Does algorithm generate schedules? (Expected: ✅)
- [ ] Manual test: Do constraints block saves? (Expected: ❌)
- [ ] Manual test: Does conflict auto-fix work? (Expected: ❌)
- [ ] Document actual vs. expected behavior

**Deliverable**: `CURRENT_STATE_TEST_RESULTS.md`

**Validation**: All discovery tasks complete, documentation ready

---

## 📅 Stage 1: Calendar UI Consolidation

**Goal**: Single, functional calendar component with full CRUD

### Task 1.1: Analyze Existing Calendar Components
- [ ] Read `SimplifiedScheduleView.tsx` (18KB - primary)
- [ ] Read `CalendarGrid.tsx` (14KB)
- [ ] Read `WeekScheduleView.tsx` (13KB)
- [ ] Read `ScheduleSnapshot.tsx` (9KB - dashboard widget only)
- [ ] Document features in each component
- [ ] Identify best features to keep

**Deliverable**: Feature comparison table

### Task 1.2: Create Unified ScheduleCalendar Component
- [ ] Create `frontend/src/components/ScheduleCalendar.tsx`
- [ ] Implement Month/Week/Day view toggle
- [ ] Implement schedule display (shifts, screener badges, weekend highlight)
- [ ] Implement click empty slot → Create modal
- [ ] Implement click existing → Edit modal
- [ ] Implement right-click → Delete with confirmation
- [ ] Add loading skeletons
- [ ] Add error toasts
- [ ] Add success indicators

**Deliverable**: New `ScheduleCalendar.tsx` component

**Validation**:
- ✅ Component renders in all 3 views
- ✅ Can click to create schedule (modal opens)
- ✅ Can click to edit schedule (modal opens)
- ✅ Can delete schedule (confirmation works)

### Task 1.3: Implement Drag-and-Drop
- [ ] Add drag handlers to schedule items
- [ ] Implement drop zones on calendar days
- [ ] Add visual feedback during drag
- [ ] Call validation API before drop
- [ ] Show error if validation fails
- [ ] Update schedule on successful drop

**Deliverable**: Working drag-and-drop

**Validation**:
- ✅ Can drag schedule to new date
- ✅ Validation runs before drop
- ✅ Invalid drops show error
- ✅ Valid drops update schedule

### Task 1.4: Connect to Backend API
- [ ] Implement `GET /schedules?startDate=X&endDate=Y` integration
- [ ] Implement `POST /schedules` for create
- [ ] Implement `PUT /schedules/:id` for update
- [ ] Implement `DELETE /schedules/:id` for delete
- [ ] Add optimistic UI updates
- [ ] Add error rollback on failure

**Deliverable**: Full CRUD integration

**Validation**:
- ✅ Calendar loads schedules from API
- ✅ Create schedule persists to database
- ✅ Edit schedule updates database
- ✅ Delete schedule removes from database
- ✅ UI updates immediately (optimistic)

### Task 1.5: Replace Old Calendar Components
- [ ] Update `ScheduleView.tsx` to use `ScheduleCalendar`
- [ ] Remove or archive `CalendarGrid.tsx` (if redundant)
- [ ] Remove or archive `WeekScheduleView.tsx` (if redundant)
- [ ] Keep `ScheduleSnapshot.tsx` as dashboard widget only
- [ ] Update all imports
- [ ] Test that nothing breaks

**Deliverable**: Single calendar component in use

**Validation**:
- ✅ App.tsx uses new ScheduleCalendar
- ✅ No broken imports
- ✅ Calendar still works in all views

### Task 1.6: Add Visual Styling
- [ ] Implement shift type colors (AM/PM)
- [ ] Add screener badges
- [ ] Highlight weekend days
- [ ] Dark mode support
- [ ] Muted colors per requirements

**Deliverable**: Styled calendar matching requirements

**Validation**:
- ✅ Visual distinction clear (shift/screener/weekend)
- ✅ Dark mode works
- ✅ Colors match requirements doc

**Stage 1 Complete When**: User can create, view, edit, delete schedules via calendar UI

---

## 🔧 Stage 2: Algorithm Refactoring

**Goal**: Remove duplication, use standalone engines

### Task 2.1: Understand Current Algorithm Structure
- [ ] Read `CoreWeekendRotationScheduler.ts`
- [ ] Identify embedded fairness calculations
- [ ] Identify embedded constraint validation
- [ ] Document what's duplicated vs. standalone

**Deliverable**: Algorithm analysis document

### Task 2.2: Extract Embedded Fairness Logic
- [ ] Find all fairness calculations in `CoreWeekendRotationScheduler`
- [ ] Replace with `fairnessEngine.calculate(schedules)` calls
- [ ] Verify algorithm still generates same results
- [ ] Remove embedded fairness code

**Deliverable**: Algorithm uses standalone FairnessEngine

**Validation**:
- ✅ Algorithm generates schedules correctly
- ✅ Fairness calculations match previous results
- ✅ No embedded fairness logic remains

### Task 2.3: Extract Embedded Constraint Logic
- [ ] Find all constraint validation in `CoreWeekendRotationScheduler`
- [ ] Replace with `constraintEngine.validate(proposed, constraints)` calls
- [ ] Verify algorithm respects constraints
- [ ] Remove embedded constraint code

**Deliverable**: Algorithm uses standalone ConstraintEngine

**Validation**:
- ✅ Algorithm respects constraints
- ✅ Constraint violations detected correctly
- ✅ No embedded constraint logic remains

### Task 2.4: Integrate OptimizationEngine (Optional)
- [ ] Add optional fairness optimization step
- [ ] Only run if fairness < 0.7 threshold
- [ ] Make it optional (can disable for v1.0)

**Deliverable**: Optional optimization integration

**Validation**:
- ✅ Optimization improves fairness when enabled
- ✅ Algorithm works without optimization

### Task 2.5: Merge IntelligentScheduler into ConflictResolutionService
- [ ] Read `IntelligentScheduler.ts`
- [ ] Create or update `ConflictResolutionService.ts`
- [ ] Move conflict resolution logic
- [ ] Update all references
- [ ] Remove `IntelligentScheduler.ts`

**Deliverable**: Unified conflict resolution service

**Validation**:
- ✅ Conflict resolution still works
- ✅ No broken references

**Stage 2 Complete When**: Single source of truth for fairness/constraints, no duplication

---

## 🚫 Stage 3: Constraint Enforcement

**Goal**: Constraints actually block invalid saves

### Task 3.1: Backend - Add Constraint Validation to Schedule Routes
- [ ] Update `POST /schedules` to call `constraintEngine.validate()`
- [ ] Update `PUT /schedules/:id` to call `constraintEngine.validate()`
- [ ] Return HTTP 400 if hard constraints violated
- [ ] Return HTTP 200 with warnings if soft constraints violated
- [ ] Get applicable constraints from database

**Deliverable**: Backend blocks invalid saves

**Validation**:
- ✅ Hard constraints return 400 error
- ✅ Soft constraints return 200 with warnings
- ✅ Valid schedules save successfully

### Task 3.2: Frontend - Show Constraint Violations
- [ ] Update create/edit modals to call validation API
- [ ] Display hard constraint violations (block save)
- [ ] Display soft constraint violations (warn, allow override)
- [ ] Add confirmation dialog for soft constraint overrides

**Deliverable**: Frontend shows constraint violations

**Validation**:
- ✅ Hard violations block save with error message
- ✅ Soft violations show warning, user can confirm
- ✅ Valid schedules save without warnings

### Task 3.3: Algorithm - Respect Constraints During Generation
- [ ] Ensure `CoreWeekendRotationScheduler` uses `constraintEngine.validate()`
- [ ] Skip analysts with blackout dates
- [ ] Skip analysts with vacation/absences
- [ ] Log constraint applications

**Deliverable**: Algorithm respects constraints

**Validation**:
- ✅ Algorithm skips constrained analysts
- ✅ Generated schedules pass constraint validation
- ✅ Constraint log shows applications

### Task 3.4: Constraint Management UI Enhancements
- [ ] Add real-time validation when creating constraint
- [ ] Show impact preview: "This will affect X existing schedules"
- [ ] Highlight affected schedules in calendar

**Deliverable**: Enhanced constraint management

**Validation**:
- ✅ Constraint creation shows impact
- ✅ Affected schedules highlighted

**Stage 3 Complete When**: Constraints block invalid manual + algorithmic assignments

---

## ⚠️ Stage 4: Conflict Detection & Auto-Resolution

**Goal**: Auto-detect conflicts, fix auto-resolution

### Task 4.1: Auto-Detect Conflicts After Changes
- [ ] Add conflict detection hook to schedule create/edit/delete
- [ ] Add conflict detection after algorithm generation
- [ ] Add conflict detection after analyst deactivation
- [ ] Add conflict detection after vacation creation
- [ ] Store conflicts in database

**Deliverable**: Automatic conflict detection

**Validation**:
- ✅ Conflicts detected after schedule changes
- ✅ Conflicts detected after algorithm generation
- ✅ Conflicts appear in ConflictManagement UI

### Task 4.2: Fix Auto-Resolution to Persist Changes
- [ ] Update `ConflictResolutionService.resolveConflicts()` to return proposed fixes
- [ ] Create API endpoint `POST /conflicts/resolve` that:
  - Calls resolution service
  - Returns proposed assignments
  - Does NOT save automatically
- [ ] Update frontend to show preview modal
- [ ] Add "Apply Selected" button that saves fixes

**Deliverable**: Auto-fix with preview and apply

**Validation**:
- ✅ Auto-fix generates valid proposals
- ✅ User can preview fixes before applying
- ✅ Applying fixes saves to database
- ✅ Conflicts clear after successful fix

### Task 4.3: Connect Conflict UI to Backend
- [ ] Update `ConflictManagement.tsx` to show auto-detected conflicts
- [ ] Add "Auto-Fix All" button
- [ ] Show preview modal with proposed fixes
- [ ] Allow user to select which fixes to apply
- [ ] Refresh conflicts after applying fixes

**Deliverable**: Working conflict resolution UI

**Validation**:
- ✅ Conflicts display automatically
- ✅ Auto-fix shows preview
- ✅ User can apply selected fixes
- ✅ Conflicts update after fixes applied

**Stage 4 Complete When**: Conflicts auto-detect and auto-resolve end-to-end

---

## 📊 Stage 5: Fairness & Analytics

**Goal**: Enforce fairness, enhance analytics

### Task 5.1: Enforce Fairness During Generation
- [ ] Update `CoreWeekendRotationScheduler` to check fairness score
- [ ] Iterate if fairness < 0.6 threshold (max 100 iterations)
- [ ] Return fairness score with generated schedules
- [ ] Log fairness warnings if threshold not met

**Deliverable**: Algorithm enforces fairness

**Validation**:
- ✅ Algorithm won't generate schedules with fairness < 0.5
- ✅ Fairness score returned with schedules
- ✅ Warnings logged if threshold not met

### Task 5.2: Show Fairness in Schedule Generation UI
- [ ] Update schedule generation preview modal
- [ ] Display fairness score (0-1 scale)
- [ ] Show warning if fairness < 0.6
- [ ] Display overworked/underworked analysts
- [ ] Add "Regenerate with better balance" button

**Deliverable**: Fairness visible in UI

**Validation**:
- ✅ Fairness score displayed
- ✅ Warnings shown for low fairness
- ✅ Regenerate button works

### Task 5.3: Enhance Analytics Dashboard
- [ ] Add monthly tally table: analyst | regular days | screener days | weekends | fairness score
- [ ] Add trend charts: fairness over time (line chart)
- [ ] Add variance trend (bar chart)
- [ ] Add actionable recommendations: "Reduce Bob's screener days by 2"

**Deliverable**: Enhanced analytics

**Validation**:
- ✅ Analytics show workload distribution
- ✅ Recommendations are actionable
- ✅ Charts display correctly

**Stage 5 Complete When**: Fairness enforced, analytics show actionable insights

---

## 🗂️ Stage 6: Service Cleanup

**Goal**: Archive unused services, simplify infrastructure

### Task 6.1: Identify Unused Services
- [ ] Search for `SimpleMLService` usages
- [ ] Search for `PredictiveEngine` usages
- [ ] Search for `WebhookService` usages
- [ ] Search for `SecurityService` usages
- [ ] Search for `MonitoringService` usages
- [ ] Document which are actually used

**Deliverable**: List of unused services

### Task 6.2: Archive Unused Services
- [ ] Create `/backend/src/services/archive/` directory
- [ ] Move unused services to archive (don't delete)
- [ ] Update imports if any exist
- [ ] Add README in archive explaining what's archived and why

**Deliverable**: Unused services archived

**Validation**:
- ✅ No broken imports
- ✅ Application still runs
- ✅ Services preserved in archive

### Task 6.3: Simplify Infrastructure
- [ ] Remove WebSocket subscriptions (keep GraphQL queries/mutations)
- [ ] Simplify Redis caching (keep only for analytics, 5-min TTL)
- [ ] Simplify algorithm plugin architecture (only 1 algorithm exists)

**Deliverable**: Simplified infrastructure

**Validation**:
- ✅ Application still works
- ✅ No unnecessary complexity

**Stage 6 Complete When**: Codebase cleaned, unused services archived

---

## ✅ Stage 7: End-to-End Validation

**Goal**: All 5 critical user flows work

### Task 7.1: Flow 1 - Manual Schedule Creation
- [ ] Test: Open calendar → Month view loads
- [ ] Test: Click empty slot → Modal opens
- [ ] Test: Select analyst, shift, screener → Validate
- [ ] Test: Save → Schedule appears in calendar
- [ ] Test: Database persists schedule

**Validation**: ✅ All steps complete without errors

### Task 7.2: Flow 2 - Algorithm-Generated Schedule
- [ ] Test: Click "Generate Schedule" → Form opens
- [ ] Test: Select dates, algorithm → Click "Preview"
- [ ] Test: Preview shows proposed schedules + fairness score
- [ ] Test: User can uncheck conflicting schedules
- [ ] Test: Click "Apply Selected" → Schedules save
- [ ] Test: Calendar updates, conflicts detected

**Validation**: ✅ Algorithm generates, user can selectively apply

### Task 7.3: Flow 3 - Conflict Auto-Resolution
- [ ] Test: System detects missing schedules
- [ ] Test: Conflicts appear in ConflictManagement tab
- [ ] Test: Click "Auto-Fix All" → Preview modal shows fixes
- [ ] Test: Click "Apply" → Fixes save to database
- [ ] Test: Conflicts disappear, calendar updates

**Validation**: ✅ Conflict resolution end-to-end works

### Task 7.4: Flow 4 - Constraint Enforcement
- [ ] Test: Create constraint (blackout date)
- [ ] Test: Try to manually create schedule → Blocked with error
- [ ] Test: Run algorithm → Skips constrained analyst
- [ ] Test: Constraint validation log shows application

**Validation**: ✅ Constraints prevent invalid assignments

### Task 7.5: Flow 5 - Fairness Feedback Loop
- [ ] Test: Generate 3-month schedule
- [ ] Test: Preview shows fairness score (low)
- [ ] Test: Click "Regenerate with better balance"
- [ ] Test: New preview shows improved fairness
- [ ] Test: Apply → Analytics dashboard shows balanced distribution

**Validation**: ✅ Fairness metrics guide improvement

**Stage 7 Complete When**: All 5 flows work end-to-end

---

## 🎯 Recommended Order

**Start Here**: Stage 0 (Discovery) - Must complete before any changes

**Then**: Stage 1 (Calendar) - Foundation for everything else

**Then**: Stage 3 (Constraints) - Needed for calendar validation

**Then**: Stage 2 (Algorithm) - Can work in parallel with Stage 3

**Then**: Stage 4 (Conflicts) - Depends on calendar + constraints

**Then**: Stage 5 (Fairness) - Depends on algorithm

**Then**: Stage 6 (Cleanup) - Can do anytime, but do last

**Finally**: Stage 7 (Validation) - Must do after all stages

---

## 📝 Notes

- **Agentic Windows**: Each stage can be worked on independently. Complete Stage 0 first, then pick any stage to work on.
- **Validation Gates**: Don't move to next task until current task passes validation.
- **Testing**: Manual testing is sufficient for v1.0. Automated tests can be added later.
- **Documentation**: Update this plan as you discover new dependencies or issues.

---

## 🚀 Getting Started

1. **Start with Stage 0, Task 0.1**: Map calendar components
2. **Create discovery documents** as you go
3. **Validate each task** before moving to next
4. **Update this plan** if you find issues or dependencies

**Remember**: One thing at a time. Validate. Move forward.


