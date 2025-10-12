# Changelog

All notable changes to the ShiftPlanner project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.0] - 2025-10-12

### 🚀 Major Features

#### Core Scheduling Algorithm Redesign
Complete redesign of the scheduling algorithm with correct implementation of staggered two-analyst weekend rotation system.

**Added:**
- New unified `CoreWeekendRotationScheduler` algorithm (v1.0.0)
- `AnalystPoolManager` for rotation state management with staggered two-analyst tracking
- `ConstraintFilter` for preprocessing-only constraint filtering
- Automatic comp-off management (Friday for Sun-Thu, Monday for Tue-Sat)
- Pool-based rotation cycle ensuring intrinsic fairness
- Proper screener derivation from working analysts only

**Changed:**
- Updated `shiftPlannerRequirements.md` FR-2.3.1 with clear staggered rotation explanation
- Redesigned `RotationState` database schema for staggered tracking
- Set `CoreWeekendRotationScheduler` as default algorithm in `AlgorithmRegistry`
- Simplified constraint handling (preprocessing vs post-validation)

**Database:**
- Migration `20251012131310_add_staggered_rotation_fields` - Added staggered rotation fields to RotationState table
  - `currentSunThuAnalyst` - Analyst in Week 1 (Sun-Thu) of personal cycle
  - `sunThuStartDate` - Week 1 start date
  - `currentTueSatAnalyst` - Analyst in Week 2 (Tue-Sat) of personal cycle  
  - `tueSatStartDate` - Week 2 start date
  - `availablePool` - JSON array of analysts not yet rotated
  - `completedPool` - JSON array of analysts who completed rotation
  - `cycleGeneration` - Full cycle counter

**Technical Details:**
- Staggered rotation: TWO analysts in rotation simultaneously at different phases
- Week 1 analyst: Sun-Thu (Friday auto comp-off)
- Week 2 analyst: Tue-Sat (Monday auto comp-off)
- All other analysts: Regular Mon-Fri schedule
- Pool management: Everyone rotates once before anyone rotates twice
- FR-2.4 compliance: Exactly one analyst per shift type on weekends

**Documentation:**
- `CORE_ALGORITHM_PLAN.md` - Design and architecture document
- `CORE_ALGORITHM_IMPLEMENTATION.md` - Implementation details
- `IMPLEMENTATION_COMPLETE.md` - Completion report with testing guidelines

**Backward Compatibility:**
- Legacy algorithms (`WeekendRotationAlgorithm`, `EnhancedWeekendRotationAlgorithm`) remain available
- Existing rotation states will initialize new pools on first use
- No breaking changes to GraphQL API

### 🐛 Bug Fixes
- Fixed screener derivation pulling from wrong sources (now correctly uses Phase 1 output only)
- Fixed analyst pool management issues (explicit available/completed tracking)
- Fixed fairness calculation issues (now intrinsic to rotation cycle)

### 📊 Performance Improvements
- Reduced algorithm code by ~50% while improving clarity
- Eliminated unnecessary post-processing fairness optimization
- Streamlined constraint validation (preprocessing only)

### 🧪 Testing
- Zero linter errors across all new components
- Full TypeScript type safety with proper interfaces
- Comprehensive inline documentation

---

## [0.8.6] - 2025-10-11

### Previous Release
- Various features and improvements
- Comp-off banking system
- Workload balancing enhancements
- Multiple algorithm implementations

---

## Future Releases

### [0.9.1] - Planned
- Migration script to convert old rotation state to new format
- Admin UI for rotation state visualization
- Rotation analytics dashboard

### [1.0.0] - Planned
- Production-ready release
- Deprecation of legacy algorithms
- Performance optimizations
- Comprehensive test suite

