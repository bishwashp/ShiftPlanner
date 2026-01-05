/**
 * Seed Script: Populate ShiftDefinitions and HandoverDefinitions
 * 
 * This script seeds the default operational configuration for:
 * - AMR (AM, PM shifts)
 * - SGP (AM, PM shifts)
 * - LDN (single shift)
 * 
 * Handover times are stored in UTC. Shift start/end times are stored in local timezone.
 * 
 * Run with: npx ts-node src/scripts/seed-shifts-handovers.ts
 */

import { PrismaClient } from '../../generated/prisma';

const prisma = new PrismaClient();

// --- Configuration ---

interface ShiftConfig {
    name: string;
    regionCode: string;
    startLocal: string; // HH:mm in region's local timezone
    endLocal: string;   // HH:mm in region's local timezone
}

interface HandoverConfig {
    sourceRegionCode: string;
    sourceShiftName: string;
    targetRegionCode: string;
    targetShiftName: string;
    handoverTimeUTC: string; // HH:mm in UTC
}

const SHIFTS: ShiftConfig[] = [
    { name: 'AM', regionCode: 'AMR', startLocal: '09:00', endLocal: '18:00' }, // CST
    { name: 'PM', regionCode: 'AMR', startLocal: '09:00', endLocal: '18:00' }, // PST (logically separate shift, same region)
    { name: 'AM', regionCode: 'SGP', startLocal: '08:30', endLocal: '17:30' }, // SGT
    { name: 'PM', regionCode: 'SGP', startLocal: '11:30', endLocal: '20:30' }, // SGT
    { name: 'LDN', regionCode: 'LDN', startLocal: '09:00', endLocal: '17:00' }, // BST/GMT
];

// Handovers: Source Shift -> Target Shift @ UTC Time
// Original times in CST converted to UTC (+6 hours)
const HANDOVERS: HandoverConfig[] = [
    { sourceRegionCode: 'AMR', sourceShiftName: 'PM', targetRegionCode: 'SGP', targetShiftName: 'AM', handoverTimeUTC: '00:30' }, // 18:30 CST
    { sourceRegionCode: 'SGP', sourceShiftName: 'AM', targetRegionCode: 'SGP', targetShiftName: 'PM', handoverTimeUTC: '04:30' }, // 22:30 CST
    { sourceRegionCode: 'SGP', sourceShiftName: 'PM', targetRegionCode: 'LDN', targetShiftName: 'LDN', handoverTimeUTC: '09:30' }, // 03:30 CST
    { sourceRegionCode: 'LDN', sourceShiftName: 'LDN', targetRegionCode: 'AMR', targetShiftName: 'AM', handoverTimeUTC: '16:00' }, // 10:00 CST
    { sourceRegionCode: 'AMR', sourceShiftName: 'AM', targetRegionCode: 'AMR', targetShiftName: 'PM', handoverTimeUTC: '20:30' }, // 14:30 CST
];

// --- Main Logic ---

async function main() {
    console.log('🌍 Starting Shift & Handover Seed...\n');

    // 1. Fetch existing regions
    const regions = await prisma.region.findMany({ where: { isActive: true } });
    const regionMap = new Map(regions.map(r => [r.name, r.id]));

    console.log(`Found ${regions.length} active regions: ${regions.map(r => r.name).join(', ')}`);

    // Validate all required regions exist
    const requiredRegions = [...new Set([...SHIFTS.map(s => s.regionCode), ...HANDOVERS.flatMap(h => [h.sourceRegionCode, h.targetRegionCode])])];
    for (const code of requiredRegions) {
        if (!regionMap.has(code)) {
            throw new Error(`❌ Region "${code}" not found in database. Please create it first.`);
        }
    }

    // 2. Upsert Shift Definitions
    console.log('\n📋 Upserting Shift Definitions...');
    const shiftIdMap = new Map<string, string>(); // "REGION:SHIFTNAME" -> shiftId

    for (const shift of SHIFTS) {
        const regionId = regionMap.get(shift.regionCode)!;
        const key = `${shift.regionCode}:${shift.name}`;

        // Check if shift already exists
        let existing = await prisma.shiftDefinition.findFirst({
            where: { regionId, name: shift.name }
        });

        if (existing) {
            // Update if exists
            existing = await prisma.shiftDefinition.update({
                where: { id: existing.id },
                data: { startResult: shift.startLocal, endResult: shift.endLocal }
            });
            console.log(`  ✓ Updated: ${shift.regionCode} ${shift.name} (${shift.startLocal} - ${shift.endLocal})`);
        } else {
            // Create if not exists
            existing = await prisma.shiftDefinition.create({
                data: {
                    name: shift.name,
                    regionId,
                    startResult: shift.startLocal,
                    endResult: shift.endLocal,
                }
            });
            console.log(`  + Created: ${shift.regionCode} ${shift.name} (${shift.startLocal} - ${shift.endLocal})`);
        }
        shiftIdMap.set(key, existing.id);
    }

    // 3. Upsert Handover Definitions
    console.log('\n🔗 Upserting Handover Definitions...');

    // First, clear existing handovers to avoid duplicates (since there's no unique constraint on the pair)
    // We could be smarter here, but for a seed script, this is safe.
    const deleteResult = await prisma.handoverDefinition.deleteMany({});
    console.log(`  (Cleared ${deleteResult.count} existing handovers)`);

    for (const h of HANDOVERS) {
        const sourceKey = `${h.sourceRegionCode}:${h.sourceShiftName}`;
        const targetKey = `${h.targetRegionCode}:${h.targetShiftName}`;

        const sourceShiftId = shiftIdMap.get(sourceKey);
        const targetShiftId = shiftIdMap.get(targetKey);

        if (!sourceShiftId || !targetShiftId) {
            console.error(`  ❌ Could not find shift IDs for: ${sourceKey} -> ${targetKey}`);
            continue;
        }

        await prisma.handoverDefinition.create({
            data: {
                sourceShiftId,
                targetShiftId,
                handoverTime: h.handoverTimeUTC, // Stored in UTC
            }
        });
        console.log(`  + Created: ${h.sourceRegionCode} ${h.sourceShiftName} → ${h.targetRegionCode} ${h.targetShiftName} @ ${h.handoverTimeUTC} UTC`);
    }

    console.log('\n✅ Seed complete!\n');
}

main()
    .catch(e => {
        console.error('Seed failed:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
