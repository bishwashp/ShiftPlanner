import { SchedulingAlgorithm, SchedulingContext, SchedulingResult } from "./types";
import { Analyst, Schedule, SchedulingConstraint } from '@prisma/client';

class WeekendRotationAlgorithm implements SchedulingAlgorithm {
    name = "weekend-rotation";
    description = "A simple rotation-based algorithm with weekend coverage.";

    async generateSchedules(context: SchedulingContext): Promise<SchedulingResult> {
        const { startDate, endDate, analysts, existingSchedules, globalConstraints } = context;

        const regularSchedulesResult = await this.generateRegularWorkSchedules(startDate, endDate, analysts, existingSchedules, globalConstraints);
    
        const allProposedSchedules = [...regularSchedulesResult.proposedSchedules];
        const allConflicts = [...regularSchedulesResult.conflicts];
        const allOverwrites = [...regularSchedulesResult.overwrites];
      
        const screenerSchedulesResult = await this.generateScreenerSchedules(
          startDate,
          endDate,
          analysts,
          existingSchedules,
          globalConstraints,
          allProposedSchedules
        );
      
        screenerSchedulesResult.proposedSchedules.forEach(screenerSchedule => {
          const index = allProposedSchedules.findIndex(p => p.analystId === screenerSchedule.analystId && p.date === screenerSchedule.date);
      
          if (index !== -1) {
            allProposedSchedules[index].isScreener = true;
            if (screenerSchedule.type === 'OVERWRITE_SCHEDULE' && allProposedSchedules[index].type !== 'OVERWRITE_SCHEDULE') {
                allProposedSchedules[index].type = 'OVERWRITE_SCHEDULE';
                const existingOverwrite = allOverwrites.find(o => o.date === screenerSchedule.date && o.analystId === screenerSchedule.analystId);
                if(!existingOverwrite) {
                    allOverwrites.push({
                        date: screenerSchedule.date,
                        analystId: screenerSchedule.analystId,
                        analystName: screenerSchedule.analystName,
                        from: { shiftType: allProposedSchedules[index].shiftType, isScreener: false },
                        to: { shiftType: allProposedSchedules[index].shiftType, isScreener: true }
                    });
                }
            }
          } else {
            allProposedSchedules.push(screenerSchedule);
          }
        });
      
        allConflicts.push(...screenerSchedulesResult.conflicts);
        allOverwrites.push(...screenerSchedulesResult.overwrites.filter(o => !allOverwrites.some(existing => existing.date === o.date && existing.analystId === o.analystId)));
      
        return { proposedSchedules: allProposedSchedules, conflicts: allConflicts, overwrites: allOverwrites };
    }

    private async generateRegularWorkSchedules(
        startDate: Date,
        endDate: Date,
        analysts: any[],
        existingSchedules: any[],
        globalConstraints: any[]
      ) {
        const result = {
          proposedSchedules: [] as any[],
          conflicts: [] as any[],
          overwrites: [] as any[]
        };
      
        const workPatterns = [
          { name: 'SUN_THU', days: [0, 1, 2, 3, 4], nextPattern: 'TUE_SAT' },
          { name: 'MON_FRI', days: [1, 2, 3, 4, 5], nextPattern: 'SUN_THU' },
          { name: 'TUE_SAT', days: [2, 3, 4, 5, 6], nextPattern: 'MON_FRI' }
        ];
      
        const morningAnalysts = analysts.filter(a => a.shiftType === 'MORNING');
        const eveningAnalysts = analysts.filter(a => a.shiftType === 'EVENING');
      
        let morningPatterns = this.assignAnalystsToPatterns(morningAnalysts, workPatterns);
        let eveningPatterns = this.assignAnalystsToPatterns(eveningAnalysts, workPatterns);
      
        const loopEndDate = new Date(endDate);
        const currentDate = this.getWeekStart(new Date(startDate));
      
        while (currentDate <= loopEndDate) {
          const weekStart = new Date(currentDate);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);
          
          const effectiveWeekStart = new Date(Math.max(weekStart.getTime(), startDate.getTime()));
          const effectiveWeekEnd = new Date(Math.min(weekEnd.getTime(), endDate.getTime()));
      
          if (effectiveWeekStart <= effectiveWeekEnd) {
            const weekSchedules = this.generateWeekSchedules(effectiveWeekStart, effectiveWeekEnd, morningPatterns, eveningPatterns, existingSchedules, globalConstraints, result.overwrites);
            result.proposedSchedules.push(...weekSchedules.proposedSchedules);
            result.conflicts.push(...weekSchedules.conflicts);
          }
      
          morningPatterns = this.rotatePatterns(morningPatterns, workPatterns);
          eveningPatterns = this.rotatePatterns(eveningPatterns, workPatterns);
          
          currentDate.setDate(currentDate.getDate() + 7);
        }
      
