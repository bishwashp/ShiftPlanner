# Absence Handling Implementation Plan

Comprehensive implementation of intelligent absence management system for ShiftPlanner based on research findings. This plan addresses the critical gap where absences are tracked but not integrated with scheduling, fairness, or coverage logic.

## User Review Required

> [!NOTE]
> **Policy Decisions Incorporated**
> 
> - **Fairness Philosophy**: Fairness debt is ONLY applied for **Planned Vacations**. Sick leave and emergencies do not incur debt.
> - **Approval Authority**: **Manager approval is mandatory** for all requests. No auto-approval.
> - **Leave Request System**: A dedicated "Leave Request" mechanism will be built (role-ready for future analyst access).
> - **Replacement Notification**: Internal manager confirmation only. No external notifications.
> - **Cross-Shift Policy**: Emergency coverage will utilize the existing **AM-to-PM rotation logic** (increasing the rotation pool size) rather than a separate protocol.
> - **Debt Repayment**: **ASAP** - Debt repayment is prioritized immediately in the next available schedule.
> - **Pattern Analysis**: 6-month lookback period.

> [!WARNING]
> **Breaking Changes**
> 
> - **Database Schema**: New tables for `FairnessDebt`, `ReplacementAssignment`, `AbsenceImpactAnalysis`
> - **API Changes**: `AbsenceService` will trigger scheduling side-effects (replacement creation, fairness tracking)
> - **Scheduling Engine**: Will query `AbsenceService` during generation (performance impact on large date ranges)
> - **Analytics Recalculation**: Historical fairness metrics may change when retroactive absence correction is enabled

---

## Proposed Changes

### Phase 1: Foundation & Critical Fixes

**Priority**: CRITICAL  
**Duration**: 2 weeks  
**Dependencies**: None

#### Database Schema

##### [NEW] FairnessDebt Model
- **Purpose**: Track workload debt/credit from missed shifts and absence coverage
- **Key Fields**: `analystId`, `absenceId`, `debtAmount` (float), `reason`, `resolvedAt`
- **Relationships**: Links to `Analyst` and `Absence` models
- **Indexes**: Composite index on `(analystId, resolvedAt)` for active debt queries
- **Logic Change**: Only created if `Absence.type === 'VACATION'` (or `isPlanned === true`).

##### [NEW] ReplacementAssignment Model
- **Purpose**: Track which analyst replaced whom for each absence day
- **Key Fields**: `originalAnalystId`, `replacementAnalystId`, `date`, `status`, `reassignmentChain`
- **Relationships**: Links to `Analyst` (original and replacement)
- **Status Enum**: `ACTIVE`, `REASSIGNED`, `CANCELLED`

##### [MODIFY] Absence Model
- **Add Fields**: 
  - `isPartialDay` (boolean) - for partial-day absences
  - `startTime`, `endTime` (string) - for partial-day time tracking
  - `fractionalUnits` (float) - fairness weight for partial absences
  - `excludedHolidayDates` (string array) - holidays within absence period
  - `workDaysCount` (int) - calculated work days excluding holidays
  - `impactScore` (enum: LOW/MEDIUM/HIGH/CRITICAL) - pre-calculated impact

---

#### Backend Services

##### [MODIFY] [IntelligentScheduler.ts](file:///Users/bishwash/Documents/GitHub/ShiftPlanner/backend/src/services/IntelligentScheduler.ts#L235-L238)
**Critical Bug Fix**: Replace deprecated `analyst.vacations` field with `AbsenceService` integration

- **Lines 235-238**: Replace vacation check with `await this.absenceService.isAnalystAbsent(analyst.id, dateStr)`
- **Lines 255-258**: Same fix for evening analysts
- **Impact**: Ensures all absence types (vacation, sick leave, emergency) are respected during schedule generation

##### [MODIFY] [IntelligentScheduler.ts](file:///Users/bishwash/Documents/GitHub/ShiftPlanner/backend/src/services/IntelligentScheduler.ts#L289-L310)
**Screener Assignment Fix**: Filter absent analysts from screener pool

- **Current Issue**: Screener round-robin doesn't check availability
- **Solution**: Before screener assignment, filter `daySchedules` to exclude analysts with approved absences
- **Fairness Preservation**: Do NOT increment screener index for skipped (absent) analysts

