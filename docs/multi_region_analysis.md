# Multi-Region Architecture & Implementation Plan

> [!IMPORTANT]
> **Core Philosophy:** "Federated Independence". Each region (AMR, SGP, LDN) operates as a self-contained island for scheduling, fairness, and coverage. There is NO cross-contamination of logic or resources.

## 1. Architectural Decisions (Based on User Inputs)

| Area | Decision | Implication |
| :--- | :--- | :--- |
| **Regional Isolation** | **Strict** | No cross-region coverage allowed. Engines run independently per region. |
| **Analyst Mobility** | **Clean Slate** | When moving regions, fairness history stays behind (archived). Analyst starts with 0 scores in new region. |
| **Shift Config** | **Dynamic & Local** | Shifts are defined per-region (e.g., SGP 8-5, LDN 9-6). Admin configurable. |
| **Handover** | **Visual Only** | Critical for dashboard visibility but does not enforce hard "overlap" blocking rules. |
| **Versioning** | **Snapshot** | We will store shift times *at the time of generation* into the Schedule record to allow accurate historical reporting without complex effective-dating tables. |

## 2. Database Schema Changes

### New Models
```prisma
model Region {
  id          String   @id @default(cuid())
  name        String   @unique // "AMR", "SGP", "LDN"
  timezone    String   // "America/New_York", "Asia/Singapore", "Europe/London"
  isActive    Boolean  @default(true)
  
  // Relations
  analysts    Analyst[]
  shiftDefs   ShiftDefinition[]
  holidays    Holiday[]
}

model ShiftDefinition {
  id          String   @id @default(cuid())
  regionId    String
  name        String   // "AM", "PM", "DAY"
  startResult String   // "09:00" (Local Time)
  endResult   String   // "18:00" (Local Time)
  isOvernight Boolean  @default(false) 
  
  region      Region   @relation(fields: [regionId], references: [id])
}
```

### Modified Models
*   **Analyst:**
    *   **Add** `regionId` (FK to Region).
    *   **Retain** `shiftType` (String), but logic changes: instead of validating against hardcoded ENUMs (`MORNING`, `EVENING`), it validates against the `ShiftDefinition` table for that `regionId`.
*   **Holiday:** Add `regionId`. Holidays are now region-specific.
*   **Schedule:** Add `regionId` (denormalized for query speed) and `startTime`/`endTime` snapshot.

## 3. The "Admin Settings" Module (Configuration)

This is a critical new system component to manage the decentralized architecture.

### Features
1.  **Region Management:** Activate/Deactivate regions (e.g., "Launch LDN").
2.  **Shift Configuration:**
    *   Define Shifts for each region (e.g., SGP: "AM" 08:00-17:00, "PM" 14:00-23:00).
    *   **Handover Settings:** distinct from shift times, this allows setting specific "Visual Handover Markers" on the dashboard (e.g., "SGP->LDN Handover at 17:00 SGT").
3.  **Holidays:** Manage holiday calendars specific to each region.

### UI Implementation
*   **Location:** `/admin/configuration`
*   **Design:** Tabbed interface by Region.
*   **Validation:** Ensure Shift Names are unique per region.

## 4. "Intelligent Scheduler" Engine Refactor

The [IntelligentScheduler](file:///Users/bishwash/Documents/GitHub/ShiftPlanner/backend/src/services/IntelligentScheduler.ts#57-782) class currently runs as a monolith.

**Refactor Strategy:**
1.  **Input:** Accepts `RegionID` in the `SchedulingContext`.
2.  **Context Loading:** Fetches `ShiftDefinitions` and `Holidays` *only* for that Region.
3.  **Analyst Pool:** Filters [Analyst](file:///Users/bishwash/Documents/GitHub/ShiftPlanner/backend/src/services/IntelligentScheduler.ts#582-652) table by `RegionID`.
4.  **Shift Generation:**
    *   Iterates based on the Region's `ShiftDefinitions`.
    *   For **SGP**: Generates `AM` and `PM` slots (based on config).
    *   For **LDN**: Generates `DAY` slots (based on config).
    *   For **AMR**: Generates `AM` and `PM` slots (based on config).
5.  **Output:** Returns a schedule strictly for that Region.

## 4. Fairness Engine Customization

Since pools are isolated:
*   **Fairness Scores** are calculated relative to *active analysts in that region only*.
*   **Weekend Tracking:** "Weekends" are defined by the Region's timezone. (Saturday in SGP starts 12+ hours before Saturday in AMR).

## 5. Frontend & UI Strategy

### The "Geo-Selector" (Global Context)
*   A top-level dropdown: `[ 🇺🇸 AMR | 🇸🇬 SGP | 🇬🇧 LDN ]`.
*   **State:** Persists in URL or LocalStorage.
*   **Effect:** Filter *all* API calls by `?region=SGP`.

### Dashboard Views
*   **Configurable Time:** Toggle between **"My Local Time"** (browser time) and **"Region Local Time"** (e.g., viewing SGP shifts in SGT to see 9-6 alignment).
*   **Handover Visualization:** Explicit visual markers showing where shifts end/start to highlight the "Baton Pass".

---

## Implementation Roadmap

### Phase 1: Foundation (Schema & Migration)
*   [ ] Create `Region` and `ShiftDefinition` models.
*   [ ] Create migration script:
    *   Create "AMR", "SGP", "LDN" regions.
    *   Assign all existing Analysts/Schedules to "AMR".
    *   Create default Shift Definitions for AMR (match current hardcoded values).

### Phase 2: Backend Core (The Split)
*   [ ] Refactor [IntelligentScheduler](file:///Users/bishwash/Documents/GitHub/ShiftPlanner/backend/src/services/IntelligentScheduler.ts#57-782) to accept `regionId`.
*   [ ] Update `HolidayService` to respect `regionId`.
*   [ ] Update `FairnessEngine` to scope queries by `regionId`.

### Phase 3: Admin & Configuration (The Control Center)
*   [ ] Build API endpoints for managing Regions, Shift Definitions, and Handover Configs.
*   [ ] Frontend: Build **Admin Configuration Module**.
    *   Region Selector Tabs.
    *   Shift Time Editors (Start/End times).
    *   Handover Time Editors.
    *   Feature Toggles (e.g. "Enable SGP").

### Phase 4: Frontend Adoption
*   [ ] Implement `RegionContext` provider.
*   [ ] Add Global Geo-Selector in Navbar.
*   [ ] Update Calendar/Dashboard to filter by selected region.

### Phase 5: The "New World" (SGP/LDN Onboarding)
*   [ ] Create SGP/LDN Shift Definitions.
*   [ ] user can start adding Analysts to SGP/LDN.
*   [ ] Run generation for SGP/LDN.

---

### Clarification on "Versioning"
You asked about the "Time Travel" complexity.
*   **Decision:** We will **Snapshot** the data.
*   **How:** When the scheduler generates a shift for `Feb 1st`, it looks up the *current* config (e.g., 9am-6pm) and writes `09:00` and `18:00` into the [Schedule](file:///Users/bishwash/Documents/GitHub/ShiftPlanner/backend/src/services/IntelligentScheduler.ts#57-782) table row.
*   **Result:** If you change the config in March to `8am-5pm`, the Feb 1st record *still says* `9am-6pm`. This preserves historical truth for reporting without "Effective Date" tables.
