ShiftPlanner v1.0: Brutal Architecture Analysis
Executive Summary
The Core Problem: You can't answer "Can a user create, view, edit, and delete a schedule via the calendar?"

The answer appears to be NO or PARTIALLY. Everything else—GraphQL, WebSockets, ML services, analytics—is irrelevant if this basic flow doesn't work.

Critical Findings
🔴 FATAL FLAWS:

Broken calendar UI - 5 different calendar components, none fully functional
Disconnected scheduling - Algorithm exists but doesn't integrate properly with UI/database
Unenforced constraints - Validation UI exists, backend doesn't block invalid assignments
Incomplete conflict resolution - Detection works, auto-fix is broken
Premature features - Built GraphQL, real-time sync, ML before basic CRUD works
🟡 ARCHITECTURAL DEBT:

Algorithm duplication - Same fairness/constraint logic in 3+ places
UI fragmentation - 5 calendar components fighting each other
Over-abstraction - Plugin registry with 1 plugin, ML service with no training data
Broken data flow - Frontend ↛ Backend ↛ Algorithm ↛ Database (↛ = disconnected)
Part 1: Current State
1.1 What Exists vs. What Works
Component	Claimed Status	Reality	Evidence
Schedule Calendar	✅ Complete	❌ Broken	5 implementations, 
ScheduleView.tsx
 is 861 bytes (stub)
Schedule Generation	✅ Complete	🟡 Partial	Algorithm works standalone, UI integration broken
Analyst Management	✅ Complete	✅ Works	Full CRUD, tested
Vacation/Holiday	✅ Complete	🟡 Partial	Data model works, not integrated into scheduling
Constraint Management	✅ Complete	🟡 Partial	UI exists, validation doesn't block saves
Conflict Detection	✅ Complete	🟡 Partial	Detects conflicts, auto-fix incomplete
Fairness Metrics	✅ Complete	🟡 Partial	Calculations work, not enforced during generation
Analytics	✅ Complete	✅ Works	Stats display correctly
Real-time Collab	✅ Complete	❌ Unused	WebSocket server running, no clients
Mobile/PWA	✅ Complete	❌ Not built	Not implemented
1.2 Code Duplications
Scheduling Algorithms (Duplicated Logic)
File	Size	Purpose	Problem
WeekendRotationAlgorithm.ts
38,678 bytes	Main scheduler	Contains embedded constraint/fairness engines
IntelligentScheduler.ts
360 lines	Conflict resolution	Separate scheduler for gaps, doesn't integrate
FairnessEngine.ts
12,809 bytes	Fairness calculations	Also embedded in WeekendRotationAlgorithm
ConstraintEngine.ts
15,998 bytes	Validation	Also embedded in WeekendRotationAlgorithm
OptimizationEngine.ts
16,144 bytes	Optimization strategies	Partially used
Issue: Constraint and fairness logic exists in both standalone files AND embedded in WeekendRotationAlgorithm. Changes to one don't propagate.

Calendar UI (Competing Implementations)
File	Size	Purpose	Status
ScheduleView.tsx
861 bytes	Main entry	Stub, delegates to SimplifiedScheduleView
SimplifiedScheduleView.tsx
18,107 bytes	Custom calendar	Primary implementation?
ScheduleSnapshot.tsx
9,312 bytes	Weekly snapshot	Used in dashboard
CalendarGrid.tsx
14,623 bytes	Grid layout	Duplicate of SimplifiedScheduleView?
WeekScheduleView.tsx
13,116 bytes	Week view	Yet another implementation
Issue: Unclear which is the "official" calendar. Code split across 5 files. Drag-drop broken, editing partial.

1.3 Missing Core Functionality
Per 
requirements doc
, these MUST work for v1.0:

