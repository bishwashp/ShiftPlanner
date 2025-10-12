# Core Scheduling Algorithm Redesign

## Problem Summary

The current implementation has fundamental architectural flaws:

1. **Correct understanding of rotation**: System DOES manage TWO analysts in rotation simultaneously (staggered), but implementation is fragmented and unclear
2. Three separate "algorithms" when there should be one core algorithm
3. No explicit analyst pool management (available → in-rotation → completed)
4. Screener derivation pulls from wrong sources (existing + proposed instead of just proposed)
5. Comp-off automation not properly integrated into the core algorithm
6. Fairness calculated as post-processing instead of being intrinsic to rotation cycle
7. Scattered state across multiple services

## Solution Architecture

### Single Unified Algorithm: `CoreWeekendRotationScheduler`

Replace all existing algorithms with one coherent implementation:

**Files to Create:**
- `backend/src/services/scheduling/CoreWeekendRotationScheduler.ts` - Main algorithm
- `backend/src/services/scheduling/AnalystPoolManager.ts` - Pool state management
- `backend/src/services/scheduling/ConstraintFilter.ts` - Preprocessing only

**Files to Modify:**
- `backend/src/services/scheduling/AlgorithmRegistry.ts` - Register new algorithm
- `backend/prisma/schema.prisma` - Update rotation state model

**Files to Delete:**
- `WeekendRotationAlgorithm.ts`
- `EnhancedWeekendRotationAlgorithm.ts`
- `FairnessEngine.ts` (fairness is intrinsic now)
- `FairnessTracker.ts`
- `RotationStateManager.ts`
- Keep `FairnessCalculator.ts` (used for initial selection only)
- Keep `ConstraintEngine.ts` but simplify to just filtering

## Implementation Details

### 1. AnalystPoolManager

Manages staggered two-analyst rotation state per shift type:

```typescript
interface RotationState {
  shiftType: 'MORNING' | 'EVENING';
  
  // TWO analysts in rotation simultaneously (staggered)
  currentSunThuAnalyst: {  // Analyst in Week 1 (Sun-Thu)
    id: string;
    weekInCycle: 1;
    cycleStartDate: Date;
  } | null;
  
  currentTueSatAnalyst: {  // Analyst in Week 2 (Tue-Sat)
    id: string;
    weekInCycle: 2;
    cycleStartDate: Date;
  } | null;
  
  // Pool management for fair rotation
  availablePool: string[];   // Not yet rotated this cycle
  completedPool: string[];   // Finished rotation this cycle
  cycleGeneration: number;   // Full cycle counter
}
```

**Key Methods:**
- `selectNextAnalyst()` - Pick from availablePool using fairness, or reset cycle
- `advanceAnalystWeek(analyst)` - Move analyst to next week in their personal cycle
- `getAnalystPattern(analystId, date)` - Get work pattern for analyst on specific date
- `isAnalystInRotation(analystId, date)` - Check if analyst should work per rotation pattern
- `shouldGetCompOff(analystId, date)` - Check if analyst gets auto comp-off
- `resetCycle()` - Move completedPool back to availablePool

### 2. ConstraintFilter

Preprocessing only - no validation:

```typescript
getAvailableAnalysts(date, analysts, constraints):
  - Filter out analysts on vacation/absence
  - Filter out if holiday/blackout date
  - Return: available analysts for this date
```

### 3. CoreWeekendRotationScheduler

**Phase 1: Regular Work Schedule Generation (with Comp-Off Automation)**