##### [MODIFY] [IntelligentScheduler.ts](file:///Users/bishwash/Documents/GitHub/ShiftPlanner/backend/src/services/IntelligentScheduler.ts#L206-L244)
**AM-to-PM Rotation Fix**: Check absence before rotation assignment

- **Current Issue**: `amToPmRotationMap` planned without absence validation
- **Solution**: After rotation planning, validate each rotated analyst's availability
- **Fallback**: If rotated analyst is absent, select next available AM analyst in rotation sequence

##### [NEW] FairnessDebtService
- **Purpose**: Manage creation, tracking, and resolution of fairness debt
- **Key Methods**:
  - `createDebt(analystId, amount, reason, absenceId?)` - Record new debt
    - **Logic**: Check absence type. If `SICK_LEAVE` or `EMERGENCY`, amount = 0. Only `VACATION` incurs debt.
  - `createCredit(analystId, amount, reason)` - Record credit for covering absence (Always applies, regardless of absence type)
  - `getActiveDebt(analystId)` - Get current unresolved debt
  - `resolveDebt(debtId)` - Mark debt as repaid
  - `calculateAbsenceDebt(absence)` - Calculate weighted debt from absence (weekend weight, screener weight, etc.)

---

### Phase 2: Replacement Logic & Assignment

**Priority**: HIGH  
**Duration**: 2 weeks  
**Dependencies**: Phase 1 (FairnessDebt schema, absence integration)

#### Backend Services

##### [MODIFY] [AbsenceService.ts](file:///Users/bishwash/Documents/GitHub/ShiftPlanner/backend/src/services/AbsenceService.ts#L33-L92)
**Absence Creation Enhancement**: Trigger replacement assignment on approval

- **Integration Point**: After absence is created and approved
- **New Flow**: 
  1. Calculate absence impact (work days, shift types affected)
  2. For each affected day, call `ReplacementService.findReplacement()`
  3. Create `ReplacementAssignment` records
  4. Create `FairnessDebt` for absent analyst (if Vacation)
  5. Create `FairnessCredit` for replacement analysts
- **Rollback**: If replacement fails for critical shifts (weekend/screener), flag for manual review

##### [NEW] ReplacementService
**Purpose**: Intelligent selection of replacement analysts for absences

**Key Methods**:

- `findReplacement(date, shiftType, originalAnalyst, replacementType)` 
  - **Scoring Factors**:
    - Current workload fairness (prefer lower workload)
    - Recent coverage duty count (penalize if covered many absences recently)
    - Consecutive work days (avoid burnout: veto if ≥7 days, penalize if ≥5)
    - Weekend/screener fairness (prioritize analysts due for these high-weight shifts)
    - Fairness debt (prioritize analysts who "owe" team)
  - **Returns**: `{ analystId, confidence, concerns[] }` or `null` if no viable candidate

- `distributeMultiDayReplacement(absence)` - For absences >3 days, distribute across multiple analysts
  - **Strategy**: Weighted round-robin to prevent single analyst from bearing full burden
  - **Max Coverage**: Limit any analyst to covering max 3 consecutive days from one absence

- `handleSecondaryAbsence(replacementAssignment)` - Cascade: when replacement analyst also becomes absent
  - **Detection**: Check if any active `ReplacementAssignment` has replacement analyst now absent
  - **Action**: Mark original as `REASSIGNED`, find secondary replacement (exclude both original and first replacement)
  - **Alert Threshold**: If chain length >3, escalate to manual manager review

- `validateReplacementConstraints(analyst, date)` - Check if assignment violates constraints
  - Consecutive day limits
  - Maximum workload thresholds
  - Shift type compatibility

##### [MODIFY] [ScoringEngine.ts](file:///Users/bishwash/Documents/GitHub/ShiftPlanner/backend/src/services/scheduling/algorithms/ScoringEngine.ts)
**Enhanced Scoring**: Integrate debt repayment into analyst ranking

- **New Factor**: "Debt Repayment Boost" (ASAP Priority)
  - If analyst has debt >0: +50 score (Immediate priority to repay)
  - If analyst has credit >2.0 units: -15 score (earned rest)
- **Burnout Prevention**: Even with high debt, reduce score by -20 if assignment would create >5 consecutive days
- **Integration Point**: Add to existing `calculateScores()` method after fatigue/consecutive calculations

