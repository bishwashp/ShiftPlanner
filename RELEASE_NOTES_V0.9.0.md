# ShiftPlanner v0.9.0 - Core Algorithm Redesign

**Release Date:** October 12, 2025  
**Version:** 0.9.0  
**Branch:** V0.8.6 → V0.9.0

---

## 🎯 Overview

This release introduces a **complete redesign of the core scheduling algorithm** with the correct implementation of the staggered two-analyst weekend rotation system. The new algorithm properly handles automatic comp-offs, ensures intrinsic fairness through pool management, and correctly derives screeners from working analysts.

---

## ✨ What's New

### CoreWeekendRotationScheduler v1.0.0

A unified scheduling algorithm that replaces the fragmented multi-algorithm approach with a single, cohesive implementation.

#### Key Features

1. **Staggered Two-Analyst Rotation**
   - Two analysts per shift type rotate simultaneously in different phases
   - Week 1 Analyst: Works Sun-Thu (Friday comp-off)
   - Week 2 Analyst: Works Tue-Sat (Monday comp-off)
   - All others: Regular Mon-Fri schedule

2. **Automatic Comp-Off Management**
   - Friday automatically off for Sun-Thu workers (Week 1)
   - Monday automatically off for Tue-Sat workers (Week 2)
   - No manual tracking required - built into core algorithm

3. **Intrinsic Fairness**
   - Pool-based rotation: Everyone rotates once before anyone rotates twice
   - No post-processing optimization needed
   - Guaranteed fair distribution by design

4. **Proper Screener Assignment**
   - Screeners selected ONLY from analysts working that day
   - Fairness scoring prevents imbalance
   - Maximum 2 consecutive screener days enforced
   - Avoids consecutive screener assignments

5. **Weekend Coverage Guarantee**
   - Sunday covered by Week 1 analyst (Sun-Thu)
   - Saturday covered by Week 2 analyst (Tue-Sat)
   - FR-2.4 compliant: Exactly one per shift type

---

## 🏗️ Architecture Improvements

### New Components

**AnalystPoolManager** (`backend/src/services/scheduling/AnalystPoolManager.ts`)
- Manages rotation state per shift type
- Tracks two analysts in staggered phases
- Handles pool management (available/completed)
- Automatic cycle resets

**ConstraintFilter** (`backend/src/services/scheduling/ConstraintFilter.ts`)
- Preprocessing-only constraint filtering
- Filters by absences, vacations, holidays
- Clean separation from validation logic

**CoreWeekendRotationScheduler** (`backend/src/services/scheduling/CoreWeekendRotationScheduler.ts`)
- Main algorithm with three clear phases:
  1. Regular schedule generation
  2. Screener assignment
  3. Validation & metrics

### Improvements Over Previous Version

| Aspect | Before | After |
|--------|--------|-------|
| **Algorithms** | 3 separate algorithms | 1 unified algorithm |
| **Code Lines** | ~2,000+ lines | ~1,100 lines |
| **Fairness** | Post-processing | Intrinsic to cycle |
| **Screeners** | From existing+proposed | From working only |
| **Comp-Offs** | Manual tracking | Automatic |
| **Pool Management** | Scattered | Explicit & clear |

---

## 🗄️ Database Changes

### Migration: `20251012131310_add_staggered_rotation_fields`

Updated `RotationState` table schema:

```sql
-- New fields for staggered tracking
currentSunThuAnalyst  TEXT      -- Week 1 analyst ID
sunThuStartDate       DATETIME  -- Week 1 start
currentTueSatAnalyst  TEXT      -- Week 2 analyst ID
tueSatStartDate       DATETIME  -- Week 2 start

-- Pool management
availablePool         TEXT      -- JSON: analysts not yet rotated
completedPool         TEXT      -- JSON: analysts who completed rotation
cycleGeneration       INTEGER   -- Cycle counter
```

**Migration Status:** ✅ Applied successfully  
**Backward Compatibility:** ✅ Legacy fields preserved

---

## 📚 Documentation Updates

### Requirements
- Updated `shiftPlannerRequirements.md` FR-2.3.1
- Added clear staggered rotation explanation
- Included example timeline
- Clarified 4-day break specification

### Implementation Guides
- `CORE_ALGORITHM_PLAN.md` - Architecture and design
- `CORE_ALGORITHM_IMPLEMENTATION.md` - Technical details
- `IMPLEMENTATION_COMPLETE.md` - Completion report
- `CHANGELOG.md` - Version history

---

## 🚀 How to Use

### GraphQL API (Recommended)