```
For each date in range:
  1. Get available analysts via ConstraintFilter
  2. Get TWO current rotation analysts via AnalystPoolManager:
     - currentSunThuAnalyst (in Week 1 of personal cycle)
     - currentTueSatAnalyst (in Week 2 of personal cycle)
  3. Check if rotation analysts should work:
     - Week 1 analyst (Sun-Thu): works Sun, Mon, Tue, Wed, Thu → auto comp-off Friday
     - Week 2 analyst (Tue-Sat): works Tue, Wed, Thu, Fri, Sat → auto comp-off Monday
     - Week 3 analyst: works Mon-Fri (back to regular)
  4. All OTHER analysts work Mon-Fri only
  5. When Week 1 analyst finishes Thursday:
     - They transition to Week 2 (4-day break Friday-Monday)
     - NEW analyst enters Week 1 from availablePool
  6. When Week 2 analyst finishes Saturday:
     - They transition to Week 3 (regular Mon-Fri)
  7. When Week 3 analyst finishes Friday:
     - They move to completedPool
     - availablePool checked for next rotation entry
```

**Phase 2: Screener Assignment** 

```
For each WEEKDAY in range:
  1. Get analysts WORKING this day from Phase 1 output
  2. Separate by shift type (morning/evening)
  3. Select one screener per shift using fairness metrics:
     - Penalize recent screener assignments
     - Penalize consecutive screener days (max 2)
     - Prefer analysts with fewer screener days historically
  4. Mark selected analyst as screener
```

**Phase 3: Validation & Metrics**

```
- Ensure FR-2.4: exactly one analyst per shift type on weekends
- Calculate coverage metrics
- Generate conflict reports
- Return result with fairness metrics (informational only)
```

### 4. Database Schema Changes

Update `RotationState` table for staggered two-analyst tracking:

```prisma
model RotationState {
  id                    String   @id @default(cuid())
  algorithmType         String
  shiftType             String   // MORNING or EVENING
  
  // Current rotation (TWO analysts in staggered phases)
  currentSunThuAnalyst  String?  // Analyst in Week 1 (Sun-Thu)
  sunThuStartDate       DateTime?
  
  currentTueSatAnalyst  String?  // Analyst in Week 2 (Tue-Sat)
  tueSatStartDate       DateTime?
  
  // Pool management for fair rotation
  availablePool         String   // JSON array of analyst IDs
  completedPool         String   // JSON array of analyst IDs
  cycleGeneration       Int      // How many full cycles completed
  
  lastUpdated           DateTime @default(now())
  createdAt             DateTime @default(now())
  
  @@unique([algorithmType, shiftType])
  @@map("rotation_states")
}
```

Remove `PatternContinuity` table - not needed with explicit pool management.

## Migration Strategy

1. **Phase 1**: Create new components (AnalystPoolManager, ConstraintFilter)
2. **Phase 2**: Implement CoreWeekendRotationScheduler
3. **Phase 3**: Update AlgorithmRegistry to use new algorithm
4. **Phase 4**: Add database migration for updated RotationState
5. **Phase 5**: Initialize pools from existing data (migration script)
6. **Phase 6**: Delete old algorithm files
7. **Phase 7**: Update tests to reflect new architecture

## Key Benefits

1. **Correctness**: Implements FR-2.3.1 staggered two-analyst rotation with auto comp-offs
2. **Clarity**: One algorithm file, clear responsibilities
3. **Maintainability**: Half the code, explicit state management
4. **Fairness**: Guaranteed by rotation cycle, not post-processing
5. **Debuggability**: Clear phase separation, traceable state
6. **Extensibility**: Easy to modify rotation patterns or add new ones

## Validation

After implementation, verify:
- ✓ Exactly TWO analysts per shift in staggered rotation at any time (Week 1 + Week 2)
- ✓ Each analyst's personal rotation follows: Sun-Thu (Fri comp-off) → Tue-Sat (Mon comp-off) → Mon-Fri pattern
- ✓ Staggered entry: new analyst enters Week 1 when previous Week 1 analyst transitions to Week 2
- ✓ All analysts rotate once before anyone rotates twice (pool management)
- ✓ Screeners only selected from working analysts (Phase 2 uses Phase 1 output)
- ✓ FR-2.4 compliance: one analyst per shift type on weekends (Sun from Week 1, Sat from Week 2)
- ✓ Auto comp-offs correctly applied (Friday for Sun-Thu, Monday for Tue-Sat)
- ✓ No orphaned analysts (everyone gets scheduled)

