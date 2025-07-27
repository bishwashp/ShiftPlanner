import { Analyst, Schedule, SchedulingConstraint } from '@prisma/client';

export interface SchedulingContext {
    startDate: Date;
    endDate: Date;
    analysts: Analyst[];
    existingSchedules: Schedule[];
    globalConstraints: SchedulingConstraint[];
}

export interface SchedulingResult {
    proposedSchedules: any[];
    conflicts: any[];
    overwrites: any[];
}

export interface SchedulingAlgorithm {
    name: string;
    description: string;
    generateSchedules(context: SchedulingContext): Promise<SchedulingResult>;
} 