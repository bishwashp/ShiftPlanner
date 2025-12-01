import moment from 'moment-timezone';
import { prisma } from '../lib/prisma';
import { replacementService } from './ReplacementService';
import { fairnessDebtService } from './FairnessDebtService';
import { DateUtils } from '../utils/dateUtils';

export interface AbsenceImpactReport {
    teamAvailability: number; // Percentage
    coverageRisk: 'AUTO' | 'MANUAL' | 'IMPOSSIBLE';
    fairnessImpact: number; // StdDev change (simulated)
    rotationDisruption: boolean;
    concurrentAbsences: number;
    replacementPlan: ReplacementPlanItem[];
    recommendation: 'APPROVE' | 'APPROVE_WITH_CONDITIONS' | 'SUGGEST_RESCHEDULE' | 'DENY';
    concerns: string[];
}

export interface ReplacementPlanItem {
    date: string;
    shiftType: string;
    originalAnalystId: string;
    replacementAnalystId?: string;
    replacementAnalystName?: string;
    confidence: number;
    concerns: string[];
}

export class AbsenceImpactAnalyzer {
    /**
     * Analyze the impact of a proposed absence
     */
    async analyzeAbsenceImpact(absenceData: {
        analystId: string;
        startDate: Date;
        endDate: Date;
        type: string;
    }): Promise<AbsenceImpactReport> {
        const { analystId, startDate, endDate } = absenceData;
        const start = moment.utc(startDate).startOf('day');
        const end = moment.utc(endDate).startOf('day');

        // 1. Calculate Team Availability
        const totalAnalysts = await prisma.analyst.count({ where: { isActive: true } });
        const overlappingAbsences = await prisma.absence.count({
            where: {
                startDate: { lte: end.toDate() },
                endDate: { gte: start.toDate() },
                isApproved: true,
                analystId: { not: analystId } // Exclude self if updating
            }
        });

        // Average absent analysts per day during period (simplified)
        const concurrentAbsences = overlappingAbsences;
        const avgAvailable = Math.max(0, totalAnalysts - concurrentAbsences - 1); // -1 for this absence
        const teamAvailability = (avgAvailable / totalAnalysts) * 100;

        // 2. Generate Replacement Plan & Assess Risk
        const replacementPlan = await this.generateReplacementPlan(absenceData);

        let coverageRisk: 'AUTO' | 'MANUAL' | 'IMPOSSIBLE' = 'AUTO';
        const lowConfidenceCount = replacementPlan.filter(p => p.confidence < 0.7).length;
        const noReplacementCount = replacementPlan.filter(p => !p.replacementAnalystId).length;

        if (noReplacementCount > 0) {
            coverageRisk = 'IMPOSSIBLE';
        } else if (lowConfidenceCount > 0) {
            coverageRisk = 'MANUAL';
        }

        // 3. Check Rotation Disruption
        // Check if analyst is scheduled for Weekend or Screener during this time
        const existingSchedules = await prisma.schedule.findMany({
            where: {
                analystId,
                date: { gte: start.toDate(), lte: end.toDate() }
            }
        });

        const rotationDisruption = existingSchedules.some(s => s.shiftType === 'WEEKEND' || s.isScreener);

        // 4. Fairness Impact (Simulated)
        // This is complex to calculate exactly without full simulation.
        // Proxy: Does this create significant debt?
        // If Vacation, yes.
        const fairnessImpact = absenceData.type === 'VACATION' ? 1.0 : 0.0;

        // 5. Generate Recommendation
        const recommendation = this.generateApprovalRecommendation(
            coverageRisk,
            teamAvailability,
            rotationDisruption
        );

        const concerns: string[] = [];
        if (teamAvailability < 75) concerns.push("Low team availability");
        if (rotationDisruption) concerns.push("Disrupts rotation (Weekend/Screener)");
        if (coverageRisk === 'IMPOSSIBLE') concerns.push("No replacements found for some days");

        return {
            teamAvailability,
            coverageRisk,
            fairnessImpact,
            rotationDisruption,
            concurrentAbsences,
            replacementPlan,
            recommendation,
            concerns
        };
    }

    /**
     * Generate a potential replacement plan for the absence
     */
    async generateReplacementPlan(absenceData: {
        analystId: string;
        startDate: Date;
        endDate: Date;
    }): Promise<ReplacementPlanItem[]> {
        const { analystId, startDate, endDate } = absenceData;
        const plan: ReplacementPlanItem[] = [];

        const start = moment.utc(startDate).startOf('day');
        const end = moment.utc(endDate).startOf('day');
        let current = start.clone();

        while (current.isSameOrBefore(end)) {
            const date = current.toDate();
            const dateStr = DateUtils.formatDate(date);

            // Check if analyst is scheduled
            const schedule = await prisma.schedule.findFirst({
                where: { analystId, date }
            });

            if (schedule) {
                const replacement = await replacementService.findReplacement(
                    date,
                    schedule.shiftType as any,
                    analystId
                );

                if (replacement) {
                    plan.push({
                        date: dateStr,
                        shiftType: schedule.shiftType,
                        originalAnalystId: analystId,
                        replacementAnalystId: replacement.analystId,
                        replacementAnalystName: replacement.analystName,
                        confidence: replacement.confidence,
                        concerns: replacement.concerns
                    });
                } else {
                    plan.push({
                        date: dateStr,
                        shiftType: schedule.shiftType,
                        originalAnalystId: analystId,
                        confidence: 0,
                        concerns: ["No candidate found"]
                    });
                }
            }

            current.add(1, 'day');
        }

        return plan;
    }

    /**
     * Generate recommendation based on metrics
     */
    private generateApprovalRecommendation(
        risk: 'AUTO' | 'MANUAL' | 'IMPOSSIBLE',
        availability: number,
        disruption: boolean
    ): 'APPROVE' | 'APPROVE_WITH_CONDITIONS' | 'SUGGEST_RESCHEDULE' | 'DENY' {
        if (risk === 'IMPOSSIBLE') return 'DENY';
        if (availability < 50) return 'DENY'; // Critical staffing level

        if (risk === 'MANUAL' || disruption || availability < 75) {
            return 'APPROVE_WITH_CONDITIONS'; // Or SUGGEST_RESCHEDULE
        }

        return 'APPROVE';
    }

    /**
     * Get historical absence context
     */
    async getAnalystAbsenceHistory(analystId: string): Promise<any> {
        const currentYear = moment().year();
        const startOfYear = moment.utc(`${currentYear}-01-01`).startOf('day').toDate();

        const absences = await prisma.absence.findMany({
            where: {
                analystId,
                startDate: { gte: startOfYear },
                isApproved: true
            }
        });

        const totalDays = absences.reduce((sum, abs) => {
            return sum + (moment(abs.endDate).diff(moment(abs.startDate), 'days') + 1);
        }, 0);

        return {
            totalAbsences: absences.length,
            totalDays,
            absences
        };
    }
}

export const absenceImpactAnalyzer = new AbsenceImpactAnalyzer();
