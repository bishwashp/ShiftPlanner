
import { PrismaClient } from '../generated/prisma';
import { constraintImpactAnalyzer } from '../src/services/ConstraintImpactAnalyzer';
import { recalculationEngine } from '../src/services/RecalculationEngine';
import { auditService } from '../src/services/AuditService';
import { generationBlockService } from '../src/services/GenerationBlockService';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting Constraint System Verification...\n');

    try {
        // --- Setup: ensure we have a generation block to amend ---
        console.log('📦 Setting up test data...');
        const block = await generationBlockService.createBlock({
            name: 'Verification Test Block',
            startDate: new Date(),
            endDate: new Date(new Date().setDate(new Date().getDate() + 7)),
            algorithmType: 'TEST',
            generatedBy: 'system',
            constraints: [],
            analysts: []
        });
        console.log(`   Created GenerationBlock: ${block.id}`);

        // --- 1. Test Impact Preview ---
        console.log('\n🔍 1. Testing Impact Preview...');
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 5);

        // Analyze a hypothetical blackout constraint
        const assessment = await constraintImpactAnalyzer.analyzeNewConstraint(
            'BLACKOUT_DATE',
            startDate,
            endDate,
            undefined, // No specific analyst, global
            undefined,
            undefined
        );

        console.log(`   Assessment Severity: ${assessment.severity}`);
        console.log(`   Affected Schedules: ${assessment.affectedSchedules.length}`);
        console.log(`   Requires Recalculation: ${assessment.requiresRecalculation}`);

        if (assessment.severity === 'CRITICAL' || assessment.severity === 'HIGH' || assessment.severity === 'MEDIUM' || assessment.severity === 'LOW') {
            console.log('   ✅ Impact Analysis returned valid severity');
        } else {
            console.error('   ❌ Impact Analysis returned invalid severity');
        }

        // --- 2. Test Constraint Creation & Recalculation ---
        console.log('\n⚙️ 2. Testing Recalculation Logic...');

        // Create a dummy constraint in DB manually to simulate "Confirmed" state
        const constraint = await prisma.schedulingConstraint.create({
            data: {
                constraintType: 'BLACKOUT_DATE',
                startDate: startDate,
                endDate: endDate,
                description: 'Verification Test Constraint',
                requiresRecalculation: true,
                impactAssessed: true,
                impactSnapshot: JSON.stringify(assessment),
                isActive: true
            }
        });
        console.log(`   Created Test Constraint: ${constraint.id}`);

        // Trigger Recalculation
        const result = await recalculationEngine.handleConstraintChange(
            constraint.id,
            assessment,
            {
                recalculate: true,
                grantCompOff: false,
                extendToSubsequentWeeks: false
            }
        );

        console.log(`   Recalculation Success: ${result.success}`);
        console.log(`   Message: ${result.message}`);
        console.log(`   Schedules Removed: ${result.schedulesRemoved}`);
        console.log(`   Schedules Created: ${result.schedulesCreated}`);

        if (result.success) {
            console.log('   ✅ Recalculation Engine executed successfully');
        } else {
            console.error('   ❌ Recalculation Engine failed');
        }

        // --- 3. Verify Audit Trail ---
        console.log('\n📜 3. Verifying Audit Logs...');

        // Check System Events
        const systemEvents = await auditService.getEntityHistory('CONSTRAINT', constraint.id);
        const recalculationEvent = systemEvents.find(e => e.action === 'EXECUTED');

        if (recalculationEvent) {
            console.log(`   ✅ Found 'EXECUTED' system event for constraint`);
        } else {
            console.error(`   ❌ Missing 'EXECUTED' system event`);
        }

        // Check Activities
        const activities = await auditService.getRecentActivities(5);
        const recalcActivity = activities.find(a => a.type === 'SCHEDULE_RECALCULATED' && a.resourceId === constraint.id);

        if (recalcActivity) {
            console.log(`   ✅ Found 'SCHEDULE_RECALCULATED' activity log`);
        } else {
            console.error(`   ❌ Missing 'SCHEDULE_RECALCULATED' activity log`);
        }

        // --- 4. Verify Generation Block Amendment ---
        console.log('\n🧱 4. Verifying Generation Block Amendment...');
        const updatedBlock = await prisma.generationBlock.findUnique({
            where: { id: block.id }
        });

        if (updatedBlock?.decisionLog && updatedBlock.decisionLog.includes('Recalculation triggered')) {
            console.log(`   ✅ Generation Block has amendment in decision log`);
        } else {
            console.error(`   ❌ Generation Block missing amendment`);
            console.log('Current Log:', updatedBlock?.decisionLog);
        }

        // --- Cleanup ---
        console.log('\n🧹 Cleaning up...');
        await prisma.schedulingConstraint.delete({ where: { id: constraint.id } });
        await prisma.generationBlock.delete({ where: { id: block.id } });
        // Clean up logs/activities created during test if needed, but keeping them is fine for audit trail proof.
        console.log('   Test data verified and cleaned up.');

    } catch (error) {
        console.error('\n❌ Verification Failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
