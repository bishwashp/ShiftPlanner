# Absence Handling Research & Strategy
## ShiftPlanner - Comprehensive Analysis

> [!IMPORTANT]
> This document analyzes the current absence handling implementation and proposes a comprehensive strategy for managing ad-hoc leaves, vacations, sick leave, and holidays while maintaining schedule fairness and rotation integrity.

---

## Executive Summary

**Current State**: ShiftPlanner has a basic `AbsenceService` with conflict detection and approval mechanisms. However, it operates in **isolation** from the core scheduling engine. Absences are filtered during schedule generation but do not trigger:
- Fairness recalculation
- Automatic shift coverage
- Rotation adjustment
- Workload rebalancing

**Key Finding**: The system is **reactive** rather than **proactive**. When an absence is approved, affected shifts become coverage gaps without intelligent replacement or fairness compensation.

---

## 1. Current Implementation Assessment

### 1.1 What Exists

#### AbsenceService Capabilities
- ✅ Create, update, delete absences
- ✅ Track absence types (VACATION, SICK_LEAVE, PERSONAL, EMERGENCY, TRAINING, CONFERENCE)
- ✅ Detect overlapping absences for same analyst
- ✅ Check for insufficient staff (when total available < 2)
- ✅ Identify schedule conflicts (existing shifts during absence period)
- ✅ Approval workflow (`isApproved` flag)
- ✅ Planned vs unplanned tracking (`isPlanned` flag)

