import { PrismaClient } from '../generated/prisma';
import HolidayService from '../src/services/HolidayService';

const prisma = new PrismaClient();
const holidayService = new HolidayService(prisma);

async function verifyHolidaysForRegion(year: number, regionName: string, expectedHolidayName: string) {
    console.log(`\nVerifying ${regionName} holidays for year ${year}...`);

    // 1. Get Region ID
    const region = await prisma.region.findUnique({ where: { name: regionName } });
    if (!region) {
        console.error(`Region ${regionName} not found! Ensure seeded.`);
        return;
    }

    // 2. Clean up existing holidays for this year/region to ensure clean slate
    await prisma.holiday.deleteMany({
        where: { year: year, regionId: region.id }
    });

    // 3. Initialize
    const holidays = await holidayService.initializeDefaultHolidays(year, 'UTC', region.id);

    console.log(`Initialized ${holidays.length} holidays for ${regionName}.`);

    // 4. Verify specific holiday exists
    const targetHoliday = holidays.find(h => h.name.includes(expectedHolidayName));

    if (targetHoliday) {
        console.log(`✅ SUCCESS: Found holiday "${expectedHolidayName}" in ${regionName}. Date: ${targetHoliday.date}`);
    } else {
        console.error(`❌ FAILURE: Did not find holiday "${expectedHolidayName}" in ${regionName}.`);
        console.log('Found:', holidays.map(h => h.name).join(', '));
    }
}

async function main() {
    const TEST_YEAR = 2099;

    try {
        // Verify AMR (US)
        await verifyHolidaysForRegion(TEST_YEAR, 'AMR', 'Thanksgiving Day');

        // Verify SGP (Singapore)
        await verifyHolidaysForRegion(TEST_YEAR, 'SGP', 'Christmas Day'); // Deepavali might range, Christmas is standard
        // Or National Day
        await verifyHolidaysForRegion(TEST_YEAR, 'SGP', 'National Day');

        // Verify LDN (UK)
        await verifyHolidaysForRegion(TEST_YEAR, 'LDN', 'Boxing Day');

    } catch (error) {
        console.error('Verification failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
