
import { scoringEngine } from '../services/scheduling/algorithms/ScoringEngine';
import moment from 'moment';

async function testScoringEngine() {
    console.log('🧪 Testing ScoringEngine...');

    const targetDate = '2025-11-29'; // Saturday
    const shiftType = 'WEEKEND';

    // Mock candidates
    const candidates = [
        { id: 'A1', name: 'Analyst Fresh' },
        { id: 'A2', name: 'Analyst Tired' },
        { id: 'A3', name: 'Analyst Clopening' },
        { id: 'A4', name: 'Analyst WeekendLover', shiftType: 'WEEKEND' }
    ];

    // Mock history
    const history = [
        // Analyst Tired worked last 5 days
        { analystId: 'A2', date: '2025-11-24', shiftType: 'MORNING' },
        { analystId: 'A2', date: '2025-11-25', shiftType: 'MORNING' },
        { analystId: 'A2', date: '2025-11-26', shiftType: 'MORNING' },
        { analystId: 'A2', date: '2025-11-27', shiftType: 'MORNING' },
        { analystId: 'A2', date: '2025-11-28', shiftType: 'MORNING' },

        // Analyst Clopening worked Evening on 28th (Friday)
        { analystId: 'A3', date: '2025-11-28', shiftType: 'EVENING' },

        // Analyst WeekendLover worked last weekend (22nd, 23rd)
        { analystId: 'A4', date: '2025-11-22', shiftType: 'WEEKEND' },
        { analystId: 'A4', date: '2025-11-23', shiftType: 'WEEKEND' }
    ];

    // Test 1: Weekend Shift
    console.log(`\nScenario 1: Assigning ${shiftType} shift on ${targetDate}`);
    const scores = scoringEngine.calculateScores(candidates, targetDate, shiftType as any, history);

    scores.sort((a, b) => b.score - a.score);

    scores.forEach((s, i) => {
        console.log(`${i + 1}. ${s.analystName}: Score ${s.score}`);
        console.log(`   Reasoning: ${s.reasoning.join(', ')}`);
        console.log(`   Factors:`, JSON.stringify(s.factors));
    });

    // Validation
    const winner = scores[0];
    if (winner.analystName === 'Analyst Fresh') {
        console.log('✅ PASS: Analyst Fresh won (as expected)');
    } else if (winner.analystName === 'Analyst WeekendLover') {
        console.log('✅ PASS: Analyst WeekendLover won (preference bonus)');
    } else {
        console.log(`❌ FAIL: Unexpected winner ${winner.analystName}`);
    }

    // Test 2: Morning Shift (Check Clopening)
    console.log(`\nScenario 2: Assigning MORNING shift on 2025-11-29`);
    const morningScores = scoringEngine.calculateScores(candidates, '2025-11-29', 'MORNING', history);
    morningScores.sort((a, b) => b.score - a.score);

    const clopeningAnalyst = morningScores.find(s => s.analystName === 'Analyst Clopening');
    if (clopeningAnalyst && clopeningAnalyst.factors.turnaroundTime === 0) {
        console.log('✅ PASS: Analyst Clopening penalized for turnaround time');
    } else {
        console.log('❌ FAIL: Analyst Clopening not penalized correctly');
    }
}

testScoringEngine().catch(console.error);
