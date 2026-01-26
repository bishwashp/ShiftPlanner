
import moment from 'moment-timezone';

console.log('🕵️‍♂️ simulating Loop Drift...');

const start = moment.tz('2026-02-01', 'America/New_York');
const end = moment.tz('2026-12-31', 'America/New_York');
const current = start.clone();

let driftDetected = false;

while (current.isSameOrBefore(end, 'day')) {
    const dateStr = current.format('YYYY-MM-DD');

    // Check Oct 9
    if (dateStr === '2026-10-09') {
        const utcDate = moment.utc(dateStr).toDate();
        const dayIndex = moment.utc(utcDate).day();
        console.log(`📅 ${dateStr}: Moment=${current.format()} | DayIndex=${dayIndex} | isWeekend=${dayIndex === 0 || dayIndex === 6}`);
    }
    // Check Oct 16
    if (dateStr === '2026-10-16') {
        const utcDate = moment.utc(dateStr).toDate();
        const dayIndex = moment.utc(utcDate).day();
        console.log(`📅 ${dateStr}: Moment=${current.format()} | DayIndex=${dayIndex} | isWeekend=${dayIndex === 0 || dayIndex === 6}`);
    }

    current.add(1, 'day');
}