#### Integration with Scheduling
From [IntelligentScheduler.ts](file:///Users/bishwash/Documents/GitHub/ShiftPlanner/backend/src/services/IntelligentScheduler.ts#L609-L611):
```typescript
private async isAnalystAbsent(analystId: string, date: string): Promise<boolean> {
  return await this.absenceService.isAnalystAbsent(analystId, date);
}
```

**Current Usage**: Lines 616-635 show `getAvailableAnalysts()` filters out absent analysts during conflict resolution, but this is **NOT used during initial schedule generation**.

**Critical Gap**: Lines 235-238 and 255-258 show regular schedule generation still uses deprecated `analyst.vacations` field, not the `AbsenceService`:
```typescript
const onVacation = analyst.vacations?.some((v: any) =>
  moment(v.startDate).isSameOrBefore(currentMoment, 'day') &&
  moment(v.endDate).isSameOrAfter(currentMoment, 'day')
) || false;
```

### 1.2 What's Missing

| **Capability** | **Status** | **Impact** |
|---|---|---|
| Absence-aware initial scheduling | ❌ Missing | Generates invalid schedules |
| Fairness adjustment post-absence | ❌ Missing | Unfair workload distribution |
| Automatic shift replacement | ❌ Missing | Coverage gaps |
| Rotation continuity preservation | ❌ Missing | Rotation desynchronization |
| Analytics-driven approval insights | ❌ Missing | Blind approval decisions |
| Cascading absence impact analysis | ❌ Missing | Domino effect failures |
| Swap mechanism | ⚠️ Partial | OptimizationEngine has `swapSchedules()` but not absence-aware |

---

## 2. Absence Scenario Analysis

### 2.1 Single-Day Absence Scenarios

#### Scenario A: Regular Weekday Absence
**Setup**: Analyst on Monday-Friday rotation requests sick leave on Wednesday

**Current Behavior**:
1. Schedule generated without checking `AbsenceService`
2. Analyst assigned to Wednesday
3. Conflict detected: `OVERLAPPING_SCHEDULE`
4. Manual resolution required

**Impact Analysis**:
- **Fairness**: Analyst gets unfair advantage (1 less work day)
- **Coverage**: Gap if not manually fixed
- **Rotation**: Pattern broken for other analysts picking up slack

**Ideal Behavior**:
1. Schedule generation queries `AbsenceService`
2. Skip absent analyst for Wednesday
3. **Trigger replacement logic**:
   - Identify analyst with lowest workload in same shift type
   - Assign as replacement
   - **Mark as "absence coverage"** (distinct from regular rotation)
4. **Fairness adjustment**: Track that original analyst "owes" the team
5. **Future compensation**: In next scheduling cycle, prioritize giving original analyst an extra day off or lighter rotation

#### Scenario B: Weekend/Screener Day Absence
**Setup**: Analyst assigned to weekend shift (high-weight work) requests leave

**Current Behavior**: Same as Scenario A - generates conflict

**Critical Difference**: Weekend shifts have **higher fairness weight**
- From [FairnessEngine.ts](file:///Users/bishwash/Documents/GitHub/ShiftPlanner/backend/src/services/scheduling/algorithms/FairnessEngine.ts), weekend shifts likely count as 1.5x regular days

**Ideal Behavior**:
1. Replacement must be found
2. **Replacement analyst gets fairness credit** equivalent to weekend shift weight
3. **Absent analyst maintains fairness "debt"**
4. **Next rotation**: Absent analyst prioritized for next weekend shift to repay debt

#### Scenario C: Screener-Specific Absence
**Setup**: Analyst assigned as screener for the day is absent

**Current Behavior**: Screener assignment happens **after** base schedules (lines 164-166), but doesn't revalidate availability

**Impact Analysis**:
- **Screener coverage**: Critical gap (every day needs screener)
- **Consecutive screener penalty**: If replacement already did screener recently, unfair burden
- **Rotation desync**: Round-robin screener index doesn't account for absent analysts

**Ideal Behavior**:
1. Screener assignment (lines 289-310) should check `AbsenceService`
2. Skip absent analysts from screener pool for that day
3. **Do NOT increment screener index** for absent analyst (preserve fairness)
4. **Track screener debt**: Absent analyst should be prioritized for next screener rotation

### 2.2 Multi-Day Absence Scenarios

#### Scenario D: Week-Long Vacation
**Setup**: Analyst on MORNING shift takes vacation for 5 consecutive workdays

**Fairness Impact Calculation**:
- 5 regular days = 5 work units
- If vacation spans a weekend shift = +1.5 bonus units
- If vacation includes screener days = additional workload avoided

**Critical Questions**:
1. **Should fairness be recalculated immediately?**  
   - **YES** - Affects current scheduling period
   - Must redistribute workload to prevent burnout of covering analysts

2. **How to distribute replacement coverage?**  
   - **Option A**: Single analyst covers all 5 days (unfair burden)
   - **Option B**: Distribute across 5 different analysts (1 day each) ✅ PREFERRED
   - **Option C**: 2-3 analysts split coverage (balanced middle ground)

**Recommended Approach**: **Weighted Round-Robin Replacement**
```
For each day of absence:
  1. Get analysts working that day
  2. Filter out analysts already covering other absences
  3. Select analyst with:
     - Lowest cumulative workload
     - Lowest recent "coverage duty" count
     - No consecutive 6+ work days
  4. Assign as replacement
  5. Credit fairness score
```

#### Scenario E: Overlapping Absences
**Setup**: 2 EVENING analysts on vacation same week (only 3 EVENING analysts total)

**Current Detection**: [AbsenceService.ts](file:///Users/bishwash/Documents/GitHub/ShiftPlanner/backend/src/services/AbsenceService.ts#L317-L356) checks `INSUFFICIENT_STAFF` if available < 2

**Problem**: Check is **too late** (during absence creation, not approval)

**Cascading Effects**:
1. Remaining EVENING analyst must work every day
2. Potential burnout (consecutive 10+ days)
3. AM-to-PM rotation disrupted (not enough PM analysts)
4. Screener fairness broken (only 1 PM analyst for screener duty)

**Ideal Behavior**:
1. **Pre-approval analysis**: Show manager impact metrics
   - "Approving this absence will require Analyst X to work 10 consecutive days"
   - "Coverage risk: CRITICAL - only 1 PM analyst available"
   - "Suggested alternatives: Reschedule 2 days of Analyst A's vacation"
2. **Conditional approval**: Approve but flag for manual review
3. **Cross-shift coverage**: Allow temporary AM → PM reassignment with fairness compensation

### 2.3 Holiday Absence Scenarios

#### Scenario F: Holiday + Adjacent Vacation
**Setup**: Memorial Day (Monday holiday) + analyst takes Tue-Fri vacation

**Current Holiday Handling**: [HolidayService.ts](file:///Users/bishwash/Documents/GitHub/ShiftPlanner/backend/src/services/HolidayService.ts#L248-L310) has `checkHolidayConflicts()`

**Integration Gap**: Holidays and absences are **separate systems**

**Problem**:
- Holiday = entire team off (0 coverage needed)
- But scheduling engine doesn't know if analyst's "vacation" overlaps holiday
- Analyst gets penalized for holiday in absence count

**Ideal Behavior**:
1. **Detect holiday overlap** during absence creation
2. **Exclude holiday days** from absence duration
3. **Fairness calculation**: Only count Tue-Fri (4 days), not Monday
4. **Approval analysis**: "This absence spans 5 calendar days but only 4 work days"

---

## 3. Fairness Recalculation Strategy

### 3.1 When to Recalculate Fairness?

| **Trigger Event** | **Recalculate?** | **Scope** | **Rationale** |
|---|---|---|---|
| Absence **approved** (future date) | ⚠️ **Conditional** | Next scheduling cycle | If absence is >5 days in future, wait until next cycle |
| Absence **approved** (imminent ≤5 days) | ✅ **Yes** | Immediate | Must adjust active schedule |
| **Ad-hoc sick leave** (same day) | ✅ **Yes** | Immediate | Critical - live schedule adjustment |
| **Multi-analyst overlap** | ✅ **Yes** | Full period | High risk of fairness breakdown |
| **Weekend/Screener shift** missed | ✅ **Yes** | Immediate | High-weight shifts distort fairness significantly |
| **Single regular day** missed | ❌ **No** | Track debt only | Minor impact, batch adjust later |

### 3.2 Fairness Adjustment Mechanisms

#### Mechanism 1: Fairness Debt Tracking
**Concept**: Track "debt" score for each analyst based on missed workload

**Schema Addition**:
```prisma
model FairnessDebt {
  id          String   @id @default(cuid())
  analystId   String
  absenceId   String?  // Link to absence that caused debt
  debtAmount  Float    // Weighted workload units missed
  reason      String   // "ABSENCE_COVERAGE", "WEEKEND_MISS", etc.
  createdAt   DateTime @default(now())
  resolvedAt  DateTime? // When debt was repaid
  
  analyst Analyst @relation(fields: [analystId], references: [id])
  absence Absence @relation(fields: [absenceId], references: [id])
}
```

**Calculation Example**:
```typescript
// Analyst misses Friday (regular) + Saturday (weekend) + screener duty
const debtAmount = 
  (1 * REGULAR_DAY_WEIGHT) +      // Friday: 1.0
  (1 * WEEKEND_DAY_WEIGHT) +      // Saturday: 1.5
  (1 * SCREENER_PENALTY_WEIGHT);  // Screener: 0.5
// Total debt: 3.0 units
```

#### Mechanism 2: Prioritized Assignment for Debt Repayment
**Integration Point**: [ScoringEngine.ts](file:///Users/bishwash/Documents/GitHub/ShiftPlanner/backend/src/services/scheduling/algorithms/ScoringEngine.ts) (referenced in lines 486-487)

**Enhancement**:
```typescript
// In ScoringEngine.calculateScores()
const scores = availableAnalysts.map(analyst => {
  let score = baseScore;
  
  // EXISTING factors: fatigue, consecutive days, last shift...
  
  // NEW: Debt repayment boost
  const debtScore = await getFairnessDebt(analyst.id);
  if (debtScore > 2.0) {
    score += 30; // High priority for assignment
  } else if (debtScore > 1.0) {
    score += 15; // Medium priority
  }
  
  // But reduce score if assignment would create burnout
  if (consecutiveDays > 5 && debtScore < 3.0) {
    score -= 20; // Don't force debt repayment at cost of health
  }
  
  return { analystId: analyst.id, score };
});
```

#### Mechanism 3: Retroactive Fairness Adjustment
**When**: After scheduling period ends (monthly reconciliation)

**Process**:
1. Calculate actual worked days vs expected for all analysts
2. Identify analysts who covered absences (credit surplus)
3. Identify analysts who were absent (track deficit)
4. In **next month's** scheduling:
   - Absent analysts get **harder rotation** (more weekend/screener)
   - Coverage analysts get **lighter rotation** (fewer weekends)

**Analytics View Enhancement**:
```typescript
// Add to Analytics.tsx
interface FairnessAdjustment {
  analystId: string;
  periodDeficit: number;  // Negative if worked less
  coverageCredit: number; // Positive if covered others
  netAdjustment: number;  // Deficit - Credit
  recommendedAction: string; // "Assign weekend shift next cycle"
}
```

### 3.3 Real-World Example Walkthrough

**Scenario**: 4-analyst MORNING team, 2-week period

| Analyst | Regular Days | Weekend Days | Screener Days | Absences |
|---|---|---|---|---|
| Alice | 10 | 2 | 3 | 0 |
| Bob | 8 | 2 | 3 | **2 sick days (Wed, Thu)** |
| Carol | 10 | 2 | 2 | 0 |
| David | 9 | 2 | 4 | **1 vacation (Friday)** |

**Step 1: Identify Replacement Coverage**
- Bob's Wed: Alice covers
- Bob's Thu: Carol covers
- David's Fri: Carol covers

**Step 2: Calculate Weighted Workload**
```
Alice:  10 regular + 2 weekend + 3 screener + 1 coverage = 16.5 units
Bob:     8 regular + 2 weekend + 3 screener = 13.5 units (2 debt)
Carol:  10 regular + 2 weekend + 2 screener + 2 coverage = 17.0 units
David:   9 regular + 2 weekend + 4 screener = 15.5 units (1 debt)
```

**Step 3: Fairness Evaluation**
- **Expected average**: 15.625 units
- **Alice**: +0.875 (OVERWORKED due to coverage)
- **Bob**: -2.125 (UNDERWORKED + DEBT)
- **Carol**: +1.375 (OVERWORKED due to coverage)
- **David**: -0.125 (UNDERWORKED + DEBT)

**Step 4: Next Cycle Adjustments**
1. **Bob**: Assign to next 2 weekend shifts (repay debt)
2. **David**: Assign to next screener rotation (repay debt)
3. **Alice**: Give Mon-Wed-Fri rotation (avoid weekends)
4. **Carol**: Reduce screener assignments by 2

---

## 4. Swap and Replacement Mechanisms

### 4.1 When to Swap vs Replace?

| **Situation** | **Action** | **Reason** |
|---|---|---|
| Single day absence, **advance notice** (>7 days) | **SWAP** | Can find mutual benefit |
| Single day absence, **short notice** (<7 days) | **REPLACE** | No time for negotiation |
| Multi-day absence (>3 days) | **MULTI-REPLACE** | Distribute burden evenly |
| Weekend/Screener absence | **REPLACE** | High-priority, can't risk swap failure |
| Emergency same-day | **IMMEDIATE REPLACE** | No alternatives |

### 4.2 Intelligent Swap Logic

**Swap Eligibility Criteria**:
```typescript
interface SwapCandidate {
  analystId: string;
  currentShiftDate: string;
  swapPreference: 'WILLING' | 'NEUTRAL' | 'UNWILLING';
  fairnessGain: number; // How much would swap improve their fairness
  constraintViolations: string[]; // Would swap violate any constraints?
}

async function findSwapPartner(
  absentAnalyst: Analyst,
  absenceDate: string,
  shiftType: 'MORNING' | 'EVENING' | 'WEEKEND'
): Promise<SwapCandidate | null> {
  // 1. Get all analysts working ANY day in same week
  const sameWeekSchedules = await getSchedulesForWeek(absenceDate);
  
  // 2. Filter candidates who:
  //    - Have same shift type
  //    - Would benefit from swap (fairness improvement)
  //    - Won't violate consecutive day constraints
  const candidates = sameWeekSchedules.filter(schedule => {
    const analyst = schedule.analyst;
    const wouldImproveAbsentFairness = /* check debt */;
    const wouldImprovePartnerFairness = /* check if partner currently overworked */;
    const noConstraintViolation = /* validate */;
    
    return wouldImproveAbsentFairness && 
           wouldImprovePartnerFairness && 
           noConstraintViolation;
  });
  
  // 3. Rank by mutual fairness gain
  return candidates.sort((a, b) => 
    b.fairnessGain - a.fairnessGain
  )[0];
}
```

**Example Swap**:
- **Alice** needs Friday off (currently assigned)
- **Bob** is off Friday, working Monday (currently assigned)
- **Swap evaluation**:
  - Alice's consecutive days: Currently Mon-Fri (5 days) → After swap: Mon-Thu (4 days) ✅
  - Bob's consecutive days: Mon alone → After swap: Mon + Fri (non-consecutive) ✅
  - Both benefit: Alice gets break, Bob gets extra work (if he has debt to repay)

### 4.3 Replacement Selection Algorithm

**Current Gap**: OptimizationEngine has `swapSchedules()` but it swaps arbitrary schedule records, NOT analyst assignments for specific dates.

**Proposed Enhancement**:
```typescript
// New method in IntelligentScheduler
async function findReplacementAnalyst(
  absenceDate: string,
  shiftType: 'MORNING' | 'EVENING' | 'WEEKEND',
  originalAnalyst: Analyst,
  replacementType: 'SINGLE_DAY' | 'MULTI_DAY' | 'WEEKEND' | 'SCREENER'
): Promise<Analyst | null> {
  
  // 1. Get available analysts (not absent, same shift type)
  const available = await this.getAvailableAnalysts(absenceDate, shiftType);
  
  // 2. Exclude analysts already working that day
  const existingAssignments = await getSchedulesForDate(absenceDate);
  const notYetWorking = available.filter(a => 
    !existingAssignments.some(s => s.analystId === a.id)
  );
  
  // 3. Score candidates
  const scored = await Promise.all(notYetWorking.map(async analyst => {
    let score = 100;
    
    // Factor 1: Workload fairness (lower workload = higher score)
    const currentWorkload = await getAnalystWorkload(analyst.id, getCurrentPeriod());
    const avgWorkload = await getAverageWorkload(getCurrentPeriod());
    if (currentWorkload < avgWorkload) score += 30;
    
    // Factor 2: Recent coverage duty (penalize if covered many absences recently)
    const recentCoverage = await getRecentCoverageCount(analyst.id, last30Days);
    score -= recentCoverage * 10;
    
    // Factor 3: Consecutive days check (avoid burnout)
    const consecutiveDays = await getConsecutiveDays(analyst.id, absenceDate);
    if (consecutiveDays >= 5) score -= 40;
    if (consecutiveDays >= 7) score = 0; // Hard veto
    
    // Factor 4: Weekend/Screener fairness
    if (replacementType === 'WEEKEND') {
      const weekendCount = await getWeekendShiftCount(analyst.id, getCurrentPeriod());
      if (weekendCount < 2) score += 20; // They're due for weekend
    }
    
    // Factor 5: Debt repayment opportunity
    const debt = await getFairnessDebt(analyst.id);
    if (debt > 1.0) score += 25; // Prioritize analysts who "owe" the team
    
    return { analyst, score };
  }));
  
  // 4. Select highest score (or null if no viable candidates)
  const best = scored.filter(s => s.score > 50).sort((a, b) => b.score - a.score)[0];
  return best?.analyst || null;
}
```

---

## 5. Approval Workflow Integration

### 5.1 Current Approval Process

**Simple Binary**: `AbsenceService.approveAbsence(id, true/false)`

**Problem**: Manager has **zero visibility** into:
- Impact on team fairness
- Coverage difficulty
- Alternative options
- Historical patterns

### 5.2 Analytics-Driven Decision Support

#### Pre-Approval Impact Report
**Trigger**: When manager views absence request

**Data to Display**:
```typescript
interface AbsenceApprovalAnalytics {
  // Basic Info
  analystName: string;
  absenceDates: { start: string; end: string };
  duration: number; // Work days, excluding holidays
  type: 'VACATION' | 'SICK_LEAVE' | ...;
  
  // Impact Metrics
  impactScore: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  impactFactors: {
    teamAvailability: number; // % of team still available
    coverageRisk: 'AUTO' | 'MANUAL' | 'IMPOSSIBLE';
    fairnessImpact: number; // How much this shifts fairness distribution
    rotationDisruption: boolean; // Does this break rotation continuity?
  };
  
  // Replacement Plan
  suggestedReplacements: Array<{
    date: string;
    replacementAnalyst: string;
    confidence: number; // 0-100%
    concerns: string[]; // ['Consecutive 6th day', 'Recently covered 2 absences']
  }>;
  
  // Historical Context
  analystAbsenceHistory: {
    ytdDaysTaken: number;
    avgAbsenceDuration: number;
    lastAbsence: string;
    comparedToTeamAvg: number; // +/- days vs team average
  };
  
  // Recommendations
  recommendation: 'APPROVE' | 'APPROVE_WITH_CONDITIONS' | 'SUGGEST_RESCHEDULE' | 'DENY';
  reasoning: string[];
  alternativeDates?: string[]; // If suggesting reschedule
}
```

#### Example Report UI

```markdown
## Absence Request Review

**Analyst**: Bob Johnson  
**Dates**: Dec 18-22, 2024 (5 days)  
**Type**: Vacation (Planned)

---

### Impact Analysis

**Overall Risk**: 🟡 MEDIUM

#### Team Availability
- Current team size: 8 analysts (MORNING)
- Available during absence: 7 analysts (87.5%)
- Concurrent absences: Alice (Dec 20-21)
- **Risk**: MEDIUM - 2 analysts out simultaneously for 2 days

#### Coverage Plan
| Date | Replacement | Confidence | Notes |
|------|-------------|------------|-------|
| Dec 18 (Wed) | David | 95% | ✅ Light workload, willing to help |
| Dec 19 (Thu) | Carol | 85% | ⚠️ 5th consecutive day |
| Dec 20 (Fri) | **MANUAL** | 50% | ❌ Alice also out - difficult coverage |
| Dec 21 (Sat) | David | 90% | ⚠️ Weekend shift (high weight) |
| Dec 22 (Sun) | Carol | 80% | ⚠️ Weekend shift (high weight) |

#### Fairness Impact
- Bob's current workload: 14.5 units (avg: 15.2)
- Missing 6.5 units (5 days + 2 weekend + 1 screener)
- Post-absence: 8.0 units (-47% below average)
- **Recommendation**: Bob should be assigned 2 extra weekend shifts in January

#### Historical Context
- Bob's YTD absences: 8 days (Team avg: 6.5 days)
- Last absence: Nov 2-3 (2 days, sick leave)
- Absence frequency: Average

---

### Recommendation

**✅ APPROVE WITH CONDITIONS**

**Reasoning**:
1. Bob's absence is planned well in advance (30 days notice)
2. Coverage is achievable for 4/5 days with moderate effort
3. Friday Dec 20 requires manual assignment due to Alice's overlap
4. Bob should accept 2 weekend shifts in January to balance fairness

**Suggested Actions**:
- [ ] Approve absence
- [ ] Assign David to cover Dec 18, 21
- [ ] Assign Carol to cover Dec 19, 22
- [ ] Manually resolve Dec 20 (consider cross-shift temporary assignment)
- [ ] Add fairness debt: 6.5 units for Bob
- [ ] Notify Bob: "Approval granted. Please note you'll be assigned weekend shifts in January to balance team workload."
```

### 5.3 Automated Approval Rules

**Configuration System**:
```typescript
interface AbsenceApprovalPolicy {
  autoApprove: {
    enabled: boolean;
    conditions: {
      maxDuration: number; // Auto-approve if ≤ N days
      minAdvanceNotice: number; // Auto-approve if requested ≥ N days ahead
      maxConcurrentAbsences: number; // Deny if more than N analysts already out
      requiredCoverageConfidence: number; // Auto-approve if coverage plan ≥ N%
    };
  };
  
  conditionalApproval: {
    enabled: boolean;
    requireManagerReview: boolean;
    conditions: string[]; // ['ASSIGN_WEEKEND_NEXT_MONTH', 'LIMIT_FUTURE_REQUESTS']
  };
  
  denyRules: {
    criticalPeriods: string[]; // Date ranges that are blackout periods
    minStaffThreshold: number; // Deny if would leave < N analysts
  };
}
```

**Example Policy**:
```json
{
  "autoApprove": {
    "enabled": true,
    "conditions": {
      "maxDuration": 3,
      "minAdvanceNotice": 14,
      "maxConcurrentAbsences": 2,
      "requiredCoverageConfidence": 85
    }
  }
}
```

**Auto-Approval Logic**:
```typescript
async function evaluateAbsenceRequest(absence: AbsenceData): Promise<ApprovalDecision> {
  const analytics = await generateAbsenceApprovalAnalytics(absence);
  const policy = await getAbsenceApprovalPolicy();
  
  // Check deny rules first
  if (analytics.impactFactors.teamAvailability < policy.denyRules.minStaffThreshold) {
    return {
      decision: 'DENY',
      reason: 'Insufficient staff coverage',
      requiresManagerOverride: true
    };
  }
  
  // Check auto-approve conditions
  const meetsAutoApproval = 
    absence.duration <= policy.autoApprove.conditions.maxDuration &&
    absence.advanceNoticeDays >= policy.autoApprove.conditions.minAdvanceNotice &&
    analytics.suggestedReplacements.every(r => r.confidence >= policy.autoApprove.conditions.requiredCoverageConfidence);
  
  if (meetsAutoApproval) {
    return {
      decision: 'AUTO_APPROVE',
      reason: 'Meets auto-approval criteria',
      actions: ['CREATE_REPLACEMENT_ASSIGNMENTS', 'TRACK_FAIRNESS_DEBT']
    };
  }
  
  // Default: require manager review
  return {
    decision: 'PENDING_REVIEW',
    reason: 'Requires manager approval',
    analytics
  };
}
```

---

## 6. Edge Cases & Out-of-the-Box Scenarios

### 6.1 Cascading Absence Chain
**Scenario**: Analyst A covers Analyst B's absence, then Analyst A gets sick

**Problem**:
- Replacement assignments are **locked** (not revisited)
- Could create coverage gap or force C to cover both

**Solution**: **Replacement Reassignment System**
```typescript
interface ReplacementAssignment {
  id: string;
  originalAnalystId: string;
  replacementAnalystId: string;
  date: string;
  status: 'ACTIVE' | 'REASSIGNED' | 'CANCELLED';
  reassignmentChain: string[]; // Track full chain: [A, B, C]
}

async function handleSecondaryAbsence(replacementAssignment: ReplacementAssignment) {
  // 1. Invalidate existing replacement
  await updateReplacementStatus(replacementAssignment.id, 'REASSIGNED');
  
  // 2. Find NEW replacement (exclude both original analyst and first replacement)
  const excludeAnalysts = [
    replacementAssignment.originalAnalystId,
    replacementAssignment.replacementAnalystId
  ];
  
  const secondaryReplacement = await findReplacementAnalyst(
    replacementAssignment.date,
    replacementAssignment.shiftType,
    excludeAnalysts
  );
  
  // 3. Track chain to prevent circular assignments
  if (replacementAssignment.reassignmentChain.length > 3) {
    // Alert manager: "Replacement chain too long - manual intervention needed"
    return createEscalationAlert();
  }
}
```

### 6.2 Absence During AM-to-PM Rotation
**Scenario**: AM analyst assigned to work PM shift (rotation) requests leave

**Current Gap**: [IntelligentScheduler.ts](file:///Users/bishwash/Documents/GitHub/ShiftPlanner/backend/src/services/IntelligentScheduler.ts#L206-L208) plans `amToPmRotationMap` **before** checking absences

**Problem**:
- PM coverage gap created
- AM-to-PM rotation index gets desynced
- Other AM analysts don't get fair PM rotation opportunity

**Solution**:
```typescript
// Modify line 242-244 logic
const rotatedToPm = amToPmRotationMap.get(dateStr)?.includes(analyst.id);

// ADD ABSENCE CHECK:
if (rotatedToPm) {
  const isAbsent = await this.isAnalystAbsent(analyst.id, dateStr);
  if (isAbsent) {
    // Re-rotate: find next AM analyst in rotation who is available
    const alternateAmAnalyst = await findNextAvailableInRotation(
      morningAnalysts,
      dateStr,
      amToPmRotationMap.get(dateStr) // Currently selected analysts
    );
    
    // Update rotation map
    amToPmRotationMap.set(dateStr, [
      ...amToPmRotationMap.get(dateStr).filter(id => id !== analyst.id),
      alternateAmAnalyst.id
    ]);
  }
}
```

### 6.3 Partial Day Absence
**Scenario**: Analyst needs to leave 3 hours early (medical appointment)

**Current System**: Only handles full-day absences

**Options**:
1. **Track as full day** (unfair to analyst)
2. **Ignore** (creates coverage gap for 3 hours)
3. **Partial absence tracking** (complex)

**Recommended Approach**: **Fractional Absence Units**
```typescript
interface AbsenceData {
  // EXISTING fields
  startDate: string;
  endDate: string;
  type: string;
  
  // NEW fields
  isPartialDay?: boolean;
  startTime?: string; // HH:MM format
  endTime?: string; // HH:MM format
  fractionalUnits?: number; // 0.5 for half day, 0.25 for 2 hours, etc.
}

// Fairness calculation adjustment
function calculateAbsenceFairnessImpact(absence: Absence): number {
  if (absence.isPartialDay) {
    return absence.fractionalUnits * REGULAR_DAY_WEIGHT;
  }
  
  // Existing full-day logic
  const days = moment(absence.endDate).diff(moment(absence.startDate), 'days') + 1;
  return days * getShiftTypeWeight(absence.shiftType);
}
```

**Coverage Strategy**: For partial absences <4 hours, **do not trigger replacement** (remaining analyst can handle)

### 6.4 Retroactive Absence Entry
**Scenario**: Analyst calls in sick but admin only enters it 3 days later

**Problem**:
- **Past schedules already generated** and possibly saved
- Analytics show incorrect workload
- Fairness calculations wrong for past period

**Solution**: **Retroactive Correction System**
```typescript
async function applyRetroactiveAbsence(absence: Absence) {
  // 1. Find all schedules for absence period
  const affectedSchedules = await prisma.schedule.findMany({
    where: {
      analystId: absence.analystId,
      date: { gte: absence.startDate, lte: absence.endDate }
    }
  });
  
  // 2. Mark schedules as "NOT_WORKED" (don't delete - preserve history)
  await prisma.schedule.updateMany({
    where: { id: { in: affectedSchedules.map(s => s.id) } },
    data: { 
      status: 'ABSENT', 
      retroactivelyMarked: true,
      absenceId: absence.id
    }
  });
  
  // 3. Create fairness debt record
  const debtAmount = calculateAbsenceFairnessImpact(absence);
  await createFairnessDebt(absence.analystId, debtAmount, 'RETROACTIVE_ABSENCE');
  
  // 4. Find who actually covered (if anyone)
  const coverageAnalyst = await findWhoActuallyCovered(affectedSchedules);
  if (coverageAnalyst) {
    await createFairnessCredit(coverageAnalyst.id, debtAmount, 'RETROACTIVE_COVERAGE');
  }
  
  // 5. Trigger analytics recalculation for that period
  await recalculateAnalyticsForPeriod(absence.startDate, absence.endDate);
}
```

### 6.5 Absence Abuse Detection
**Scenario**: Analyst consistently requests absence for Mondays (trying to game 3-day weekends)

**Analytics Red Flags**:
```typescript
interface AbsencePatternAnalysis {
  analystId: string;
  patterns: {
    dayOfWeekPreference: { [key: string]: number }; // { 'Monday': 8, 'Friday': 7, ... }
    adjacentToWeekend: number; // Count of absences touching weekend
    lastMinuteRequests: number; // Requests with <3 days notice
    repeatingDates: string[]; // Same dates each year
  };
  suspicionScore: number; // 0-100
  recommendation: 'NORMAL' | 'REVIEW' | 'ALERT_MANAGER';
}

async function analyzeAbsencePatterns(analystId: string, period: string = 'YEAR') {
  const absences = await getAnalystAbsences(analystId, period);
  
  const dayOfWeekCounts = absences.reduce((acc, absence) => {
    const day = moment(absence.startDate).format('dddd');
    acc[day] = (acc[day] || 0) + 1;
    return acc;
  }, {});
  
  const adjacentToWeekend = absences.filter(absence => {
    const day = moment(absence.startDate).day();
    return day === 1 || day === 5; // Monday or Friday
  }).length;
  
  const suspicionScore = 
    (adjacentToWeekend / absences.length) * 40 + // 40% weight
    (Math.max(...Object.values(dayOfWeekCounts)) / absences.length) * 60; // 60% weight
  
  return {
    analystId,
    patterns: { dayOfWeekPreference: dayOfWeekCounts, adjacentToWeekend, ... },
    suspicionScore,
    recommendation: suspicionScore > 70 ? 'ALERT_MANAGER' : 
                    suspicionScore > 40 ? 'REVIEW' : 'NORMAL'
  };
}
```

**Manager Dashboard Alert**:
> ⚠️ **Absence Pattern Alert**: Bob has requested 8/12 absences on Mondays (67%). Recommend review.

### 6.6 Bereavement/Emergency Doesn't Count Against Fairness
**Principle**: Unplanned emergencies should not create fairness "debt"

**Implementation**:
```typescript
const NON_PENALIZED_TYPES = ['EMERGENCY', 'BEREAVEMENT', 'JURY_DUTY', 'MEDICAL_EMERGENCY'];

function calculateAbsenceFairnessImpact(absence: Absence): number {
  if (NON_PENALIZED_TYPES.includes(absence.type)) {
    return 0; // No fairness debt
  }
  
  // But still need replacement coverage
  // So track separately: replacementNeeded=true, fairnessImpact=0
}
```

**Analytics Separation**:
- **Workload metrics**: Include all absences (affects actual hours worked)
- **Fairness metrics**: Exclude non-penalized absences
- **Manager view**: Show both "Total absences" and "Fairness-adjusted absences"

### 6.7 Cross-Shift Emergency Coverage
**Scenario**: All PM analysts unavailable, need AM analyst to cover PM emergency shift

**Current Blocker**: `getAvailableAnalysts()` filters by `shiftType` parameter

**Solution**: **Emergency Cross-Shift Protocol**
```typescript
async function findEmergencyReplacement(
  date: string,
  shiftType: 'MORNING' | 'EVENING',
  allowCrossShift: boolean = true
): Promise<Analyst | null> {
  
  // 1. Try same-shift first
  let candidates = await this.getAvailableAnalysts(date, shiftType);
  
  // 2. If none available and allowCrossShift, try opposite shift
  if (candidates.length === 0 && allowCrossShift) {
    const oppositeShift = shiftType === 'MORNING' ? 'EVENING' : 'MORNING';
    candidates = await this.getAvailableAnalysts(date, oppositeShift);
    
    // Filter: only select if they're NOT working that day already
    const notWorkingToday = candidates.filter(async analyst => {
      const existingSchedule = await getScheduleForDate(analyst.id, date);
      return !existingSchedule;
    });
    
    if (notWorkingToday.length > 0) {
      // Special fairness bonus: cross-shift coverage = 2x weight
      return {
        analyst: notWorkingToday[0],
        fairnessCredit: 2.0, // Double credit for going outside normal shift
        flag: 'CROSS_SHIFT_EMERGENCY'
      };
    }
  }
  
  return null;
}
```

---

## 7. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
**Goal**: Fix critical integration gaps

1. **Replace deprecated vacation field**
   - Update [IntelligentScheduler.ts:235](file:///Users/bishwash/Documents/GitHub/ShiftPlanner/backend/src/services/IntelligentScheduler.ts#L235) and line 255
   - Replace `analyst.vacations` with `AbsenceService.isAnalystAbsent()`
2. **Integrate absence checking in screener assignment**
   - Update [IntelligentScheduler.ts:289-310](file:///Users/bishwash/Documents/GitHub/ShiftPlanner/backend/src/services/IntelligentScheduler.ts#L289)
   - Filter absent analysts from screener pool
3. **Add fairness debt tracking schema**
   - Create `FairnessDebt` model in Prisma
   - Create migration

### Phase 2: Replacement Logic (Week 3-4)
**Goal**: Automatic coverage assignment

1. **Build replacement selection algorithm**
   - Implement `findReplacementAnalyst()` in `IntelligentScheduler`
   - Integrate with ScoringEngine
2. **Create replacement assignment tracking**
   - New database table for tracking replacements
   - Hook into absence approval flow
3. **Multi-day distribution logic**
   - Ensure long absences don't burden single analyst

### Phase 3: Analytics & Decision Support (Week 5-6)
**Goal**: Smart approval workflow

1. **Build absence impact calculator**
   - `generateAbsenceApprovalAnalytics()` service
2. **Create manager approval dashboard**
   - Frontend component showing impact metrics
   - Suggested replacement plans
3. **Historical pattern analysis**
   - Absence abuse detection
   - Team utilization insights

### Phase 4: Advanced Features (Week 7-8)
**Goal**: Edge case handling

1. **Swap mechanism**
   - Mutual swap finder
   - Constraint validation
2. **Retroactive absence correction**
   - Past schedule adjustment
   - Analytics recalculation
3. **Cross-shift emergency protocol**
   - Last-resort coverage finder

---

## 8. Key Metrics to Track

### 8.1 System Health Metrics
- **Coverage Success Rate**: % of absences with automatic replacement found
- **Average Replacement Confidence**: Avg confidence score of replacement assignments
- **Fairness Drift**: Std deviation of workload distribution before/after absences
- **Manual Intervention Rate**: % of absences requiring manager override

### 8.2 Analyst Fairness Metrics
- **Debt Balance**: Current fairness debt/credit for each analyst
- **Coverage Burden**: # of times analyst covered others' absences
- **Absence Utilization**: Days taken vs team average

### 8.3 Manager Decision Metrics
- **Approval Decision Time**: Time from request to approval/denial
- **Auto-Approval Rate**: % of requests handled automatically
- **Denial Rate**: % of requests denied (track reasons)

---

## 9. Recommended Next Steps

1. **Validate Research with Team**
   - Review scenarios with actual scheduling manager
   - Gather real-world edge cases not covered here
   - Prioritize which scenarios are most critical

2. **Create Implementation Plan**
   - Break down into sprints
   - Define acceptance criteria for each phase
   - Identify dependencies

3. **Build Prototype**
   - Start with Phase 1 (foundation fixes)
   - Test with historical data
   - Validate fairness calculations

4. **Pilot with Limited Scope**
   - Enable for single team/shift type
   - Monitor metrics
   - Iterate based on feedback

---

## 10. Open Questions for User

1. **Fairness Philosophy**: Should unplanned sick leave count against fairness, or only planned vacation?
2. **Approval Authority**: Should system auto-approve low-impact absences, or always require manager review?
3. **Replacement Notification**: Should replacement analysts be **notified automatically**, or wait for manager confirmation?
4. **Cross-Shift Policy**: Under what circumstances (if any) should AM analysts cover PM shifts?
5. **Debt Repayment Timeline**: How quickly should fairness debt be repaid? (Next week, next month, next quarter?)
6. **Historical Data**: How far back should absence pattern analysis look? (6 months, 1 year, all-time?)

---

**Document Version**: 1.0  
**Last Updated**: 2025-11-30  
**Status**: Ready for Review
