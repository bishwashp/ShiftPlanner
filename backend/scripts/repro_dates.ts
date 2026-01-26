
import { isWeekend } from '../src/utils/dateUtils';
import moment from 'moment-timezone';

const timezone = 'America/New_York';

console.log('🕵️‍♂️ Checking Date Logic for Feb 2026...');

const dates = [
    '2026-02-01', // Sunday
    '2026-02-02', // Monday
    '2026-02-06', // Friday
    '2026-02-07'  // Saturday
];

console.log('--- Testing String Input ---');
dates.forEach(d => {
    // Simulate IntelligentScheduler loop initialization
    const m = moment.tz(d, timezone).startOf('day');
    const dateObj = m.toDate();
    const isWknd = isWeekend(dateObj);
    console.log(`Input: ${d} | Moment: ${m.format()} | JS Date: ${dateObj.toISOString()} | Day Index: ${m.day()} | UTC Day: ${moment.utc(dateObj).day()} | isWeekend: ${isWknd}`);
});

console.log('\n--- Testing Date Object Input (Simulating Context) ---');
const dateInput = new Date('2026-02-01'); // UTC Midnight usually
console.log(`Raw Date Input: ${dateInput.toISOString()}`);
const m = moment.tz(dateInput, timezone).startOf('day');
const dateObj = m.toDate();
const isWknd = isWeekend(dateObj);
console.log(`From Date Obj | Moment: ${m.format()} | JS Date: ${dateObj.toISOString()} | Day Index: ${m.day()} | UTC Day: ${moment.utc(dateObj).day()} | isWeekend: ${isWknd}`);