Schedule Management
❌ FR-2.1-2.3: 5-day work patterns (Sun-Thu, Mon-Fri, Tue-Sat) - Algorithm claims to do, not verified
❌ FR-2.4: Exactly one analyst per shift type per weekend - Not enforced
❌ FR-2.5: 4-day breaks during rotation - Not validated
❌ FR-2.11: Exclude vacationing analysts - Partially implemented
Screener Assignment
❌ FR-3.1-3.2: One screener per shift per weekday - Generated but not validated
❌ FR-3.4: Max 2 consecutive screener days - Not enforced
❌ FR-3.5: Equitable screener distribution - Calculated but not actively balanced
Calendar Interface
❌ FR-6.2: Drag-and-drop adjustments - Broken
❌ FR-6.3-6.5: Visual distinction (screener/shift/weekend) - Partial styling
❌ FR-6.6: Filtering by employee/shift - Not implemented
❌ FR-5.3: Validate manual changes against constraints - Shows warnings, doesn't block
❌ FR-5.4: Preserve original for revert - No history/versioning
1.4 Premature Features (Built Before Core Works)
These exist but shouldn't have been built yet:

GraphQL API (523 lines) - REST suffices for v1.0
WebSocket subscriptions - Real-time for what? Can't edit calendar
SimpleMLService (16,289 bytes) - ML on incomplete schedule data?
PredictiveEngine (13,387 bytes) - Predicts based on broken schedules
WebhookService - External integrations before internal works
SecurityService (15,025 bytes) - RBAC for single-user admin tool
MonitoringService - Monitoring non-functional features
Algorithm Plugin Architecture - Registry for 1 algorithm
Part 2: What To Change & How
Component 1: Calendar UI
Remove:
✂️ 
ScheduleView.tsx
 - 861-byte stub
✂️ 
CalendarGrid.tsx
 OR 
WeekScheduleView.tsx
 (whichever is redundant after investigation)
✂️ 
ScheduleSnapshot.tsx
 (repurpose as dashboard widget only, not a calendar)
Consolidate Into:
Single component: ScheduleCalendar.tsx

Requirements:

Views: Month, Week, Day (toggle buttons)
Display: Regular shifts, screener badges, weekend highlight
Interactions:
Click empty slot → Create schedule modal
Click existing → Edit modal
Drag schedule → Move to new date (with validation)
Right-click → Delete (with confirmation)
Visual Feedback: Loading skeletons, error toasts, success indicators
Styling: Dark mode, muted colors per requirements
How To Build:
Choose base: SimplifiedScheduleView OR build from scratch using modern calendar patterns
Data flow:
Component State ← GET /schedules?startDate=X&endDate=Y
User Action → Validation → POST/PUT/DELETE /schedules/:id
Success → Optimistic UI update + refetch
Error → Rollback + show error toast
Constraint integration:
async function handleCreateSchedule(data) {
  // 1. Client-side validation
  const violations = await api.validateSchedule(data);
  if (violations.hard.length > 0) {
    showError(violations.hard[0].message);
    return;
  }
  if (violations.soft.length > 0) {
    const confirm = await showWarning(violations.soft);
    if (!confirm) return;
  }
  // 2. Create
  await api.createSchedule(data);
}
Success Criteria:
 Single calendar component handles all views
 User can create schedule by clicking
 Drag-and-drop works with validation
 Visual indicators match requirements (shift colors, screener badges)
 Performance: <300ms per interaction
Component 2: Scheduling Algorithms
Remove Duplication:
Current state:

Fairness logic in 2 places: 
FairnessEngine.ts
 + embedded in WeekendRotationAlgorithm
Constraint logic in 2 places: 
ConstraintEngine.ts
 + embedded in WeekendRotationAlgorithm
Two separate schedulers: WeekendRotationAlgorithm + 
IntelligentScheduler
Consolidate To:

WeekendRotationAlgorithm.ts (main)
  ├── uses ConstraintEngine(standalone service)
  ├── uses FairnessEngine (standalone service)
  └── uses OptimizationEngine (optional, for future)
IntelligentScheduler.ts → Merge into ConflictResolutionService
How:
Step 2.1: Extract Embedded Code

Find all fairness calculations in WeekendRotationAlgorithm
Replace with fairnessEngine.calculate(schedules)
Verify tests still pass
Delete embedded code
Step 2.2: Clarify Responsibilities

