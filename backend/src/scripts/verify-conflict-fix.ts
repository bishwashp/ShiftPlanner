
import { conflictDetectionService } from '../services/conflict';
import { prisma } from '../lib/prisma';

async function verifyFix() {
    console.log("🔍 Verifying Conflict Detection Fix...");

    // 1. Get Regions
    const regions = await prisma.region.findMany();
    const amr = regions.find(r => r.name === 'AMR');
    const ldn = regions.find(r => r.name === 'LDN'); // Assuming LDN exists

    if (amr) {
        console.log(`\nTesting AMR Region [${amr.id}] (Should have schedules, check normalization)`);
        const start = new Date();
        const end = new Date();
        end.setDate(end.getDate() + 30);

        const result = await conflictDetectionService.detectConflicts(start, end, amr.id);
        console.log(`- Found ${result.critical.length} critical, ${result.recommended.length} recommended conflicts.`);

        // Check for normalization success
        const missingShifts = result.critical.find(c => c.missingShifts.includes('AM') || c.missingShifts.includes('MORNING'));
        if (!missingShifts) {
            console.log("✅ Success: No false 'Missing Shift' conflicts found (Normalization working!)");
        } else {
            console.log("⚠️ Warning: Found missing shifts:", missingShifts);
        }
    }

    if (ldn) {
        console.log(`\nTesting LDN Region [${ldn.id}] (Empty, should be clean or single warning)`);
        const start = new Date();
        const end = new Date();
        end.setDate(end.getDate() + 30);

        const result = await conflictDetectionService.detectConflicts(start, end, ldn.id);
        console.log(`- Found ${result.critical.length} critical, ${result.recommended.length} recommended conflicts.`);

        if (result.critical.length === 0 && result.recommended.length <= 1) {
            console.log("✅ Success: LDN is clean (or just general 'no schedule' warning)");
            if (result.recommended.length > 0) console.log("   Legacy Warning:", result.recommended[0].message);
        } else {
            console.log("❌ Failed: LDN still showing too many conflicts:", result);
        }
    }
}

verifyFix()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