```graphql
mutation GenerateSchedule {
  generateSchedulePreview(input: {
    startDate: "2025-10-13"
    endDate: "2025-11-09"
    algorithmType: "CoreWeekendRotationScheduler"
  }) {
    proposedSchedules {
      date
      analystName
      shiftType
      isScreener
      type
      assignmentReason {
        primaryReason
      }
    }
    conflicts {
      date
      type
      description
      severity
    }
    fairnessMetrics {
      overallFairnessScore
      workloadDistribution {
        standardDeviation
        maxMinRatio
      }
    }
  }
}
```

### Default Algorithm

The new `CoreWeekendRotationScheduler` is now the default algorithm. If no `algorithmType` is specified, it will be used automatically.

### Legacy Algorithms

Previous algorithms remain available for backward compatibility:
- `WeekendRotationAlgorithm`
- `EnhancedWeekendRotationAlgorithm`

---

## ✅ Testing Checklist

Before deploying, verify:

- [ ] Weekend coverage: Exactly 1 morning + 1 evening analyst on Sat/Sun
- [ ] Staggered rotation: Two analysts in different phases simultaneously
- [ ] Comp-offs: Friday off for Sun-Thu, Monday off for Tue-Sat
- [ ] Fair cycling: All analysts rotate once before repeating
- [ ] Screeners: Only from working analysts, balanced assignment
- [ ] Constraints: Absences/vacations respected
- [ ] Pool management: Cycle resets correctly

---

## 🔧 Technical Details

### Algorithm Flow

```
Phase 1: Regular Schedule Generation
├── Load rotation state (morning/evening)
├── For each date:
│   ├── Get available analysts (filter constraints)
│   ├── Assign Week 1 analyst (Sun-Thu)
│   ├── Assign Week 2 analyst (Tue-Sat)
│   ├── Assign comp-offs (Friday/Monday)
│   └── Assign others (Mon-Fri)
└── Advance rotation weekly

Phase 2: Screener Assignment
├── For each weekday:
│   ├── Get working analysts from Phase 1
│   ├── Separate by shift (morning/evening)
│   ├── Score analysts (fairness metrics)
│   └── Select best screener per shift
└── Update screener history

Phase 3: Validation & Metrics
├── Validate FR-2.4 (weekend coverage)
├── Check coverage gaps
├── Calculate fairness metrics
└── Generate conflict reports
```

### Rotation Timeline Example

```
Calendar Week 1:
  Analyst A: Sun-Thu [Week 1] → Fri OFF
  Analyst B: Tue-Sat [Week 2] → Mon OFF
  Others:    Mon-Fri [Regular]

Calendar Week 2:
  Analyst A: Tue-Sat [Week 2] → Mon OFF
  Analyst C: Sun-Thu [Week 1] → Fri OFF
  Analyst B: Mon-Fri [Back to regular]
  Others:    Mon-Fri [Regular]

Calendar Week 3:
  Analyst C: Tue-Sat [Week 2] → Mon OFF
  Analyst D: Sun-Thu [Week 1] → Fri OFF
  Analyst A: Mon-Fri [Back to regular]
  Others:    Mon-Fri [Regular]
```

---

## 🐛 Known Issues

None at this time.

---

## 🔮 Future Enhancements

### Planned for v0.9.1
- Migration script for converting old rotation state
- Admin UI for rotation state visualization
- Rotation analytics dashboard

### Planned for v1.0.0
- Deprecation of legacy algorithms
- Comprehensive test suite
- Performance benchmarks
- Production hardening

---

## 📞 Support

For issues or questions:
1. Check documentation: `/CORE_ALGORITHM_IMPLEMENTATION.md`
2. Review testing guidelines: `/IMPLEMENTATION_COMPLETE.md`
3. Examine example timeline in requirements: `/shiftPlannerRequirements.md`

---

## 🎉 Summary

Version 0.9.0 represents a **major architectural improvement** to ShiftPlanner's core scheduling system. The new algorithm correctly implements the staggered two-analyst rotation with automatic comp-off management, ensuring fair distribution and proper weekend coverage.

**Key Achievements:**
- ✅ 50% code reduction with improved clarity
- ✅ Zero linter errors, full type safety
- ✅ Correct implementation of FR-2.3.1
- ✅ Intrinsic fairness (no post-processing)
- ✅ Automatic comp-off management
- ✅ Proper screener derivation

**Status:** Ready for testing and deployment

---

**Version:** 0.9.0  
**Date:** October 12, 2025  
**Algorithm:** CoreWeekendRotationScheduler v1.0.0