WeekendRotationAlgorithm: Generates initial schedule assignments
ConstraintEngine: Validates proposed schedules against rules
FairnessEngine: Calculates equity metrics
ConflictResolutionService: Fixes gaps/overlaps after detection
OptimizationEngine: Iteratively improves fairness (optional for v1.0)
Step 2.3: Integration Pattern

class WeekendRotationAlgorithm {
  async generateSchedules(context) {
    // 1. Generate initial assignments
    const proposed = this.assignAnalysts(context);
    
    // 2. Validate constraints (standalone engine)
    const validation = constraintEngine.validate(proposed, context.constraints);
    if (!validation.isValid) {
      proposed = this.adjustForViolations(proposed, validation.violations);
    }
    
    // 3. Calculate fairness (standalone engine)
    const fairness = fairnessEngine.calculate(proposed, context.analysts);
    
    // 4. Optimize if fairness < threshold (optional)
    if (fairness.score < 0.7) {
      proposed = optimizationEngine.improve(proposed, fairness);
    }
    
    return { proposed, fairness, validation };
  }
}
Dependencies To Understand:
Before removing code, trace:

What calls WeekendRotationAlgorithm.generateSchedules()?
Does anything rely on embedded fairness/constraint code?
Are there tests that assume monolithic structure?
Success Criteria:
 Single source of truth for fairness calculations
 Single source of truth for constraint validation
 Algorithm uses standalone engines, no embedded logic
 All existing tests pass
 New schedules generated correctly
Component 3: Constraint Management
Current State:
Frontend: 
ConstraintManagement.tsx
 exists (13,637 bytes)
Backend: /constraints REST endpoints exist
ConstraintEngine.ts
 validates constraints
Problem: Constraints don't block invalid saves
What To Fix:
Frontend Changes:

Add real-time validation warning when creating constraint
Show impact preview: "This constraint will affect X existing schedules"
Backend Changes:

/schedules POST/PUT must call ConstraintEngine.validate() before saving
Return HTTP 400 if hard constraints violated
Return HTTP 200 with warnings if soft constraints violated
Integration:

// backend/src/routes/schedules.ts
router.post('/schedules', async (req, res) => {
  const { analystId, date, shiftType, isScreener } = req.body;
  
  // Get applicable constraints
  const constraints = await prisma.constraint.findMany({
    where: {
      OR: [
        { analystId: analystId },
        { analystId: null }, // global
      ],
      startDate: { lte: date },
      endDate: { gte: date },
      isActive: true,
    }
  });
  
  // Validate
  const violations = constraintEngine.checkScheduleConstraints(
    { analystId, date, shiftType, isScreener },
    existingSchedules,
    constraints
  );
  
  const hardViolations = violations.filter(v => v.severity === 'CRITICAL');
  if (hardViolations.length > 0) {
    return res.status(400).json({
      error: 'Constraint violation',
      violations: hardViolations
    });
  }
  
  // Create schedule
  const schedule = await prisma.schedule.create({ data: req.body });
  
  // Return with soft warnings
  res.json({
    schedule,
    warnings: violations.filter(v => v.severity !== 'CRITICAL')
  });
});
Success Criteria:
 Hard constraints block schedule creation (return 400)
 Soft constraints show warnings but allow save
 Frontend displays constraint violations clearly
 User can override soft constraints with confirmation
 Algorithm respects constraints during generation
Component 4: Conflict Detection & Resolution
Current State:
Detection: 
ConflictDetectionService.ts
 works (10,807 bytes)
Resolution: 
IntelligentScheduler.ts
 exists but poorly integrated
Frontend: 
ConflictManagement.tsx
 displays conflicts
What To Fix:
Problem 1: Auto-Fix Doesn't Apply Changes

IntelligentScheduler.resolveConflicts() returns proposed assignments
But they're never saved to database
Solution:

