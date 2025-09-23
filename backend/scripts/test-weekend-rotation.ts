/**
 * Test script for the Weekend Rotation Algorithm
 * 
 * Usage:
 * npx ts-node scripts/test-weekend-rotation.ts [options]
 * 
 * Options:
 * --start-date <date>: Start date for test (YYYY-MM-DD format)
 * --end-date <date>: End date for test (YYYY-MM-DD format)
 * --algorithm <type>: Algorithm type (default: weekend-rotation)
 * --clear: Clear existing schedules before testing
 * --help: Show usage information
 */

import { prisma } from '../src/lib/prisma';
import { WeekendRotationAlgorithm } from '../src/services/scheduling/algorithms/WeekendRotationAlgorithm';
import { createLocalDate } from '../src/utils/dateUtils';
import { clearSchedules } from './clear-schedules';

interface TestOptions {
  startDate: Date;
  endDate: Date;
  algorithmType: string;
  clearExisting: boolean;
}

async function testWeekendRotation(options: TestOptions) {
  console.log('🧪 Testing Weekend Rotation Algorithm...');
  console.log(`📅 Test date range: ${options.startDate.toISOString().split('T')[0]} to ${options.endDate.toISOString().split('T')[0]}`);
  console.log(`🔄 Algorithm: ${options.algorithmType}`);
  
  try {
    // Clear existing schedules if requested
    if (options.clearExisting) {
      console.log('🧹 Clearing existing schedules...');
      await clearSchedules({
        keepContinuity: false,
        startDate: options.startDate,
        endDate: options.endDate
      });
    }
    
    // Create algorithm instance
    const algorithm = new WeekendRotationAlgorithm();
    
    // Get analysts from database
    const analysts = await prisma.analyst.findMany({
      where: { isActive: true },
      include: {
        vacations: { where: { isApproved: true } },
        constraints: { where: { isActive: true } }
      }
    });
    
    console.log(`👥 Found ${analysts.length} active analysts`);
    
    // Get existing schedules
    const existingSchedules = await prisma.schedule.findMany({
      where: {
        date: {
          gte: new Date(options.startDate.getTime() - 14 * 24 * 60 * 60 * 1000), // 2 weeks before
          lte: options.endDate
        }
      }
    });
    
    console.log(`📋 Found ${existingSchedules.length} existing schedules`);
    
    // Get global constraints
    const globalConstraints = await prisma.schedulingConstraint.findMany({
      where: {
        analystId: null,
        isActive: true,
        OR: [
          { startDate: { lte: options.endDate }, endDate: { gte: options.startDate } }
        ]
      }
    });
    
    console.log(`🔒 Found ${globalConstraints.length} global constraints`);
    
    // Generate schedules
    console.log('🔄 Generating schedules...');
    const result = await algorithm.generateSchedules({
      startDate: options.startDate,
      endDate: options.endDate,
      analysts,
      existingSchedules,
      globalConstraints,
      algorithmConfig: {
        optimizationStrategy: 'HILL_CLIMBING',
        maxIterations: 1000,
        convergenceThreshold: 0.001,
        fairnessWeight: 0.4,
        efficiencyWeight: 0.3,
        constraintWeight: 0.3,
        randomizationFactor: 0.1,
        screenerAssignmentStrategy: 'WORKLOAD_BALANCE',
        weekendRotationStrategy: 'FAIRNESS_OPTIMIZED'
      }
    });
    
    // Analyze results
    console.log(`✅ Generated ${result.proposedSchedules.length} proposed schedules`);
    console.log(`⚠️ Found ${result.conflicts.length} conflicts`);
    console.log(`🔄 Found ${result.overwrites.length} overwrites`);
    
    // Analyze daily coverage
    const dailyCoverage = new Map<string, any>();
    result.proposedSchedules.forEach((schedule: any) => {
      const date = schedule.date;
      const entry = dailyCoverage.get(date) || { date, morning: 0, evening: 0, morningScreener: false, eveningScreener: false };
      
      if (schedule.shiftType === 'MORNING') {
        entry.morning++;
        if (schedule.isScreener) entry.morningScreener = true;
      } else {
        entry.evening++;
        if (schedule.isScreener) entry.eveningScreener = true;
      }
      
      dailyCoverage.set(date, entry);
    });
    
    // Print daily coverage
    console.log('\n📊 Daily Coverage:');
    console.log('Date        | Morning | Evening | AM Screener | PM Screener |');
    console.log('------------|---------|---------|-------------|-------------|');
    
    const dates = Array.from(dailyCoverage.keys()).sort();
    dates.forEach(date => {
      const coverage = dailyCoverage.get(date);
      console.log(
        `${date}  | ${coverage.morning.toString().padEnd(7)} | ${coverage.evening.toString().padEnd(7)} | ${
          coverage.morningScreener ? 'Yes        ' : 'No         '
        } | ${
          coverage.eveningScreener ? 'Yes        ' : 'No         '
        } |`
      );
    });
    
    // Analyze weekend coverage
    console.log('\n🏖️ Weekend Coverage:');
    dates.forEach(date => {
      const dateObj = createLocalDate(date);
      const dayOfWeek = dateObj.getDay();
      
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        const coverage = dailyCoverage.get(date);
        const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];
        console.log(
          `${date} (${dayName}) | Morning: ${coverage.morning} | Evening: ${coverage.evening} | ` +
          `AM Screener: ${coverage.morningScreener ? 'Yes' : 'No'} | PM Screener: ${coverage.eveningScreener ? 'Yes' : 'No'}`
        );
      }
    });
    
    // Analyze analyst workload
    const analystWorkload = new Map<string, any>();
    result.proposedSchedules.forEach((schedule: any) => {
      const analystId = schedule.analystId;
      const entry = analystWorkload.get(analystId) || { 
        id: analystId, 
        name: schedule.analystName, 
        totalDays: 0, 
        weekendDays: 0, 
        screenerDays: 0 
      };
      
      entry.totalDays++;
      
      const dateObj = createLocalDate(schedule.date);
      const dayOfWeek = dateObj.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        entry.weekendDays++;
      }
      
      if (schedule.isScreener) {
        entry.screenerDays++;
      }
      
      analystWorkload.set(analystId, entry);
    });
    
    // Print analyst workload
    console.log('\n👥 Analyst Workload:');
    console.log('Name                 | Total Days | Weekend Days | Screener Days |');
    console.log('--------------------- |------------|--------------|---------------|');
    
    Array.from(analystWorkload.values()).sort((a, b) => a.name.localeCompare(b.name)).forEach(workload => {
      console.log(
        `${workload.name.padEnd(20)} | ${workload.totalDays.toString().padEnd(10)} | ${
          workload.weekendDays.toString().padEnd(12)
        } | ${workload.screenerDays.toString().padEnd(13)} |`
      );
    });
    
    // Save schedules to database if requested
    if (process.env.SAVE_SCHEDULES === 'true') {
      console.log('\n💾 Saving schedules to database...');
      
      const schedules = result.proposedSchedules.map((schedule: any) => ({
        analystId: schedule.analystId,
        date: createLocalDate(schedule.date),
        shiftType: schedule.shiftType,
        isScreener: schedule.isScreener
      }));
      
      const savedCount = await prisma.schedule.createMany({
        data: schedules
      });
      
      console.log(`✅ Saved ${savedCount.count} schedules to database`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
    console.log('🔌 Database disconnected');
  }
}

