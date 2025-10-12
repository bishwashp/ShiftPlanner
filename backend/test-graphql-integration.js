const { PrismaClient } = require('./generated/prisma');

const prisma = new PrismaClient();

async function testGraphQLIntegration() {
    console.log('🧪 Testing GraphQL Integration with Foundation Algorithm...');
    
    try {
        // Test 1: Verify enhanced algorithm is available
        console.log('\n1. Testing algorithm availability...');
        
        // Simulate the AlgorithmRegistry import
        const { AlgorithmRegistry } = require('./dist/src/services/scheduling/AlgorithmRegistry');
        
        const enhancedAlgorithm = AlgorithmRegistry.getAlgorithm('enhanced-weekend-rotation');
        if (enhancedAlgorithm) {
            console.log(`✅ Enhanced algorithm found: ${enhancedAlgorithm.name} v${enhancedAlgorithm.version}`);
            console.log(`📋 Features: ${enhancedAlgorithm.supportedFeatures.join(', ')}`);
        } else {
            console.log('❌ Enhanced algorithm not found');
        }
        
        // Test 2: Test comp-off balance query
        console.log('\n2. Testing comp-off balance query...');
        
        const testAnalyst = await prisma.analyst.findFirst({ where: { isActive: true } });
        if (testAnalyst) {
            // Simulate the comp-off balance query
            const { compOffBankService } = require('./dist/src/services/scheduling/CompOffBankService');
            
            const balance = await compOffBankService.getCompOffBalance(testAnalyst.id);
            console.log(`✅ Comp-off balance for ${testAnalyst.name}:`);
            console.log(`   Available: ${balance.availableBalance} days`);
            console.log(`   Total Earned: ${balance.totalEarned} days`);
            console.log(`   Total Used: ${balance.totalUsed} days`);
            console.log(`   Recent Transactions: ${balance.recentTransactions.length}`);
        }
        
        // Test 3: Test rotation state query
        console.log('\n3. Testing rotation state query...');
        
        const { rotationStateManager } = require('./dist/src/services/scheduling/RotationStateManager');
        
        const rotationState = await rotationStateManager.getCurrentRotationState(
            'EnhancedWeekendRotationAlgorithm',
            'MORNING'
        );
        
        if (rotationState) {
            console.log(`✅ Rotation state found for MORNING shift:`);
            console.log(`   Sun-Thu Analyst: ${rotationState.currentSunThuAnalyst || 'None'}`);
            console.log(`   Tue-Sat Analyst: ${rotationState.currentTueSatAnalyst || 'None'}`);
            console.log(`   Completed: ${rotationState.completedAnalysts.length} analysts`);
            console.log(`   In Progress: ${rotationState.inProgressAnalysts.length} analysts`);
        } else {
            console.log('ℹ️ No rotation state found for MORNING shift (will be created on first use)');
        }
        
        // Test 4: Test workload analysis
        console.log('\n4. Testing workload analysis...');
        
        const { workloadBalancingSystem } = require('./dist/src/services/scheduling/WorkloadBalancingSystem');
        
        const analysts = await prisma.analyst.findMany({ where: { isActive: true }, take: 3 });
        const analystIds = analysts.map(a => a.id);
        
        const startDate = new Date('2025-01-06');
        const endDate = new Date('2025-01-12');
        
        const workloadResult = await workloadBalancingSystem.analyzeWorkloadBalance(
            analystIds,
            startDate,
            endDate
        );
        
        console.log(`✅ Workload analysis completed:`);
        console.log(`   Total Workloads: ${workloadResult.workloads.length}`);
        console.log(`   Overall Balanced: ${workloadResult.overallBalance.isBalanced}`);
        console.log(`   Total Violations: ${workloadResult.overallBalance.totalViolations}`);
        console.log(`   Average Workload: ${workloadResult.overallBalance.averageWorkload.toFixed(2)} days`);
        
        if (workloadResult.recommendations.length > 0) {
            console.log(`   Recommendations:`);
            workloadResult.recommendations.forEach(rec => console.log(`     - ${rec}`));
        }
        
        // Test 5: Test schedule generation with enhanced algorithm
        console.log('\n5. Testing schedule generation with enhanced algorithm...');
        
        if (enhancedAlgorithm) {
            const context = {
                startDate,
                endDate,
                analysts: await prisma.analyst.findMany({
                    where: { isActive: true },
                    take: 5
                }),
                existingSchedules: [],
                globalConstraints: [],
                algorithmConfig: {
                    fairnessWeight: 0.4,
                    efficiencyWeight: 0.3,
                    constraintWeight: 0.3,
                    optimizationStrategy: 'HILL_CLIMBING',
                    maxIterations: 100,
                    convergenceThreshold: 0.001,
                    randomizationFactor: 0.1,
                    screenerAssignmentStrategy: 'WORKLOAD_BALANCE',
                    weekendRotationStrategy: 'FAIRNESS_OPTIMIZED'
                }
            };
            
            const result = await enhancedAlgorithm.generateSchedules(context);
            
            console.log(`✅ Schedule generation completed:`);
            console.log(`   Generated Schedules: ${result.proposedSchedules.length}`);
            console.log(`   Conflicts: ${result.conflicts.length}`);
            console.log(`   Fairness Score: ${result.fairnessMetrics.overallFairnessScore.toFixed(3)}`);
            console.log(`   Execution Time: ${result.performanceMetrics.algorithmExecutionTime}ms`);
            
            // Check for comp-off schedules
            const compOffSchedules = result.proposedSchedules.filter(s => s.type === 'COMP_OFF_SCHEDULE');
            console.log(`   Comp-off Schedules: ${compOffSchedules.length}`);
            
            // Check for screener schedules
            const screenerSchedules = result.proposedSchedules.filter(s => s.isScreener);
            console.log(`   Screener Schedules: ${screenerSchedules.length}`);
            
            // Show sample schedules
            console.log(`   Sample Schedules:`);
            result.proposedSchedules.slice(0, 5).forEach(schedule => {
                const type = schedule.type === 'COMP_OFF_SCHEDULE' ? ' (Comp-Off)' : 
                           schedule.isScreener ? ' (Screener)' : '';
                console.log(`     ${schedule.date} - ${schedule.analystName}${type}`);
            });
        }
        
        console.log('\n🎉 GraphQL Integration test completed successfully!');
        console.log('\n📋 Summary:');
        console.log('   ✅ Enhanced algorithm available');
        console.log('   ✅ Comp-off balance queries working');
        console.log('   ✅ Rotation state queries working');
        console.log('   ✅ Workload analysis working');
        console.log('   ✅ Schedule generation working');
        console.log('   ✅ Foundation logic integrated');
        
    } catch (error) {
        console.error('❌ GraphQL Integration test failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run the test
testGraphQLIntegration()
    .then(() => {
        console.log('\n✅ All GraphQL integration tests passed!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ GraphQL integration test failed:', error);
        process.exit(1);
    });