---

### Phase 3: Analytics & Decision Support

**Priority**: MEDIUM  
**Duration**: 2 weeks  
**Dependencies**: Phase 2 (ReplacementService, FairnessDebt tracking)

#### Backend Services

##### [NEW] AbsenceImpactAnalyzer
**Purpose**: Pre-calculate impact metrics for absence approval workflow

**Key Methods**:

- `analyzeAbsenceImpact(absenceData)` - Returns comprehensive impact report
  - **Team Availability**: Calculate % of team available during absence period
  - **Coverage Risk**: Classify as AUTO/MANUAL/IMPOSSIBLE based on replacement confidence
  - **Fairness Impact**: Calculate how much absence shifts fairness distribution (stddev change)
  - **Rotation Disruption**: Check if absence breaks weekend or screener rotation patterns
  - **Concurrent Absences**: Detect overlapping absences and calculate cumulative impact

- `generateReplacementPlan(absence)` - For each day of absence:
  - Call `ReplacementService.findReplacement()`
  - Aggregate confidence scores
  - Identify dates with low confidence (<70%) or no viable replacement
  - Flag concerns (consecutive days, recent coverage, etc.)

- `getAnalystAbsenceHistory(analystId, period)` - Historical context for approval
  - YTD days taken (by type: vacation, sick, personal, emergency)
  - Average absence duration
  - Last absence date
  - Comparison to team average (+/- days)

- `generateApprovalRecommendation(impactAnalysis)` - Rule-based recommendation
  - **APPROVE**: Low impact, replacements found with high confidence
  - **APPROVE_WITH_CONDITIONS**: Moderate impact but manageable
  - **SUGGEST_RESCHEDULE**: High impact, suggest alternative dates with lower impact
  - **DENY**: Critical impact (insufficient staff, impossible coverage, blackout period)
  - **NOTE**: All recommendations require manual manager confirmation.

##### [NEW] AbsencePatternAnalyzer
**Purpose**: Detect potential abuse or concerning patterns

**Key Methods**:

- `analyzePatterns(analystId, lookbackPeriod)` - Statistical analysis
  - **Lookback**: Defaults to 6 months (configurable)
  - **Day-of-Week Preference**: Count absences by day (detect Monday/Friday clustering)
  - **Adjacent to Weekend**: % of absences touching weekends
  - **Last-Minute Frequency**: % of requests with <3 days notice
  - **Repeating Dates**: Same calendar dates each year (e.g., always Dec 26)
  - **Suspicion Score**: 0-100 calculated as:
    - (Adjacent to Weekend %) × 40
    - (Max Day-of-Week %) × 60
  - **Recommendation**: NORMAL (<40), REVIEW (40-70), ALERT_MANAGER (>70)

- `compareToTeamNorms(analystId)` - Benchmark against team
  - Absence frequency (total days/year)
  - Average duration per absence
  - Type distribution (vacation vs sick leave ratio)
  - Unplanned absence rate

##### [NEW] HolidayAbsenceIntegrator
**Purpose**: Detect and handle holiday overlap with absences

**Key Methods**:

- `detectHolidayOverlap(absence)` - Check if absence spans any holidays
  - Query `HolidayService` for each date in absence range
  - Return list of overlapping holiday dates

- `adjustAbsenceForHolidays(absence)` - Recalculate absence metrics
  - Exclude holiday dates from `workDaysCount`
  - Adjust `fractionalUnits` for fairness calculation
  - Update absence description: "5 calendar days (4 work days - excludes Memorial Day)"

---

#### Frontend Components

##### [NEW] LeaveRequestForm Component
**Purpose**: Interface for analysts (simulated role) to submit leave requests.
**Features**:
- Date range picker
- Type selector (Vacation, Sick, etc.)
- Reason input
- "Submit for Approval" action
- Pre-submission check: "You have 2 pending requests"

##### [NEW] AbsenceApprovalDashboard Component
**Purpose**: Manager view for reviewing absence requests with impact analysis

