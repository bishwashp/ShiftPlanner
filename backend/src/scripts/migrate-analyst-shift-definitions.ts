/**
 * Migration Script: Populate Analyst.shiftDefinitionId
 * 
 * Maps existing shiftType (MORNING/EVENING/AM/PM) to ShiftDefinition records
 * based on the analyst's regionId.
 * 
 * Usage: npx ts-node src/scripts/migrate-analyst-shift-definitions.ts
 */

import { PrismaClient } from '../../generated/prisma';

const prisma = new PrismaClient();

// Mapping from legacy shiftType to ShiftDefinition name
const SHIFT_TYPE_MAPPING: Record<string, string> = {
    'MORNING': 'AM',
    'EVENING': 'PM',
    'AM': 'AM',
    'PM': 'PM',
    // WEEKEND is not a valid analyst assignment - it's operational context
};

// Region-specific overrides for single-shift regions
// For these regions, ANY legacy shiftType maps to the region's only shift
const SINGLE_SHIFT_REGIONS: Record<string, string> = {
    'LDN': 'LDN', // LDN has a single shift called 'LDN'
};

async function migrate() {
    console.log('🚀 Starting Analyst ShiftDefinition Migration...\n');

    // 1. Fetch all ShiftDefinitions grouped by region
    const shiftDefs = await prisma.shiftDefinition.findMany({
        include: { region: true }
    });

    console.log(`📋 Found ${shiftDefs.length} ShiftDefinitions:`);
    shiftDefs.forEach(sd => {
        console.log(`   - ${sd.region.name}: ${sd.name} (${sd.id})`);
    });
    console.log('');

    // Create lookup: { [regionId]: { [shiftName]: shiftDefId } }
    const shiftDefLookup: Record<string, Record<string, string>> = {};
    for (const sd of shiftDefs) {
        if (!shiftDefLookup[sd.regionId]) {
            shiftDefLookup[sd.regionId] = {};
        }
        shiftDefLookup[sd.regionId][sd.name] = sd.id;
    }

    // 2. Fetch all analysts without shiftDefinitionId
    const analysts = await prisma.analyst.findMany({
        where: { shiftDefinitionId: null },
        include: { region: true }
    });

    console.log(`👥 Found ${analysts.length} analysts to migrate.\n`);

    let migrated = 0;
    let skipped = 0;
    const unmapped: Array<{ name: string; region: string; shiftType: string | null }> = [];

    for (const analyst of analysts) {
        const legacyShift = analyst.shiftType?.toUpperCase();

        if (!legacyShift) {
            console.log(`⚠️  Skipping ${analyst.name}: No shiftType set`);
            skipped++;
            continue;
        }

        // Check if this is a single-shift region (use region's only shift)
        let targetShiftName = SINGLE_SHIFT_REGIONS[analyst.region.name];

        // If not a single-shift region, use standard mapping
        if (!targetShiftName) {
            targetShiftName = SHIFT_TYPE_MAPPING[legacyShift];
        }

        if (!targetShiftName) {
            console.log(`⚠️  Skipping ${analyst.name}: Unknown shiftType '${legacyShift}'`);
            unmapped.push({ name: analyst.name, region: analyst.region.name, shiftType: analyst.shiftType });
            skipped++;
            continue;
        }


        // Find the ShiftDefinition for this region + shift name
        const regionDefs = shiftDefLookup[analyst.regionId];
        if (!regionDefs) {
            console.log(`⚠️  Skipping ${analyst.name}: No ShiftDefinitions for region '${analyst.region.name}'`);
            unmapped.push({ name: analyst.name, region: analyst.region.name, shiftType: analyst.shiftType });
            skipped++;
            continue;
        }

        const shiftDefId = regionDefs[targetShiftName];
        if (!shiftDefId) {
            console.log(`⚠️  Skipping ${analyst.name}: No '${targetShiftName}' ShiftDefinition in region '${analyst.region.name}'`);
            unmapped.push({ name: analyst.name, region: analyst.region.name, shiftType: analyst.shiftType });
            skipped++;
            continue;
        }

        // Update the analyst
        await prisma.analyst.update({
            where: { id: analyst.id },
            data: { shiftDefinitionId: shiftDefId }
        });

        console.log(`✅ Migrated ${analyst.name} (${analyst.region.name}) → ${targetShiftName}`);
        migrated++;
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 Migration Summary:');
    console.log(`   ✅ Migrated: ${migrated}`);
    console.log(`   ⚠️  Skipped: ${skipped}`);

    if (unmapped.length > 0) {
        console.log('\n⚠️  Unmapped Records (require manual review):');
        unmapped.forEach(u => {
            console.log(`   - ${u.name} (${u.region}): shiftType='${u.shiftType}'`);
        });
    }

    console.log('\n✨ Migration complete!');
}

// Dry run mode
async function dryRun() {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');

    const analysts = await prisma.analyst.findMany({
        where: { shiftDefinitionId: null },
        include: { region: true }
    });

    const shiftDefs = await prisma.shiftDefinition.findMany({
        include: { region: true }
    });

    console.log(`Would migrate ${analysts.length} analysts using ${shiftDefs.length} ShiftDefinitions.`);

    for (const analyst of analysts) {
        const legacyShift = analyst.shiftType?.toUpperCase();
        // Check for single-shift region override first
        let targetShiftName = SINGLE_SHIFT_REGIONS[analyst.region.name];
        if (!targetShiftName && legacyShift) {
            targetShiftName = SHIFT_TYPE_MAPPING[legacyShift];
        }
        const targetDef = shiftDefs.find(sd => sd.regionId === analyst.regionId && sd.name === targetShiftName);

        if (targetDef) {
            console.log(`   ${analyst.name} (${analyst.region.name}) → ${targetDef.name}`);
        } else {
            console.log(`   ⚠️  ${analyst.name} (${analyst.region.name}): No match for '${analyst.shiftType}'`);
        }
    }

}

// Main
const isDryRun = process.argv.includes('--dry-run');

if (isDryRun) {
    dryRun()
        .catch(console.error)
        .finally(() => prisma.$disconnect());
} else {
    migrate()
        .catch(console.error)
        .finally(() => prisma.$disconnect());
}
