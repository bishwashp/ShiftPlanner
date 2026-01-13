import { PrismaClient } from '../../generated/prisma';
import { IntelligentScheduler } from '../services/IntelligentScheduler';
import { ConflictDetectionService } from '../services/conflict/ConflictDetectionService';
import moment from 'moment-timezone';

const prisma = new PrismaClient();

async function main() {
    const scheduler = new IntelligentScheduler(prisma);
    const conflictService = new ConflictDetectionService(prisma);

    // Define range for full year 2026
    const startDate = moment.utc('2026-01-01').toDate();
    const endDate = moment.utc('2026-12-31').toDate();

    // Fetch SGP region
    const sgpRegion = await prisma.region.findUnique({
        where: { name: 'SGP' }
    });

    if (!sgpRegion) {
        throw new Error('SGP Region not found.');
    }

    console.log(`🌍 Using Region: ${sgpRegion.name} (${sgpRegion.id})`);

    // Show current analyst distribution
    const analysts = await prisma.analyst.findMany({
        where: {
            isActive: true,
            regionId: sgpRegion.id
        }
    });

    const amAnalysts = analysts.filter(a => a.shiftType === 'AM');
    const pmAnalysts = analysts.filter(a => a.shiftType === 'PM');

    console.log(`\n👥 Analyst Distribution:`);
    console.log(`   AM: ${amAnalysts.length} (${amAnalysts.map(a => a.name).join(', ')})`);
    console.log(`   PM: ${pmAnalysts.length} (${pmAnalysts.map(a => a.name).join(', ')})`);

    // Calculate expected rotation
    const totalAnalysts = amAnalysts.length + pmAnalysts.length;
    const idealPerShift = Math.floor(totalAnalysts / 2);
    const amSurplus = Math.max(0, amAnalysts.length - 2); // Keep min 2
    const pmDeficit = Math.max(0, idealPerShift - pmAnalysts.length);
    const expectedRotation = Math.min(amSurplus, pmDeficit);

    console.log(`\n📊 Balance Calculation:`);
    console.log(`   Total: ${totalAnalysts}, Ideal per shift: ${idealPerShift}`);
    console.log(`   AM surplus: ${amSurplus}, PM deficit: ${pmDeficit}`);
    console.log(`   Expected rotation: ${expectedRotation}`);

    console.log(`\n🧹 Clearing SGP schedules for Jan 2026...`);

    const deleteResult = await prisma.schedule.deleteMany({
        where: {
            date: {
                gte: startDate,
                lte: endDate
            },
            regionId: sgpRegion.id
        }
    });

    console.log(`✅ Deleted ${deleteResult.count} existing schedules`);

    // Regenerate
    console.log('\n🚀 Regenerating schedules with balance-based rotation...');
    const result = await scheduler.generate({
        startDate,
        endDate,
        regionId: sgpRegion.id,
        analysts,
        existingSchedules: [],
        globalConstraints: []
    });

    console.log(`✅ Generated ${result.proposedSchedules.length} schedules`);

    // Persist
    console.log('\n💾 Saving to database...');

    await prisma.$transaction(
        result.proposedSchedules.map(s => prisma.schedule.create({
            data: {
                date: moment.utc(s.date).toDate(),
                shiftType: s.shiftType,
                analystId: s.analystId,
                isScreener: s.isScreener,
                regionId: sgpRegion.id
            }
        }))
    );
    console.log('✅ Saved to database');

    // Verify specifically for Jan 12 and Jan 19
    console.log('\n🔍 Verifying AM coverage on Jan 12 & Jan 19...');

    const jan12 = await prisma.schedule.findMany({
        where: {
            regionId: sgpRegion.id,
            date: moment.utc('2026-01-12').toDate()
        },
        include: { analyst: true }
    });

    const jan19 = await prisma.schedule.findMany({
        where: {
            regionId: sgpRegion.id,
            date: moment.utc('2026-01-19').toDate()
        },
        include: { analyst: true }
    });

    const jan12AM = jan12.filter(s => s.shiftType === 'AM');
    const jan12PM = jan12.filter(s => s.shiftType === 'PM');
    const jan19AM = jan19.filter(s => s.shiftType === 'AM');
    const jan19PM = jan19.filter(s => s.shiftType === 'PM');

    console.log(`\n📅 Jan 12, 2026 (Monday):`);
    console.log(`   AM: ${jan12AM.length} schedules (${jan12AM.map((s: any) => s.analyst.name).join(', ') || 'NONE'})`);
    console.log(`   PM: ${jan12PM.length} schedules (${jan12PM.map((s: any) => s.analyst.name).join(', ') || 'NONE'})`);

    console.log(`\n📅 Jan 19, 2026 (Monday):`);
    console.log(`   AM: ${jan19AM.length} schedules (${jan19AM.map((s: any) => s.analyst.name).join(', ') || 'NONE'})`);
    console.log(`   PM: ${jan19PM.length} schedules (${jan19PM.map((s: any) => s.analyst.name).join(', ') || 'NONE'})`);

    // Check for conflicts
    console.log('\n🔍 Running conflict detection...');
    const conflictResult = await conflictService.detectConflicts(startDate, endDate, sgpRegion.id);

    const amMissing = conflictResult.critical.filter((c: any) =>
        c.message && c.message.includes('Missing AM')
    );

    console.log(`\n📊 Results:`);
    console.log(`   Total conflicts: ${conflictResult.critical.length + conflictResult.recommended.length}`);
    console.log(`   Missing AM conflicts: ${amMissing.length}`);

    if (amMissing.length === 0) {
        console.log('\n✅ SUCCESS: No missing AM shift conflicts!');
    } else {
        console.log('\n❌ FAILED: Still have missing AM conflicts:');
        amMissing.forEach((c: any) => console.log(`   - ${c.message}`));
    }

    // Check screener distribution
    console.log('\n📊 Screener Distribution Check:');
    const allSchedules = await prisma.schedule.findMany({
        where: {
            regionId: sgpRegion.id,
            date: { gte: startDate, lte: endDate },
            isScreener: true
        },
        include: { analyst: true }
    });

    const screenerByAnalyst = new Map<string, number>();
    allSchedules.forEach(s => {
        screenerByAnalyst.set(s.analyst.name, (screenerByAnalyst.get(s.analyst.name) || 0) + 1);
    });

    for (const [name, count] of screenerByAnalyst) {
        const analyst = analysts.find(a => a.name === name);
        console.log(`   ${name} (${analyst?.shiftType}): ${count} screener days`);
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
