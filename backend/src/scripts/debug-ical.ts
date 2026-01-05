import { PrismaClient } from '../../generated/prisma';
import { CalendarExportService } from '../services/CalendarExportService';
import moment from 'moment-timezone';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('🔍 Starting iCal Debugging...');

        // 1. Get an analyst
        const analyst = await prisma.analyst.findFirst({
            where: { isActive: true },
            include: { schedules: { take: 1 } }
        });

        if (!analyst) {
            console.error('❌ No active analysts found');
            return;
        }

        console.log(`👤 Testing with analyst: ${analyst.name} (${analyst.id})`);

        // 2. Generate iCal feed for Feb 2026
        const service = new CalendarExportService(prisma);
        const startDate = moment.utc('2026-02-01').toDate();
        const endDate = moment.utc('2026-02-28').toDate();

        console.log(`📅 Requesting feed for range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

        const icalFeed = await service.generateICalFeed(analyst.id, {
            dateRange: { startDate, endDate }
        });

        // 3. Analyze output
        const lines = icalFeed.split('\r\n');
        console.log(`📄 Generated iCal feed with ${lines.length} lines`);

        console.log('\n--- HEADERS ---');
        console.log(lines.slice(0, 10).join('\n'));

        console.log('\n--- EVENTS (Sample) ---');
        const events = lines.filter(l => l.startsWith('SUMMARY:') || l.startsWith('DTSTART:') || l.startsWith('DTEND:'));

        if (events.length === 0) {
            console.warn('⚠️ No events found in the output!');
        } else {
            console.log(events.slice(0, 15).join('\n'));
        }

        // 4. Check against DB
        const dbCount = await prisma.schedule.count({
            where: {
                analystId: analyst.id,
                date: {
                    gte: startDate,
                    lte: endDate
                }
            }
        });
        console.log(`\n📊 DB Record Check: Found ${dbCount} schedules in DB for this period.`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
