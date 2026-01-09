
import { prisma } from '../lib/prisma';

async function inspectData() {
    console.log("🔍 Inspecting Shift Definitions and Schedules for AMR...");

    // 1. Find AMR Region
    const amrRegion = await prisma.region.findFirst({
        where: { name: 'AMR' } // Assuming name is 'AMR' or similar, strict search
    });

    if (!amrRegion) {
        console.log("❌ Could not find region 'AMR'. Listing all regions:");
        const regions = await prisma.region.findMany();
        regions.forEach(r => console.log(` - [${r.id}] ${r.name}`));
        return;
    }

    console.log(`✅ Found Region: ${amrRegion.name} (${amrRegion.id})`);

    // 2. Get Shift Definitions
    const definitions = await prisma.shiftDefinition.findMany({
        where: { regionId: amrRegion.id }
    });
    console.log("\n📋 Shift Definitions:");
    definitions.forEach(d => console.log(` - ${d.name} (Time: ${d.startResult}-${d.endResult})`));

    // 3. Get Recent Schedules (last 30 days)
    const schedules = await prisma.schedule.findMany({
        where: {
            regionId: amrRegion.id, // Some schedules might not have regionId link populated if old?
            date: {
                gte: new Date(new Date().setDate(new Date().getDate() - 30))
            }
        },
        take: 20
    });

    console.log(`\n📅 Sample Schedules (Found ${schedules.length}):`);

    // Count distinct shiftTypes
    const typeCounts: Record<string, number> = {};

    schedules.forEach(s => {
        typeCounts[s.shiftType] = (typeCounts[s.shiftType] || 0) + 1;
    });

    Object.entries(typeCounts).forEach(([type, count]) => {
        console.log(` - '${type}': ${count} occurrences`);
    });

}

inspectData()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
