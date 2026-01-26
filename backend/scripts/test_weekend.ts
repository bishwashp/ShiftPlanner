
import moment from 'moment-timezone';
import { isWeekend } from '../src/utils/dateUtils';

const timezone = 'America/New_York';

function check() {
    console.log('🕵️‍♂️ Checking Weekend Logic...');

    // Test Nov 20 (Friday)
    const fri = moment.tz('2026-11-20', timezone).startOf('day').toDate();
    console.log(`Fri Nov 20: ${fri.toISOString()} | Day: ${moment.utc(fri).day()} | isWeekend: ${isWeekend(fri)}`);

    // Test Nov 21 (Saturday)
    const sat = moment.tz('2026-11-21', timezone).startOf('day').toDate();
    console.log(`Sat Nov 21: ${sat.toISOString()} | Day: ${moment.utc(sat).day()} | isWeekend: ${isWeekend(sat)}`);
}

check();
