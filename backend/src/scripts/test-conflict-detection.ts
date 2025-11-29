
import { ConflictDetectionService } from '../services/conflict/ConflictDetectionService';
import moment from 'moment';

// Mock Prisma
const mockPrisma = {
    schedule: {
        findMany: async () => [] // Default empty
    }
} as any;

class TestConflictDetectionService extends ConflictDetectionService {
    // Expose private method for testing
    public testProcessSchedules(schedules: any[], allDates: Set<string>, startDate: Date, endDate: Date) {
        return (this as any).processSchedules(schedules, allDates, startDate, endDate);
    }
}

async function testConflictDetection() {
    console.log('🧪 Testing ConflictDetectionService...');

    const service = new TestConflictDetectionService(mockPrisma);
    const startDate = new Date('2025-11-29'); // Saturday
    const endDate = new Date('2025-11-30');   // Sunday

    const allDates = new Set<string>();
    allDates.add('2025-11-29');
    allDates.add('2025-11-30');

    // Scenario 1: Weekend with only WEEKEND shift
    console.log('\nScenario 1: Weekend with single WEEKEND shift');
    const schedules1 = [
        { date: new Date('2025-11-29'), shiftType: 'WEEKEND', analystId: 'A1' },
        { date: new Date('2025-11-30'), shiftType: 'WEEKEND', analystId: 'A2' }
    ];

    const conflicts1 = service.testProcessSchedules(schedules1, allDates, startDate, endDate);
    const missing1 = conflicts1.filter((c: any) => c.type === 'NO_ANALYST_ASSIGNED');

    if (missing1.length === 0) {
        console.log('✅ PASS: No missing shift conflicts for WEEKEND shift on weekend');
    } else {
        console.log('❌ FAIL: Found conflicts:', JSON.stringify(missing1, null, 2));
    }

    // Scenario 2: Weekend with only MORNING shift (Partial)
    console.log('\nScenario 2: Weekend with only MORNING shift');
    const schedules2 = [
        { date: new Date('2025-11-29'), shiftType: 'MORNING', analystId: 'A1' }
        // Sunday missing entirely
    ];

    const conflicts2 = service.testProcessSchedules(schedules2, allDates, startDate, endDate);
    // We expect Sunday to be missing (handled by missing schedules logic), 
    // but Saturday (29th) has Morning. 
    // Our logic says: if (weekend || morning || evening) -> Complete.
    // So Saturday should be considered complete (no missing shift conflict).

    const missing2 = conflicts2.filter((c: any) => c.date === '2025-11-29' && c.type === 'NO_ANALYST_ASSIGNED');
    if (missing2.length === 0) {
        console.log('✅ PASS: Single MORNING shift on weekend is considered sufficient coverage');
    } else {
        console.log('❌ FAIL: Single MORNING shift flagged as conflict:', JSON.stringify(missing2, null, 2));
    }

    // Scenario 3: Weekday with only MORNING shift (Should fail)
    console.log('\nScenario 3: Weekday (Monday) with only MORNING shift');
    const mondayDate = new Date('2025-12-01'); // Monday
    const allDatesMon = new Set<string>(['2025-12-01']);
    const schedules3 = [
        { date: mondayDate, shiftType: 'MORNING', analystId: 'A1' }
    ];

    const conflicts3 = service.testProcessSchedules(schedules3, allDatesMon, mondayDate, mondayDate);
    const missing3 = conflicts3.filter((c: any) => c.type === 'NO_ANALYST_ASSIGNED');

    if (missing3.length > 0 && missing3[0].missingShifts.includes('Evening')) {
        console.log('✅ PASS: Missing Evening shift correctly flagged for Weekday');
    } else {
        console.log('❌ FAIL: Missing Evening shift NOT flagged for Weekday');
    }

    // Scenario 4: Weekend with NO screener (Should PASS)
    console.log('\nScenario 4: Weekend with NO screener');
    const weekendDate = new Date('2025-11-29'); // Saturday
    const allDatesWeekend = new Set<string>(['2025-11-29']);
    const schedules4 = [
        { date: weekendDate, shiftType: 'MORNING', analystId: 'A1', isScreener: false },
        { date: weekendDate, shiftType: 'EVENING', analystId: 'A2', isScreener: false }
    ];
    // Note: We need to ensure it's considered "Complete" first so it checks for screeners.
    // Our logic says Morning+Evening on weekend is Complete.

    const conflicts4 = service.testProcessSchedules(schedules4, allDatesWeekend, weekendDate, weekendDate);
    const screenerConflicts = conflicts4.filter((c: any) => c.type === 'SCREENER_CONFLICT');

    if (screenerConflicts.length === 0) {
        console.log('✅ PASS: No screener conflict for weekend despite missing screeners');
    } else {
        console.log('❌ FAIL: Screener conflict found on weekend:', JSON.stringify(screenerConflicts, null, 2));
    }

    // Scenario 5: Weekend with only EVENING shift
    console.log('\nScenario 5: Weekend with only EVENING shift');
    const weekendEveningDate = new Date('2025-11-30'); // Sunday
    const allDatesWeekendEvening = new Set<string>(['2025-11-30']);
    const schedules5 = [
        { date: weekendEveningDate, shiftType: 'EVENING', analystId: 'A2' }
    ];

    const conflicts5 = service.testProcessSchedules(schedules5, allDatesWeekendEvening, weekendEveningDate, weekendEveningDate);
    const missing5 = conflicts5.filter((c: any) => c.type === 'NO_ANALYST_ASSIGNED');

    if (missing5.length === 0) {
        console.log('✅ PASS: Single EVENING shift on weekend is considered sufficient coverage');
    } else {
        console.log('❌ FAIL: Single EVENING shift flagged as conflict:', JSON.stringify(missing5, null, 2));
    }
}

testConflictDetection().catch(console.error);