// Parse command line arguments
function parseArgs(): TestOptions {
  const args = process.argv.slice(2);
  const options: TestOptions = {
    startDate: createLocalDate('2025-10-05'),
    endDate: createLocalDate('2025-11-01'),
    algorithmType: 'weekend-rotation',
    clearExisting: false
  };
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--help':
        console.log(`
Usage: npx ts-node scripts/test-weekend-rotation.ts [options]

Options:
  --start-date <date>   Start date for test (YYYY-MM-DD format)
  --end-date <date>     End date for test (YYYY-MM-DD format)
  --algorithm <type>    Algorithm type (default: weekend-rotation)
  --clear               Clear existing schedules before testing
  --help                Show this help message
        `);
        process.exit(0);
        break;
        
      case '--start-date':
        if (i + 1 < args.length) {
          try {
            options.startDate = createLocalDate(args[i + 1]);
            i++;
          } catch (e) {
            console.error('❌ Invalid date format. Use YYYY-MM-DD');
            process.exit(1);
          }
        } else {
          console.error('❌ --start-date requires an argument');
          process.exit(1);
        }
        break;
        
      case '--end-date':
        if (i + 1 < args.length) {
          try {
            options.endDate = createLocalDate(args[i + 1]);
            i++;
          } catch (e) {
            console.error('❌ Invalid date format. Use YYYY-MM-DD');
            process.exit(1);
          }
        } else {
          console.error('❌ --end-date requires an argument');
          process.exit(1);
        }
        break;
        
      case '--algorithm':
        if (i + 1 < args.length) {
          options.algorithmType = args[i + 1];
          i++;
        } else {
          console.error('❌ --algorithm requires an argument');
          process.exit(1);
        }
        break;
        
      case '--clear':
        options.clearExisting = true;
        break;
        
      default:
        console.error(`❌ Unknown option: ${args[i]}`);
        console.log('Use --help for usage information');
        process.exit(1);
    }
  }
  
  return options;
}

// Run the function
if (require.main === module) {
  const options = parseArgs();
  testWeekendRotation(options)
    .then(() => console.log('✅ Test completed'))
    .catch(e => console.error('❌ Test error:', e));
}

export { testWeekendRotation };