// frontend/src/components/ConflictManagement.tsx
async function handleAutoFix(conflictIds) {
  // 1. Call resolution service
  const resolution = await api.resolveConflicts(conflictIds);
  
  // 2. Show preview modal
  setProposedFixes(resolution.suggestedAssignments);
  setShowPreview(true);
}
async function applyFixes(selectedFixes) {
  // 3. Save to database
  for (const fix of selectedFixes) {
    await api.createSchedule({
      analystId: fix.analystId,
      date: fix.date,
      shiftType: fix.shiftType,
      isScreener: fix.isScreener,
    });
  }
  
  // 4. Re-detect conflicts
  await refreshConflicts();
}
Problem 2: Conflicts Not Auto-Detected

Detection runs manually via button click
Should run automatically after changes
Solution:

// Run detection after:
// - Manual schedule create/edit/delete
// - Algorithm generation
// - Analyst deactivation
// - Vacation creation
async function onScheduleChange() {
  await api.detectConflicts(startDate, endDate);
  // Conflicts stored in DB, displayed in ConflictManagement
}
Success Criteria:
 Conflicts auto-detect after any schedule change
 Auto-fix generates valid replacement assignments
 User can preview fixes before applying
 Fixes persist to database
 Conflicts clear after successful fix
Component 5: Fairness & Analytics
Current State:
FairnessEngine.ts
 calculates metrics
AnalyticsEngine.ts
 generates reports
DashboardService.ts
 aggregates data
Frontend displays stats in 
Analytics.tsx
Problem: Fairness calculated but not enforced
What To Change:
Enforce During Generation:

// In WeekendRotationAlgorithm
async generateSchedules(context) {
  let proposed = this.initialAssignment(context);
  let fairness = fairnessEngine.calculate(proposed);
  
  // Iterate until fairness acceptable
  let iterations = 0;
  while (fairness.score < 0.6 && iterations < 100) {
    proposed = this.rebalance(proposed, fairness.recommendations);
    fairness = fairnessEngine.calculate(proposed);
    iterations++;
  }
  
  if (fairness.score < 0.6) {
    console.warn('Could not achieve fairness target');
    // Return anyway but flag warning
  }
  
  return { proposed, fairness };
}
Show In UI:

// In schedule generation preview modal
<FairnessScore value={fairness.score} />
{fairness.score < 0.6 && (
  <Warning>
    This schedule is unbalanced. Analysts with excessive workload: {fairness.overworked.join(', ')}
    <Button onClick={regenerate}>Regenerate</Button>
  </Warning>
)}
Analytics Enhancements:

Monthly Tally: Table showing analyst | regular days | screener days | weekends | fairness score
Trend Charts: Fairness over time (line chart), variance trend (bar chart)
Actionable Recommendations: "Reduce Bob's screener days by 2 to improve fairness"
Success Criteria:
 Algorithm won't generate schedules with fairness < 0.5
 User sees fairness warnings before applying
 Analytics identify overworked/underworked analysts
 Recommendations are actionable
