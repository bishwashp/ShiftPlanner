"use strict";
/**
 * Script to clear all schedules from the database
 *
 * Usage:
 * npx ts-node scripts/clear-schedules.ts
 *
 * Options:
 * --keep-continuity: Don't delete pattern continuity data
 * --date-range <start> <end>: Only delete schedules in this date range (YYYY-MM-DD format)
 * --analyst <id>: Only delete schedules for a specific analyst
 * --help: Show usage information
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearSchedules = clearSchedules;
const prisma_1 = require("../src/lib/prisma");
function clearSchedules(options) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log('🧹 Clearing schedules from the database...');
            // Build where clause
            const where = {};
            if (options.startDate && options.endDate) {
                console.log(`📅 Date range: ${options.startDate.toISOString().split('T')[0]} to ${options.endDate.toISOString().split('T')[0]}`);
                where.date = {
                    gte: options.startDate,
                    lte: options.endDate
                };
            }
            if (options.analystId) {
                console.log(`👤 Analyst ID: ${options.analystId}`);
                where.analystId = options.analystId;
            }
            // Count schedules before deletion
            const beforeCount = yield prisma_1.prisma.schedule.count({ where });
            console.log(`📊 Found ${beforeCount} schedules matching criteria`);
            // Delete schedules
            const result = yield prisma_1.prisma.schedule.deleteMany({ where });
            console.log(`✅ Successfully deleted ${result.count} schedules`);
            // Clear pattern continuity data if requested
            if (!options.keepContinuity) {
                const continuityWhere = {};
                if (options.analystId) {
                    continuityWhere.analystId = options.analystId;
                }
                const continuityResult = yield prisma_1.prisma.patternContinuity.deleteMany({
                    where: continuityWhere
                });
                console.log(`✅ Successfully deleted ${continuityResult.count} pattern continuity records`);
            }
            // Verify deletion
            const afterCount = yield prisma_1.prisma.schedule.count({ where });
            console.log(`📊 Found ${afterCount} schedules after deletion`);
        }
        catch (error) {
            console.error('❌ Error clearing schedules:', error);
        }
        finally {
            yield prisma_1.prisma.$disconnect();
        }
    });
}
// Parse command line arguments
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        keepContinuity: false
    };
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--help':
                console.log(`
Usage: npx ts-node scripts/clear-schedules.ts [options]

Options:
  --keep-continuity          Don't delete pattern continuity data
  --date-range <start> <end> Only delete schedules in this date range (YYYY-MM-DD format)
  --analyst <id>             Only delete schedules for a specific analyst
  --help                     Show this help message
        `);
                process.exit(0);
                break;
            case '--keep-continuity':
                options.keepContinuity = true;
                break;
            case '--date-range':
                if (i + 2 < args.length) {
                    try {
                        options.startDate = new Date(args[i + 1] + 'T00:00:00');
                        options.endDate = new Date(args[i + 2] + 'T23:59:59');
                        i += 2;
                    }
                    catch (e) {
                        console.error('❌ Invalid date format. Use YYYY-MM-DD');
                        process.exit(1);
                    }
                }
                else {
                    console.error('❌ --date-range requires two arguments: start and end dates');
                    process.exit(1);
                }
                break;
            case '--analyst':
                if (i + 1 < args.length) {
                    options.analystId = args[i + 1];
                    i++;
                }
                else {
                    console.error('❌ --analyst requires an argument: analyst ID');
                    process.exit(1);
                }
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
    clearSchedules(options)
        .then(() => console.log('✅ Operation completed'))
        .catch(e => console.error('❌ Operation failed:', e));
}
//# sourceMappingURL=clear-schedules.js.map