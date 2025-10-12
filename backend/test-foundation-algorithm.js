const { PrismaClient } = require('./generated/prisma');
const { AlgorithmRegistry } = require('./dist/src/services/scheduling/AlgorithmRegistry');

const prisma = new PrismaClient();

async function testFoundationAlgorithm() {
    console.log('🧪 Testing Foundation Algorithm...');
    
    try {
        // Get the enhanced algorithm
        const algorithm = AlgorithmRegistry.getAlgorithm('enhanced-weekend-rotation');
        
        if (!algorithm) {
            throw new Error('Enhanced Weekend Rotation Algorithm not found');
        }
        
        console.log(`✅ Found algorithm: ${algorithm.name} v${algorithm.version}`);
        console.log(`📋 Supported features: ${algorithm.supportedFeatures.join(', ')}`);
        
        // Get some test analysts
        const analysts = await prisma.analyst.findMany({
            where: { isActive: true },
            take: 5
        });
        
        if (analysts.length === 0) {
            console.log('⚠️ No active analysts found. Creating test analysts...');
            
            // Create test analysts
            const testAnalysts = [
                { name: 'Test Analyst A', email: 'test-a@example.com', shiftType: 'MORNING' },
                { name: 'Test Analyst B', email: 'test-b@example.com', shiftType: 'MORNING' },
                { name: 'Test Analyst C', email: 'test-c@example.com', shiftType: 'EVENING' },
                { name: 'Test Analyst D', email: 'test-d@example.com', shiftType: 'EVENING' },
                { name: 'Test Analyst E', email: 'test-e@example.com', shiftType: 'MORNING' }
            ];
            
            for (const analyst of testAnalysts) {
                await prisma.analyst.create({ data: analyst });
            }
            
            console.log('✅ Created test analysts');
        }
        
        // Get analysts again
        const testAnalysts = await prisma.analyst.findMany({
            where: { isActive: true },
            take: 5
        });
        
        console.log(`📊 Found ${testAnalysts.length} analysts for testing`);
        
        // Create test context
        const startDate = new Date('2025-01-06'); // Monday
        const endDate = new Date('2025-01-12'); // Sunday (one week)
        
        const context = {
            startDate,
            endDate,
            analysts: testAnalysts,
            existingSchedules: [],
            globalConstraints: [],
            algorithmConfig: {
                fairnessWeight: 0.4,
                efficiencyWeight: 0.3,
                constraintWeight: 0.3,
                optimizationStrategy: 'HILL_CLIMBING',
                maxIterations: 1000,
                convergenceThreshold: 0.001,
                randomizationFactor: 0.1,
                screenerAssignmentStrategy: 'WORKLOAD_BALANCE',
                weekendRotationStrategy: 'FAIRNESS_OPTIMIZED'
            }
        };
        
        console.log(`📅 Testing schedule generation for ${startDate.toDateString()} to ${endDate.toDateString()}`);
        
        // Generate schedules
        const result = await algorithm.generateSchedules(context);
        
        console.log('✅ Schedule generation completed!');
        console.log(`📈 Generated ${result.proposedSchedules.length} schedules`);
        console.log(`⚖️ Fairness score: ${result.fairnessMetrics.overallFairnessScore.toFixed(3)}`);
        console.log(`⏱️ Execution time: ${result.performanceMetrics.algorithmExecutionTime}ms`);
        
        // Analyze the results
        const schedulesByType = result.proposedSchedules.reduce((acc, schedule) => {
            const type = schedule.shiftType || 'UNKNOWN';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {});
        
        console.log('📊 Schedule breakdown:');
        Object.entries(schedulesByType).forEach(([type, count]) => {
            console.log(`   ${type}: ${count} schedules`);
        });
        
        // Check for comp-off schedules
        const compOffSchedules = result.proposedSchedules.filter(s => s.type === 'COMP_OFF_SCHEDULE');
        console.log(`🏖️ Comp-off schedules: ${compOffSchedules.length}`);
        
        // Check for screener schedules
        const screenerSchedules = result.proposedSchedules.filter(s => s.isScreener);
        console.log(`🔍 Screener schedules: ${screenerSchedules.length}`);
        
        // Show sample schedules
        console.log('\n📋 Sample schedules:');
        result.proposedSchedules.slice(0, 10).forEach(schedule => {
            console.log(`   ${schedule.date} - ${schedule.analystName} (${schedule.shiftType}${schedule.isScreener ? ', Screener' : ''}${schedule.type === 'COMP_OFF_SCHEDULE' ? ', Comp-Off' : ''})`);
        });
        
        console.log('\n🎉 Foundation algorithm test completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run the test
testFoundationAlgorithm()
    .then(() => {
        console.log('✅ All tests passed!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Test failed:', error);
        process.exit(1);
    });
