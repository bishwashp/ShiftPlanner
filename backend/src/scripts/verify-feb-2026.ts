
import { ConflictDetectionService } from '../services/conflict/ConflictDetectionService';

// Mock Prisma
const mockPrisma = {
    schedule: {
        findMany: async () => []
    }
} as any;

class TestConflictDetectionService extends ConflictDetectionService {
    public testProcessSchedules(schedules: any[], allDates: Set<string>, startDate: Date, endDate: Date) {
        return (this as any).processSchedules(schedules, allDates, startDate, endDate);
    }
}

async function verifyFeb2026Issue() {
    console.log('🧪 Verifying February 2026 Schedule Logic...');

    const service = new TestConflictDetectionService(mockPrisma);

    // Feb 2026
    // Feb 1st is a Sunday.
    const startDate = new Date('2026-02-01');
    const endDate = new Date('2026-02-01');

    const allDates = new Set<string>();
    allDates.add('2026-02-01'); // Sunday

    // Case: Partial Weekend Coverage (Morning Only)
    // Core Principle Hypothesis: Weekends must have FULL coverage (AM + PM) or WEEKEND shift.
    // If validator allows single coverage, it is BROKEN.

    const partialSchedule = [
        {
            date: new Date('2026-02-01'),
            shiftType: 'MORNING',
            analystId: 'A1',
            isScreener: false
        }
    ];

    console.log('\n--- Test Case: Sunday with ONLY Morning Shift ---');
    const conflicts = service.testProcessSchedules(partialSchedule, allDates, startDate, endDate);

    // Check results
    const missingShiftConflicts = conflicts.filter((c: any) => c.type === 'NO_ANALYST_ASSIGNED');
    const incompleteConflicts = conflicts.filter((c: any) => c.type === 'INCOMPLETE_SCHEDULE');

    if (missingShiftConflicts.length === 0 && incompleteConflicts.length === 0) {
        console.log('❌ FAIL: Validator ACCEPTED partial weekend coverage (Morning only).');
        console.log('   This confirms the hypothesis: Conflict detection logic is too loose for weekends.');
    } else {
        console.log('✅ PASS: Validator REJECTED partial weekend coverage.');
        console.log('   Conflicts found:', JSON.stringify(conflicts, null, 2));
    }
}

verifyFeb2026Issue().catch(console.error);
