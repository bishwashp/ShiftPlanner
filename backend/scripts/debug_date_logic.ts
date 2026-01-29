
import moment from 'moment';

function checkLogic() {
    const weekStart = moment.utc('2026-04-05').startOf('week'); // Sunday Apr 5
    const lookbackWeeks = 4;
    const lookbackStart = moment.utc(weekStart).subtract(lookbackWeeks, 'weeks'); // March 8

    // Simulate Swati's Plan for March 29 (Sunday)
    // Rotation Plans usually start on Sunday for SUN-THU
    const plan = {
        pattern: 'SUN_THU',
        startDate: moment.utc('2026-03-29').toDate() // Sunday Mar 29
    };

    console.log(`Checking Plan: ${moment.utc(plan.startDate).format()}`);
    console.log(`LookbackStart: ${lookbackStart.format()}`);
    console.log(`WeekStart: ${weekStart.format()}`);

    const isSunThu = plan.pattern === 'SUN_THU';
    const isAfter = moment.utc(plan.startDate).startOf('day').isAfter(lookbackStart.startOf('day'));
    const isBefore = moment.utc(plan.startDate).startOf('day').isBefore(moment.utc(weekStart).startOf('day'));

    console.log(`1. Is SUN_THU? ${isSunThu}`);
    console.log(`2. Is After Lookback? ${isAfter}`);
    console.log(`3. Is Before WeekStart? ${isBefore}`);

    if (isSunThu && isAfter && isBefore) {
        console.log('✅ Swati SHOULD be Excluded');
    } else {
        console.log('❌ Swati NOT Excluded (Logic Bug)');
    }
}

checkLogic();
