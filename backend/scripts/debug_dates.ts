
import moment from 'moment-timezone';

const TIMEZONE = 'America/New_York';

function debugDates() {
    console.log(`🌍 System Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
    console.log(`🎯 Target Timezone: ${TIMEZONE}`);

    // Test 1: Start Date Interpretation
    const startStr = '2026-02-01';
    const startDate = new Date(startStr);
    const startMoment = moment.tz(startStr, TIMEZONE);

    console.log('\n📅 Test 1: Start Date (Feb 1 2026)');
    console.log(`Input String: ${startStr}`);
    console.log(`new Date(): ${startDate.toISOString()} (UTC: ${startDate.getUTCHours()})`);
    console.log(`moment.tz(): ${startMoment.format()} (Hour: ${startMoment.hour()})`);
    console.log(`moment UTC conversion: ${startMoment.clone().utc().format()}`);

    // Test 2: Sunday Detection
    // Feb 1 2026 is a Sunday
    console.log('\n📅 Test 2: Sunday Detection (Feb 1 2026)');
    const sundayRaw = new Date('2026-02-01');
    const sundayMoment = moment.tz('2026-02-01', TIMEZONE);

    console.log(`Raw Date .getDay(): ${sundayRaw.getDay()} (0=Sun, 6=Sat)`);
    console.log(`Moment .day(): ${sundayMoment.day()} (0=Sun, 6=Sat)`);

    // Test 3: Loop Iteration Simulation
    console.log('\n🔄 Test 3: Loop Iteration');
    let current = moment.tz('2026-02-01', TIMEZONE);
    const end = moment.tz('2026-02-07', TIMEZONE); // One week

    while (current.isSameOrBefore(end, 'day')) {
        const isWeekend = current.day() === 0 || current.day() === 6;
        console.log(`${current.format('YYYY-MM-DD HH:mm')} is ${current.format('dddd')} | Day Index: ${current.day()} | isWeekend: ${isWeekend}`);
        current.add(1, 'day');
    }
}

debugDates();
