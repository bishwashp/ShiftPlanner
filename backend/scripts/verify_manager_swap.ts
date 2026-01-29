import { prisma } from '../src/lib/prisma';
import { shiftSwapService } from '../src/services/ShiftSwapService';
import { swapValidator } from '../src/services/SwapValidator';
import moment from 'moment-timezone';

async function main() {
    console.log('🧪 Starting Manager Swap Verification...');

    // 1. Setup Data
    const region = await prisma.region.findFirst();
    if (!region) throw new Error('No region found');

    const analystA = await prisma.analyst.create({
        data: { name: 'Test_Bish', email: 'test_bish@example.com', regionId: region.id }
    });
    const analystB = await prisma.analyst.create({
        data: { name: 'Test_Srujana', email: 'test_srujana@example.com', regionId: region.id }
    });

    try {
        console.log('Created analysts:', analystA.name, analystB.name);

        // Bish Schedule: Feb 10-14 (Tue-Sat) + Feb 20 (Fri, Screener)
        // Using 2026 dates as per prompt context
        const datesA = ['2026-02-10', '2026-02-11', '2026-02-12', '2026-02-13', '2026-02-14'];
        for (const d of datesA) {
            await prisma.schedule.create({
                data: { analystId: analystA.id, date: new Date(d), shiftType: 'DAY', regionId: region.id }
            });
        }
        await prisma.schedule.create({
            data: { analystId: analystA.id, date: new Date('2026-02-20'), shiftType: 'DAY', isScreener: true, regionId: region.id }
        });

        // Srujana Schedule: Feb 15-19 (Sun-Thu)
        const datesB = ['2026-02-15', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19'];
        for (const d of datesB) {
            await prisma.schedule.create({
                data: { analystId: analystB.id, date: new Date(d), shiftType: 'DAY', regionId: region.id }
            });
        }

        console.log('✅ Schedules setup complete.');

        // 2. Validate Simulation (Expect Violation)
        // Swap: Bish gives Feb 10 (Start of block) <-> Srujana gives Feb 15 (Start of block)
        // Ideally we simulate swapping the WHOLE block, but the validator/service is per-request (Shift-for-Shift).
        // Wait, the Validator takes single dates?
        // "sourceDate", "targetDate".
        // If we swap just ONE day (Feb 10 <-> Feb 15), does it trigger the violation?
        // If Bish gives Feb 10 and takes Feb 15:
        // Result: Bish works Feb 11-14, 15, 20. Streak: 11-15 (5 days). No violation?
        // Connects to Feb 14? Yes.
        // Bish works 11,12,13,14. Takes 15.
        // Streak: 11-15 (5 days).

        // The prompt scenario was swapping the BLOCK.
        // The Service `executeManagerSwap` is technically ONE shift at a time (according to schema).
        // "Manager can select the target date... Confirming this will swap both shifts."
        // If the user wants to swap BLOCKS, they'd need to do it 5 times?
        // Or did I miss a requirement for "Bulk Swap"?
        // Prompt: "Clicking on a date... Confirming this will swap both shifts." (Singular/Pair).
        // So the "Bish Scenario" implies swapping the *entire* week.
        // If they do it one by one:
        // Swap 1: Feb 14 <-> Feb 19.
        // Swap 2: Feb 13 <-> Feb 18.
        // ...
        // Eventually they bridge the gap.

        // Let's test the "bridging" moment.
        // If Bish swaps Feb 14 (his end) with Feb 15 (Srujana's start)?
        // Wait, Bish has 10-14. Srujana has 15-19.
        // If Bish takes 15 (giving away 14? or giving away nothing?).
        // If 2-way: Bish gives 14, Takes 15.
        // Bish has 10-13, 15. (Gap at 14). Streak broken.
        // Srujana has 14, 16-19.

        // This suggests the "Block Swap" might be a bulk operation, or the user manually iterates.
        // BUT my validator only checks the *current* atomic swap.
        // If I swap Feb 10 <-> Feb 15:
        // Bish: 15, 11-14. (Is 15 connected to 14? Yes).
        // So Bish has 11-15. (5 days). Valid.

        // User's example: "Completion of this swap means Bish and Srujana would swap their weekend duty".
        // This implies the whole block moves.
        // If the feature is atomic, detection only catches the step that *creates* the violation.

        // Let's simulate the scenario where the violation DOES happen.
        // Suppose Bish ALREADY has 15-19 (maybe he swapped 4 days already).
        // Now he swaps the last one?
        // Or simply: Validate if Bish takes Feb 15 *without* giving up Feb 14?
        // If 2-way swap: Bish gives Feb 10, Takes Feb 15.
        // Bish: 11,12,13,14, 15. (5 days).
        // Plus 20.

        // What if Bish simply *Takes* Feb 15 (Pickup)?
        // Then Bish: 10-14, 15. (6 days). -> 11 days (if connected to 20?).
        // No, 10-15 is 6 days. 20 is separate.
        // 6 days % 5 != 0 -> Violation!

        // Let's test THAT. "Pickup Violation".
        // Bish (10-14). Srujana (15).
        // Swap: Bish Gives NOTHING (or a dummy date far away?), Takes 15.
        // For verify, let's just use the `validateManagerSwap` logic directly.

        console.log('🔍 Testing Violation Detection (Pickup Scenario)...');
        // Bish (Source) gives "2026-03-01" (dummy/empty), Takes "2026-02-15".
        const result = await swapValidator.validateManagerSwap(
            analystA.id,
            new Date('2026-03-01'), // Dummy remove
            analystB.id,
            new Date('2026-02-15')
        );

        console.log('Validation Result:', JSON.stringify(result, null, 2));

        if (result.length > 0 && result[0].type === 'STREAK_VIOLATION') {
            console.log('✅ Correctly detected streak violation (6 days).');
        } else {
            console.error('❌ Failed to detect violation.');
        }

        // 3. Test Transactional Swap (Force)
        console.log('🔄 Testing Transactional Swap (Force)...');
        // Swap A(Feb 10) <-> B(Feb 15)
        await shiftSwapService.executeManagerSwap(
            analystA.id,
            new Date('2026-02-10'),
            analystB.id,
            new Date('2026-02-15'),
            { force: true }
        );

        // Verify result
        const sA = await prisma.schedule.findUnique({ where: { analystId_date: { analystId: analystA.id, date: new Date('2026-02-15') } } });
        const sB = await prisma.schedule.findUnique({ where: { analystId_date: { analystId: analystB.id, date: new Date('2026-02-10') } } });

        if (sA && sB) {
            console.log('✅ Swap executed successfully (Schedules moved).');
        } else {
            console.error('❌ Swap failed.');
        }

    } catch (e) {
        console.error('Test Failed:', e);
    } finally {
        // Cleanup
        await prisma.schedule.deleteMany({ where: { analystId: { in: [analystA.id, analystB.id] } } });
        await prisma.analyst.deleteMany({ where: { id: { in: [analystA.id, analystB.id] } } });
        console.log('🧹 Cleanup complete.');
    }
}

main();