Component 6: Services To Remove/Archive
Move to /backend/src/services/archive/ (don't delete, preserve in git):

Service	Reason	v2.0?
SimpleMLService.ts
No training data, premature	Yes - after 6+ months of schedule history
PredictiveEngine.ts
Predictions require stable baseline	Yes - once core is proven
WebhookService.ts
External integrations before internal works	Yes - for calendar sync
SecurityService.ts
RBAC for single-user tool	Yes - multi-user support
MonitoringService.ts
Over-engineered health checks	Simplify to /health endpoint
PerformanceOptimizer.ts
Premature	Yes - if performance issues arise
AlertingService.ts
Complex alerting system	Use simple toast notifications
Infrastructure To Simplify:

Remove:

WebSocket subscriptions (keep GraphQL queries/mutations)
Complex Redis caching strategies (keep only for analytics)
Algorithm plugin architecture (only 1 algorithm exists)
Keep:

REST API (primary)
GraphQL (for complex analytics queries only)
Redis (for analytics caching, 5-minute TTL)
Prisma ORM (works well)
Part 3: End-to-End Flows (Must Work)
These 5 flows MUST complete successfully for v1.0:

Flow 1: Manual Schedule Creation
User opens calendar → Month view loads schedules
Clicks empty slot for next Monday
Modal opens: Select analyst "Alice", shift "MORNING", screener checkbox OFF
System validates: Check vacation, check constraints, check duplicates
Validation passes → Saves to database
Calendar updates immediately, schedule appears
Fairness metrics recalculate in background
Validation: All steps complete without errors, database persists, UI reflects change

Flow 2: Algorithm-Generated Schedule
User clicks "Generate Schedule" from dashboard
Form: Start date (next Monday), end date (+30 days), algorithm "WeekendRotation"
Clicks "Preview"
Algorithm runs, returns proposed assignments + fairness score (0.78)
Modal shows table: 150 proposed schedules, 2 conflicts (highlighted red), fairness good
User unchecks 2 conflicting schedules
Clicks "Apply Selected"
148 schedules save to database
Calendar updates with new schedules
Conflicts tab shows 2 remaining conflicts
Validation: Algorithm generates valid assignments, user can selectively apply, conflicts detected

Flow 3: Conflict Auto-Resolution
System detects 5 missing schedules for next week (no analyst assigned Mon-Fri evenings)
Conflict appears in ConflictManagement tab, severity "CRITICAL"
User clicks "Auto-Fix All"
IntelligentScheduler runs, proposes 5 assignments using ROUND_ROBIN strategy
Preview modal shows proposed fixes
User clicks "Apply"
5 schedules created
Conflicts disappear
Calendar updates
Validation: Conflict resolution end-to-end works

Flow 4: Constraint Enforcement
User creates constraint: Analyst "Alice", type "BLACKOUT_DATE", date "next Friday"
Constraint saves to database
User tries to manually create schedule for Alice on Friday
System blocks with error: "Analyst unavailable due to constraint"
User runs algorithm for next month
Algorithm generates schedules, skips Alice on Friday
Constraint validation log shows constraint was applied
Validation: Constraints prevent invalid manual + algorithmic assignments

Flow 5: Fairness Feedback Loop
User generates 3-month schedule
Preview shows fairness score 0.52 (yellow warning)
Workload distribution: Bob has 15 screener days, Carol has 3 (unbalanced)
User clicks "Regenerate with better balance"
Algorithm runs with fairness optimization
New preview: Fairness 0.81, Bob has 9 screener days, Carol has 8
User applies
Analytics dashboard shows balanced distribution chart
Validation: Fairness metrics guide schedule improvement

Part 4: Quality Criteria
Definition of Done (Per Feature)
A feature is complete when:

 Code works: Implements design, no critical bugs
 Tests pass: Unit + integration tests green
 E2E flow works: User can complete action without errors
 Constraints validated: Requirements met
 Errors handled: Graceful failures with user feedback
 Performance acceptable: <3s for complex operations, <300ms for UI interactions
 Code reviewed: Peer reviewed and approved
Success Criteria for v1.0 Release
Must-Have (Blocking):

 Calendar displays schedules in Month/Week/Day views
 Manual create/edit/delete via calendar
 Algorithm generates valid 1-3 month schedules
 Screener assignments respect constraints
 Vacation/holiday integration prevents invalid assignments
 Constraint management (create, enforce, validate)
 Conflict detection runs automatically
 Auto-fix generates valid replacements
 Fairness metrics calculate and display
 Analytics show workload distribution
 Export to CSV and iCal
 All 5 user flows complete end-to-end
Should-Have (High Priority):

 Drag-and-drop editing
 Fairness warnings during generation
 Historical versioning (undo)
 PDF export for reports
 Keyboard shortcuts
 Comprehensive error handling
 Loading states
Nice-to-Have (v1.1+):

 Multi-algorithm support
 Real-time collaboration
 Mobile-responsive
 ML predictions
 Webhook integrations
 Multi-user RBAC
Part 5: Risks & Dependencies
Critical Dependencies To Understand Before Changes
Before removing algorithm duplication:

Trace all callers of WeekendRotationAlgorithm.generateSchedules()
Identify tests that assume embedded fairness/constraint code
Check if any code directly accesses internal algorithm properties
Before consolidating calendar:

Determine which calendar component is actually used in production
Check if any components are referenced in other modules
Verify drag-and-drop implementation status
Before removing services:

grep -r "SimpleMLService" to find usages
Check GraphQL resolvers for references
Verify no critical dependencies
Risks
Risk 1: Algorithm Doesn't Actually Work

Evidence: Algorithm was built in "Phase 2" but never validated with real calendar
Mitigation: Test algorithm standalone with real data (10 analysts, 30 days)
Acceptance: Algorithm generates valid assignments that respect constraints
Risk 2: Too Much Interdependency

Evidence: Services import each other, unclear boundaries
Mitigation: Create dependency graph before refactoring
Acceptance: Can remove a service without breaking others
Risk 3: Database Has Invalid Data

Evidence: Constraints not enforced, may have impossible schedules
Mitigation: Data validation script, cleanup before launch
Acceptance: All schedules pass constraint validation
Part 6: Implementation Approach
Order of Operations
Stage 1: Understand Current State

Run application, test each feature manually
Document what actually works vs. broken
Create dependency graph (which services call which)
Identify orphaned code (not called anywhere)
Stage 2: Consolidation

Algorithm consolidation (remove embedded engines)
Calendar consolidation (pick one, remove others)
Service cleanup (archive unused)
Test after each consolidation
Stage 3: Core Functionality

Fix calendar CRUD
Integrate constraints with save operations
Connect algorithm to UI properly
Verify fairness calculations
Stage 4: Conflict Management

Auto-detect after changes
Fix auto-resolution
Connect to UI
Stage 5: Polish

Visual styling per requirements
Error handling
Loading states
Export functionality
Stage 6: Validation

Test all 5 user flows
Performance testing
Constraint edge cases
Fairness verification
Testing Strategy
Unit Tests:

Algorithm logic (weekend rotation, fairness calculation)
Constraint validation rules
Conflict detection logic
Integration Tests:

API endpoints (create/edit/delete schedules)
Database operations (constraints enforced)
Service interactions (algorithm → constraint → fairness)
E2E Tests:

5 critical user flows above
Run against staging database
Automated via Playwright or Cypress
Part 7: Appendix - Files To Analyze
High Priority (Must Understand)
Algorithms:

/backend/src/services/scheduling/algorithms/WeekendRotationAlgorithm.ts
 (38KB monster)
/backend/src/services/scheduling/algorithms/ConstraintEngine.ts
/backend/src/services/scheduling/algorithms/FairnessEngine.ts
/backend/src/services/IntelligentScheduler.ts
Calendar:

/frontend/src/components/calendar/simplified/SimplifiedScheduleView.tsx
/frontend/src/components/calendar/simplified/CalendarGrid.tsx
/frontend/src/components/ScheduleView.tsx
 (stub?)
/frontend/src/components/ScheduleSnapshot.tsx
API:

/backend/src/routes/algorithms.ts
 (schedule generation endpoint)
/backend/src/routes/calendar.ts
/backend/src/routes/constraints.ts
Conflict:

/backend/src/services/conflict/ConflictDetectionService.ts
/frontend/src/components/ConflictManagement.tsx
Database:

/backend/prisma/schema.prisma
 (understand constraints)
Conclusion
Key Insight: This project followed "phase-by-phase" execution (Phase 1: DB, Phase 2: Algorithm, Phase 3: GraphQL, etc.) without validating basic user flows between phases.

Result: "All 6 phases complete!" but user can't create a schedule via calendar.

The Fix: Focus on component consolidation and end-to-end validation:

One calendar component
One scheduling algorithm (using standalone engines)
Constraints that actually block invalid saves
Conflicts that auto-resolve properly
Five user flows that work end-to-end
Remove premature features (ML, WebSockets, complex monitoring). Archive, don't delete (Git keeps history).

Philosophy: Prove basic flows work before adding advanced features. Every change must result in a working user flow, not just "code complete."

Status: Analysis complete - awaiting user validation of findings and clarification of v1.0 goals