**Key Features**:
- List of pending absence requests (sorted by impact score)
- For each request, display:
  - Analyst name, dates, type, duration
  - **Impact Score Badge**: Color-coded (green/yellow/orange/red)
  - Team availability % during period
  - Replacement plan table (date, suggested analyst, confidence, concerns)
  - Historical context (analyst's YTD absences vs team avg)
  - System recommendation (Approve/Conditional/Reschedule/Deny)
- One-click actions: Approve, Deny, Request Alternative Dates
- **No Auto-Approval**: All requests require explicit action.

##### [NEW] AbsenceImpactReport Component
**Purpose**: Detailed impact visualization for single absence request

**Key Sections**:
1. **Impact Summary**: Overall risk level, team availability, coverage feasibility
2. **Replacement Plan**: Table with date, shift type, suggested replacement, confidence score, warnings
3. **Fairness Analysis**: 
   - Current analyst workload vs average
   - Projected workload after absence
   - Debt amount that will be created (if Vacation)
   - Suggested repayment plan (e.g., "Assign 2 weekend shifts in next month")
4. **Historical Context**: Charts showing analyst's absence patterns, comparison to team
5. **Concurrent Absences**: List of other analysts also absent during overlapping dates
6. **Recommendations**: System-generated suggestions with reasoning

##### [MODIFY] [Analytics.tsx](file:///Users/bishwash/Documents/GitHub/ShiftPlanner/frontend/src/components/Analytics.tsx)
**Enhanced Fairness Metrics**: Integrate absence debt tracking

**New Visualizations**:
- **Fairness Debt/Credit Chart**: Bar chart showing each analyst's current debt balance (negative = debt, positive = credit)
- **Coverage Burden Chart**: Count of times each analyst covered others' absences in selected period
- **Absence Utilization**: Days taken by type (vacation, sick, personal) vs team average
- **Workload Adjustment View**: Show actual worked days vs scheduled days (accounting for absences)

**Filters**:
- Toggle: "Include Absence Impact" (show fairness with vs without absence adjustments)
- Absence Type Filter: Show only specific absence types in metrics

---

### Phase 4: Advanced Features & Edge Cases

**Priority**: LOW  
**Duration**: 2 weeks  
**Dependencies**: Phase 3 (Analytics integration complete)

#### Backend Services

##### [NEW] SwapService
**Purpose**: Enable analyst-to-analyst shift swapping as alternative to replacement

**Key Methods**:

- `findSwapPartner(absentAnalyst, absenceDate, shiftType)` - Intelligent swap matching
  - **Eligibility**: Same shift type, same week, both benefit from fairness perspective
  - **Constraint Validation**: Ensure swap doesn't violate consecutive day limits for either party
  - **Mutual Benefit Scoring**: Rank by combined fairness improvement
  - **Returns**: Best swap candidate or `null`

- `proposeSwap(analystA, dateA, analystB, dateB)` - Create swap proposal
  - Validate both sides
  - Calculate fairness impact
  - Generate notification for both analysts and manager
  - Create pending swap record (awaits approval)

- `executeSwap(swapId)` - Apply approved swap
  - Update both schedule records (swap `analystId` values)
  - Update rotation tracking if applicable
  - Log swap in audit trail

- `validateSwap(swapProposal)` - Check constraints before execution
  - No circular swaps (A→B→C→A)
  - Both analysts available on swapped dates
  - No constraint violations (max consecutive days, workload limits)

##### [NEW] RetroactiveAbsenceService
**Purpose**: Handle absences entered after the fact (e.g., unreported sick day)

**Key Methods**:

- `applyRetroactiveAbsence(absence)` - Correct past schedules
  - Find all schedules for analyst during absence period
  - Mark schedules as `status: 'ABSENT'`, flag `retroactivelyMarked: true`
  - **Do NOT delete** - preserve history for audit
  - Create `FairnessDebt` record (if Vacation)

- `identifyCoverageProvider(affectedSchedules)` - Detective work
  - Check if another analyst was assigned to cover (manual assignment)
  - If found, create `FairnessCredit` for that analyst
  - If not found, flag as "unresolved coverage gap"

- `recalculateAnalytics(startDate, endDate)` - Trigger analytics refresh
  - Invalidate cached analytics for affected period
  - Recalculate fairness metrics, workload distribution
  - Update charts to reflect corrected data

##### [NEW] EmergencyRotationService (formerly EmergencyCoverageService)
**Purpose**: Handle insufficient PM coverage by adjusting rotation pool

**Key Methods**:

- `adjustRotationForCoverage(date, targetPmCount)` 
  - **Logic**: If PM coverage < target (due to absence), increase the number of AM analysts rotated to PM for that day.
  - **Mechanism**: Call `RotationManager.planAMToPMRotation` with increased target.
  - **Fairness**: Rotated AM analysts get standard rotation credit (no special "emergency" bonus needed, as it's part of standard duties).

- `notifyEmergencyEscalation(situation)` - Manager alert
  - Triggered when even expanded rotation pool is insufficient
  - Email/SMS alert with situation summary
  - Provide manual assignment interface

##### [MODIFY] AbsenceService
**Enhanced Absence Types**: Special handling for non-penalized absences

- **Non-Penalized Types**: `SICK_LEAVE`, `EMERGENCY`, `BEREAVEMENT`, `JURY_DUTY`, `MEDICAL_EMERGENCY`
- **Fairness Impact**: These types create `debtAmount: 0` in `FairnessDebt`
- **Replacement**: Still trigger replacement coverage (coverage needed, but no debt)
- **Analytics**: Track separately - show "Total absences" vs "Fairness-adjusted absences"

##### [NEW] AbsenceApprovalPolicyService
**Purpose**: Configurable approval rules (Manager Only)

**Policy Configuration**:
- Blackout periods (date ranges where approvals require manual review)
- Min staff thresholds

**Key Methods**:

- `evaluateApproval(absence, impactAnalysis)` - Apply policy rules
  - Check deny rules first (blackout period, insufficient staff threshold)
  - Return: `PENDING_REVIEW` (Default), `DENY`

- `updatePolicy(policyChanges)` - Manager configuration interface
  - Validate policy constraints (e.g., min notice can't be negative)
  - Update policy config in database
  - Log policy changes for audit

---

#### Frontend Components

##### [NEW] AbsenceSwapInterface Component
**Purpose**: Analyst self-service for proposing shift swaps

**Features**:
- **My Shifts View**: Calendar showing analyst's assigned shifts
- **Swap Request**: Select a shift to swap, view eligible swap partners
- **Partner Matching**: Show analysts working different days in same week, display mutual benefit score
- **Swap Proposals**: View pending swap requests (incoming and outgoing)
- **One-Click Acceptance**: Approve incoming swap proposals

##### [NEW] AbsencePatternReport Component
**Purpose**: Manager view of analyst absence patterns and potential issues

**Visualizations**:
- Heat map: Day-of-week absence frequency for each analyst
- Timeline: Absence history with pattern highlights (clustering, adjacent to weekends)
- Comparison charts: Analyst absence metrics vs team averages
- Suspicion score dashboard: Analysts flagged for review with reasoning

##### [NEW] RetroactiveAbsenceTool Component
**Purpose**: Admin interface for entering past absences

**Features**:
- Date picker for absence period (with visual indicator showing "past dates")
- Analyst selector
- Absence type selector with auto-detection (if scheduled shift exists, mark as retroactive)
- Impact preview: "This will create 2.5 units of debt and invalidate 3 days of analytics"
- Coverage resolution: If coverage gap, provide interface to assign who actually covered
- Analytics recalculation: Option to trigger immediate or batch recalculation

---

## Verification Plan

### Automated Tests

#### Phase 1 Tests
- **Absence Integration Tests**:
  - Generate schedule with active absence → verify analyst excluded from all shifts during absence period
  - Generate schedule with absence on weekend rotation day → verify rotation continues without gap
  - Generate screener assignments with absent analyst → verify screener index preserved (not incremented for absent)

- **Fairness Debt Tests**:
  - Create VACATION absence → verify debt record created
  - Create SICK_LEAVE absence → verify NO debt record created
  - Weekend absence → verify debt = base day weight + weekend multiplier
  - Screener day absence → verify debt includes screener penalty weight

- **AM-to-PM Rotation Tests**:
  - Absence on AM-to-PM rotation day → verify next AM analyst in sequence assigned to PM instead

#### Phase 2 Tests
- **Replacement Selection Tests**:
  - Single-day absence → verify replacement found with >70% confidence
  - Multi-day absence (5 days) → verify distribution across multiple analysts (no single analyst covers all 5)
  - Weekend absence → verify replacement selected from analysts with low weekend count
  - No viable replacement → verify returns `null` and flags for manual review

- **Replacement Constraint Tests**:
  - Replacement would create 6 consecutive days → verify rejected (score <50)
  - Replacement with high recent coverage count (3 in last 30 days) → verify score penalty applied

- **Cascade Absence Tests**:
  - Replacement analyst becomes absent → verify secondary replacement found
  - Chain length >3 → verify escalation alert generated

#### Phase 3 Tests
- **Impact Analysis Tests**:
  - Absence with concurrent absence (2 analysts out) → verify impactScore = HIGH
  - Absence spanning holiday → verify workDaysCount excludes holiday

- **Pattern Detection Tests**:
  - 8/12 absences on Monday → verify suspicion score >70
  - Absence adjacent to weekend (Friday) → verify pattern flag
  - Normal distribution → verify suspicion score <40

- **Holiday Integration Tests**:
  - Absence spanning Memorial Day → verify day excluded from fairness calculation
  - 5 calendar days with 1 holiday → verify workDaysCount = 4

#### Phase 4 Tests
- **Swap Validation Tests**:
  - Valid swap (both available, no constraint violations) → verify swap executes successfully
  - Swap creates consecutive 7 days for one party → verify validation fails
  - Circular swap (A→B→C→A) → verify detection and rejection

- **Retroactive Absence Tests**:
  - Enter absence for past date with existing schedule → verify schedule marked `ABSENT`, debt created (if Vacation)
  - Retroactive absence with identified coverage → verify coverage analyst receives credit

- **Emergency Coverage Tests**:
  - All same-shift analysts absent → verify cross-shift search triggered
  - Cross-shift replacement found → verify 2x fairness credit applied
  - No replacement at any tier → verify manager escalation alert

### Manual Verification

#### Phase 1 Verification
1. **Absence Integration Check**:
   - Create approved absence for Analyst A (Nov 15-17)
   - Generate schedule for Nov 1-30
   - Verify: Analyst A has zero assignments on Nov 15, 16, 17
   - Verify: Rotation continues normally for Nov 18+

2. **Fairness Debt Tracking**:
   - Create weekend VACATION for Analyst B → Verify Debt created
   - Create weekend SICK LEAVE for Analyst C → Verify NO Debt created
   - Generate next month's schedule
   - Verify: Analyst B assigned to weekend shift (debt repayment)

#### Phase 2 Verification
1. **Replacement Assignment**:
   - Create absence for Analyst C (single day, regular weekday)
   - Approve absence
   - Check: Verify `ReplacementAssignment` record created
   - Check: Verify replacement analyst has fairness credit
   - Verify: Schedule shows replacement analyst assigned for that day

2. **Multi-Day Distribution**:
   - Create 5-day absence for Analyst D
   - Approve absence
   - Check replacement assignments: Verify spread across 2-3 different analysts
   - Verify: No single analyst covers more than 3 days

#### Phase 3 Verification
1. **Approval Dashboard**:
   - Navigate to Absence Approval Dashboard
   - Create test absence with high impact (overlapping with another absence)
   - Verify: Impact score shows CRITICAL
   - Verify: Replacement plan shows low confidence for overlapping dates
   - Verify: System recommendation = SUGGEST_RESCHEDULE or DENY

2. **Analytics Integration**:
   - Navigate to Analytics page
   - Verify: New "Fairness Debt/Credit" chart visible
   - Verify: Analysts with absences show debt bars
   - Verify: Analysts who covered absences show credit bars
   - Toggle "Include Absence Impact" filter → verify metrics update

#### Phase 4 Verification
1. **Swap Interface**:
   - Login as Analyst E
   - Navigate to swap interface
   - Select assigned shift, view swap partners
   - Propose swap to Analyst F
   - Login as Analyst F → verify swap proposal visible
   - Accept swap → verify schedules updated for both

2. **Retroactive Absence**:
   - Navigate to retroactive absence tool
   - Enter absence for 3 days ago (past date)
   - Verify: Warning message about analytics impact
   - Submit → verify schedule marked ABSENT
   - Navigate to analytics → verify metrics updated

---

## Database Migration Strategy

### Migration 1: Core Schema (Phase 1)
- Add `FairnessDebt` table
- Add `ReplacementAssignment` table  
- Modify `Absence` table (add partial-day fields, impact score)
- Create indexes for performance

### Migration 2: Analytics Tables (Phase 3)
- Add `AbsenceImpactAnalysis` table (cache impact calculations)
- Add `AbsencePattern` table (cache pattern analysis results)

### Migration 3: Advanced Features (Phase 4)
- Add `SwapProposal` table
- Add `AbsenceApprovalPolicy` table
- Modify `Schedule` table (add retroactive flags, status enum)

### Rollback Plan
- Each migration has corresponding down migration
- Phase 1 migration must be tested thoroughly before Phase 2 (foundational)
- If Phase 2+ fails, can rollback without affecting Phase 1 functionality

---

## Performance Considerations

### Query Optimization
- **Absence Checking**: Currently queries database for each analyst on each date
  - **Optimization**: Batch fetch all absences for date range at start of scheduling
  - **Caching**: Cache absence lookup map in memory during schedule generation
  - **Expected Improvement**: 10x faster for 3-month schedule generation

### Replacement Search
- **Current Risk**: O(n²) complexity (for each absence day, check all analysts)
  - **Optimization**: Pre-filter analysts by shift type and date availability
  - **Limiting**: Max 50 candidates per replacement search
  - **Expected**: <200ms per replacement search

### Analytics Recalculation
- **Retroactive Absences**: Could trigger expensive analytics recalculation
  - **Strategy**: Queue recalculation as background job
  - **Batch Processing**: If multiple retroactive absences entered, batch recalculate once
  - **Partial Recalculation**: Only recalculate affected date range, not entire history

---

## Risk Mitigation

### Technical Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Performance degradation on large schedules | HIGH | Batch absence queries, cache results, implement pagination |
| Replacement algorithm fails to find candidates | HIGH | Implement fallback tiers, require manual review flagging |
| Circular replacement chains (A covers B, B absent, C covers A) | MEDIUM | Track reassignment chain length, veto if >3, alert manager |
| Retroactive absence invalidates reports | MEDIUM | Preserve original data, mark as corrected, show both views |
| Race condition: absence approved while schedule generating | LOW | Use database transactions, lock during critical sections |

### User Experience Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Managers overwhelmed by complex approval dashboard | MEDIUM | Start with simple workflow, progressive disclosure of details |
| Analysts confused by fairness debt concept | MEDIUM | Clear explanations, show "why" behind assignments |
| Replacement analysts feel burdened | HIGH | Cap coverage duty (max 3/month), provide bonus credit, transparency |
| Auto-approval creates unforeseen coverage gaps | HIGH | Conservative initial policy (require manager review), gradual rollout |

---

## Rollout Strategy

### Beta Phase (Week 1-2)
- **Scope**: Single team (MORNING shift only)
- **Features**: Phase 1 only (absence integration, debt tracking)
- **Monitoring**: Daily review of absence handling, collect manager feedback
- **Success Criteria**: 
  - Zero coverage gaps from absences
  - Fairness debt tracking accurate
  - No performance degradation

### Pilot Phase (Week 3-4)
- **Scope**: All shifts, limited absence types (vacation only)
- **Features**: Phase 1 + Phase 2 (replacement logic)
- **Monitoring**: Track replacement confidence scores, manual override rate
- **Success Criteria**:
  - >80% automatic replacement success
  - <10% manual override rate
  - Manager satisfaction with replacement quality

### Full Rollout (Week 5-8)
- **Scope**: All teams, all absence types
- **Features**: All phases
- **Monitoring**: Full analytics dashboard, pattern detection alerts
- **Success Criteria**:
  - Auto-approval rate >50% (for eligible absences)
  - Fairness distribution stddev <15% (accounting for absences)
  - Zero critical coverage gaps

---

## Open Questions for Development

1. **Notification Channels**: Should replacement notifications use email, SMS, in-app, or all three?
2. **Replacement Opt-Out**: Can analysts opt-out of covering absences (with fairness penalty)?
3. **Swap Expiration**: How long should swap proposals remain pending before auto-rejection?
4. **Debt Forgiveness**: Should fairness debt expire after certain period (e.g., end of quarter)?
5. **Coverage Limits**: Hard cap on how many absences one analyst can cover per month/quarter?
6. **Historical Data**: Should we retroactively calculate debt for past absences when system launches?