        return result;
      }

      private assignAnalystsToPatterns(analysts: any[], patterns: any[]) {
        const assignments: { [key: string]: { pattern: any; analysts: any[] } } = {};
        patterns.forEach(p => {
          assignments[p.name] = { pattern: p, analysts: [] };
        });
      
        analysts.forEach((analyst, index) => {
          const patternName = patterns[index % patterns.length].name;
          assignments[patternName].analysts.push(analyst);
        });
      
        return assignments;
      }

      private rotatePatterns(
        patternAssignments: { [key: string]: { pattern: any; analysts: any[] } },
        patterns: any[]
      ) {
          const newAssignments: { [key: string]: { pattern: any; analysts: any[] } } = {};
          patterns.forEach(p => {
              newAssignments[p.name] = { pattern: p, analysts: [] };
          });
      
          for (const patternName in patternAssignments) {
              const assignment = patternAssignments[patternName];
              const nextPatternName = assignment.pattern.nextPattern;
              newAssignments[nextPatternName].analysts.push(...assignment.analysts);
          }
      
          return newAssignments;
      }
      
      private getWeekStart(date: Date): Date {
        const result = new Date(date);
        result.setHours(0, 0, 0, 0);
        const day = result.getDay();
        result.setDate(result.getDate() - day);
        return result;
      }

      private generateWeekSchedules(
        weekStart: Date,
        weekEnd: Date,
        morningPatterns: any,
        eveningPatterns: any,
        existingSchedules: any[],
        globalConstraints: any[],
        overwrites: any[]
      ) {
        const result = {
          proposedSchedules: [] as any[],
          conflicts: [] as any[],
        };
      
        const currentDate = new Date(weekStart);
        while(currentDate <= weekEnd) {
          const dayOfWeek = currentDate.getDay();
      
          const blackoutConstraint = globalConstraints.find(c => new Date((c as any).startDate) <= currentDate && new Date((c as any).endDate) >= currentDate && (c as any).constraintType === 'BLACKOUT_DATE');
          if (blackoutConstraint) {
            result.conflicts.push({
              date: currentDate.toISOString().split('T')[0],
              type: 'BLACKOUT_DATE',
              description: (blackoutConstraint as any).description || 'No scheduling allowed on this date'
            });
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
          }
      
          const processShift = (analysts: any[], shiftType: 'MORNING' | 'EVENING') => {
            analysts.forEach(analyst => {
              const schedule = this.createScheduleEntry(analyst, currentDate, shiftType, false, existingSchedules, overwrites);
              if (schedule) result.proposedSchedules.push(schedule);
            });
          };
      
          processShift(this.getAnalystsForDay(morningPatterns, dayOfWeek), 'MORNING');
          processShift(this.getAnalystsForDay(eveningPatterns, dayOfWeek), 'EVENING');
      
          currentDate.setDate(currentDate.getDate() + 1);
        }
      
        return result;
      }

      private getAnalystsForDay(patternAssignments: any, dayOfWeek: number) {
        const workingAnalysts: any[] = [];
        for (const patternName in patternAssignments) {
          const assignment = patternAssignments[patternName];
          if (assignment.pattern.days.includes(dayOfWeek)) {
            workingAnalysts.push(...assignment.analysts);
          }
        }
        return workingAnalysts;
      }

      private createScheduleEntry(
        analyst: any,
        date: Date,
        shiftType: string,
        isScreener: boolean,
        existingSchedules: any[],
        overwrites: any[]
      ) {
        const dateStr = date.toISOString().split('T')[0];
        
        const onVacation = analyst.vacations.some((v: any) => new Date(v.startDate) <= date && new Date(v.endDate) >= date);
        if (onVacation) return null;
      
        const existingSchedule = existingSchedules.find(s => (s as any).analystId === analyst.id && new Date((s as any).date).toISOString().split('T')[0] === dateStr);
      
        const scheduleData = {
          date: dateStr,
          analystId: analyst.id,
          analystName: analyst.name,
          shiftType,
          isScreener
        };
      
        if (existingSchedule) {
          if ((existingSchedule as any).shiftType !== shiftType || (existingSchedule as any).isScreener !== isScreener) {
              overwrites.push({
                  date: dateStr,
                  analystId: analyst.id,
                  analystName: analyst.name,
                  from: { shiftType: (existingSchedule as any).shiftType, isScreener: (existingSchedule as any).isScreener },
                  to: { shiftType, isScreener }
              });
            return { ...scheduleData, type: 'OVERWRITE_SCHEDULE' };
          }
          return null; 
        }
      
        return { ...scheduleData, type: 'NEW_SCHEDULE' };
      }

      private async generateScreenerSchedules(
        startDate: Date,
        endDate: Date,
        analysts: any[],
        existingSchedules: any[],
        globalConstraints: any[],
        regularSchedules: any[]
    ) {
        const result = {
          proposedSchedules: [] as any[],
          conflicts: [] as any[],
          overwrites: [] as any[]
        };
      
        const currentDate = new Date(startDate);
        let screenerIndex = 0;
      
        while (currentDate <= endDate) {
          const dateStr = currentDate.toISOString().split('T')[0];
          const dayOfWeek = currentDate.getDay();
      
          if (dayOfWeek === 0 || dayOfWeek === 6) {
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
          }
      
          const blackoutConstraint = globalConstraints.find(c => new Date((c as any).startDate) <= currentDate && new Date((c as any).endDate) >= currentDate && (c as any).constraintType === 'BLACKOUT_DATE');
          if (blackoutConstraint) {
            result.conflicts.push({ date: dateStr, type: 'BLACKOUT_DATE', description: (blackoutConstraint as any).description || 'No scheduling allowed on this date' });
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
          }
      
          const workingAnalysts = regularSchedules
            .filter(s => s.date === dateStr && !s.isScreener)
            .map(s => analysts.find(a => a.id === s.analystId))
            .filter(Boolean);
      
          const morningAnalysts = workingAnalysts.filter((a: any) => a.shiftType === 'MORNING');
          const eveningAnalysts = workingAnalysts.filter((a: any) => a.shiftType === 'EVENING');
      
          const assignScreener = (shiftAnalysts: any[], shiftType: 'MORNING' | 'EVENING') => {
            if (shiftAnalysts.length > 0) {
                const eligibleAnalysts = shiftAnalysts.filter(a => !a.vacations.some((v: any) => new Date(v.startDate) <= currentDate && new Date(v.endDate) >= currentDate));
                if(eligibleAnalysts.length > 0) {
                    
                    // Skill-based assignment for screeners
                    const skilledAnalysts = eligibleAnalysts.filter(a => a.skills?.includes('screener-training'));

                    let selectedScreener;
                    if (skilledAnalysts.length > 0) {
                        selectedScreener = skilledAnalysts[screenerIndex % skilledAnalysts.length];
                    } else {
                        selectedScreener = eligibleAnalysts[screenerIndex % eligibleAnalysts.length];
                    }

                    const screenerSchedule = this.createScreenerSchedule(selectedScreener, currentDate, shiftType, existingSchedules, result.overwrites);
                    if (screenerSchedule) result.proposedSchedules.push(screenerSchedule);
                }
            }
          };
      
          assignScreener(morningAnalysts, 'MORNING');
          assignScreener(eveningAnalysts, 'EVENING');
      
          screenerIndex++;
          currentDate.setDate(currentDate.getDate() + 1);
        }
      
        return result;
    }

    private createScreenerSchedule(
        analyst: any,
        date: Date,
        shiftType: string,
        existingSchedules: any[],
        overwrites: any[]
    ) {
        const dateStr = date.toISOString().split('T')[0];
      
        const scheduleData = {
            date: dateStr,
            analystId: analyst.id,
            analystName: analyst.name,
            shiftType,
            isScreener: true,
        };
    
        const existingSchedule = existingSchedules.find(s => (s as any).analystId === analyst.id && new Date((s as any).date).toISOString().split('T')[0] === dateStr);
    
        if (existingSchedule) {
          if (!(existingSchedule as any).isScreener) {
            overwrites.push({
                date: dateStr,
                analystId: analyst.id,
                analystName: analyst.name,
                from: { shiftType: (existingSchedule as any).shiftType, isScreener: false },
                to: { shiftType, isScreener: true }
            });
            return { ...scheduleData, type: 'OVERWRITE_SCHEDULE' };
          }
          return null;
        }
      
        return { ...scheduleData, type: 'NEW_SCHEDULE' };
    }
}

export default new WeekendRotationAlgorithm(); 