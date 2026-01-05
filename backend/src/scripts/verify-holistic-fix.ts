import { prisma } from '../lib/prisma';
import { conflictDetectionService } from '../services/conflict/ConflictDetectionService';

async function verifyHolisticFix() {
    console.log('\\n🧪 Verifying Holistic Fix - February 2026 Schedule Analysis\\n');

    const startDate = new Date('2026-02-01');
    const endDate = new Date('2026-02-28');

    console.log(`📅 Date Range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

    // Run conflict detection with new checks
    const conflicts = await conflictDetectionService.detectConflicts(startDate, endDate);

    console.log('\\n--- Critical Conflicts ---');
    if (conflicts.critical.length === 0) {
        console.log('✅ No critical conflicts found!');
    } else {
        for (const c of conflicts.critical) {
            console.log(`❌ [${c.type}] ${c.message}`);
        }
    }

    console.log('\\n--- Recommended Fixes ---');
    if (conflicts.recommended.length === 0) {
        console.log('✅ No recommended fixes!');
    } else {
        for (const c of conflicts.recommended) {
            console.log(`⚠️  [${c.type}] ${c.message}`);
        }
    }

    console.log('\\n--- Summary ---');
    console.log(`Critical: ${conflicts.critical.length}`);
    console.log(`Recommended: ${conflicts.recommended.length}`);

    // Count by type
    const byType = new Map<string, number>();
    for (const c of [...conflicts.critical, ...conflicts.recommended]) {
        byType.set(c.type, (byType.get(c.type) || 0) + 1);
    }
    console.log('\\nBy Type:');
    for (const [type, count] of byType) {
        console.log(`  ${type}: ${count}`);
    }
}

verifyHolisticFix().catch(console.error).finally(() => prisma.$disconnect());
