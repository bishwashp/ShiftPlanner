import React, { useState, useEffect, useMemo, useRef } from 'react';
import { apiService, Schedule, MonthlyTally, FairnessReport, Analyst } from '../services/api';
import moment from 'moment';
import {
  ChartBar,
  Warning,
  TrendUp,
  TrendDown,
  ArrowRight,
  Lightbulb,
  Robot,
  Users,
  Siren,
  CheckCircle,
  Trophy,
  Calendar,
  ArrowCounterClockwise,
  Info,
  UsersThree
} from '@phosphor-icons/react';
import { BurnoutModal } from './analytics/BurnoutModal';
import { ActivityRing } from './analytics/ActivityRing';
import { MetricCard } from './analytics/MetricCard';
import { TrendChart } from './analytics/TrendChart';
import { WorkloadTrendChart } from './analytics/WorkloadTrendChart';
import { TeamRadar } from './analytics/TeamRadar';
import { usePeriod } from '../context/PeriodContext';
import { AnalystComparison } from './analytics/AnalystComparison';
import { AnalystHeatmap } from './analytics/AnalystHeatmap';
import { ShiftRadar } from './analytics/ShiftRadar';
import { AnalyticsTabs } from './analytics/AnalyticsTabs';
import { motion } from 'framer-motion';

const Analytics: React.FC = () => {
  // State
  const { period, setPeriod, dateOffset } = usePeriod();
  const [loading, setLoading] = useState(true);
  const [tallyData, setTallyData] = useState<MonthlyTally[]>([]);
  const [fairnessData, setFairnessData] = useState<FairnessReport | null>(null);
  const [analysts, setAnalysts] = useState<Analyst[]>([]);

  const [trendsData, setTrendsData] = useState<Array<{ name: string, fairness: number, avgWeightedScore: number }>>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [burnoutRisks, setBurnoutRisks] = useState<any[]>([]);
  const [isBurnoutModalOpen, setIsBurnoutModalOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'WORKLOAD' | 'SCREENER' | 'WEEKEND'>('WORKLOAD');

  // Refs
  const deepDiveRef = useRef<HTMLDivElement>(null);

  // Date ranges based on Period and Offset
  useEffect(() => {
    const fetchData = async () => {
      // Only show full loading screen on initial mount
      if (!tallyData.length && !schedules.length) {
        setLoading(true);
      }

      try {
        // Calculate base date with offset
        const baseDate = moment().add(dateOffset, period === 'WEEKLY' ? 'weeks' : period === 'MONTHLY' ? 'months' : period === 'QUARTERLY' ? 'quarters' : 'years');

        let startStr, endStr;

        if (period === 'WEEKLY') {
          startStr = baseDate.clone().startOf('week').format('YYYY-MM-DD');
          endStr = baseDate.clone().endOf('week').format('YYYY-MM-DD');
        } else if (period === 'MONTHLY') {
          startStr = baseDate.clone().startOf('month').format('YYYY-MM-DD');
          endStr = baseDate.clone().endOf('month').format('YYYY-MM-DD');
        } else if (period === 'QUARTERLY') {
          startStr = baseDate.clone().startOf('quarter').format('YYYY-MM-DD');
          endStr = baseDate.clone().endOf('quarter').format('YYYY-MM-DD');
        } else if (period === 'YEARLY') {
          startStr = baseDate.clone().startOf('year').format('YYYY-MM-DD');
          endStr = baseDate.clone().endOf('year').format('YYYY-MM-DD');
        } else {
          // Fallback
          startStr = baseDate.clone().startOf('month').format('YYYY-MM-DD');
          endStr = baseDate.clone().endOf('month').format('YYYY-MM-DD');
        }

        const [fairness, scheds, analystList] = await Promise.all([
          apiService.getFairnessReport(startStr, endStr),
          apiService.getSchedules(startStr, endStr),
          apiService.getAnalysts()
        ]);

        // Calculate tally data from schedules (supports all periods, not just current month)
        const tallyMap = new Map<string, any>();

        // Initialize tally for all active analysts
        analystList.filter(a => a.isActive).forEach(analyst => {
          tallyMap.set(analyst.id, {
            analystId: analyst.id,
            analystName: analyst.name,
            totalWorkDays: 0,
            weekendDays: 0,
            screenerDays: 0,
            fairnessScore: 0,
            weightedScore: 0,
            consecutiveWorkDayStreaks: 0
          });
        });

        // Calculate Weighted Scores per Analyst
        analystList.filter(a => a.isActive).forEach(analyst => {
          const analystSchedules = scheds
            .filter(s => s.analystId === analyst.id)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          let weightedScore = 0;
          let lastWasScreener = false;
          let totalWorkDays = 0;
          let weekendDays = 0;
          let screenerDays = 0;

          analystSchedules.forEach(s => {
            totalWorkDays++;
            const m = moment(s.date);
            const isWeekend = m.day() === 0 || m.day() === 6;
            if (isWeekend) weekendDays++;
            if (s.isScreener) screenerDays++;

            // Weighted Logic: Additive
            // Base: 1.0
            // Weekend: +1.0
            // Screener: +1.0
            // Evening: +0.5
            // Consecutive Screener: +1.0

            let weight = 1.0;
            if (isWeekend) weight += 1.0;
            if (s.isScreener) weight += 1.0;
            if (s.shiftType === 'EVENING') weight += 0.5;
            if (s.isScreener && lastWasScreener) weight += 1.0; // Penalty

            weightedScore += weight;
            lastWasScreener = s.isScreener;
          });

          const tally = tallyMap.get(analyst.id);
          if (tally) {
            tally.totalWorkDays = totalWorkDays;
            tally.weekendDays = weekendDays;
            tally.screenerDays = screenerDays;
            tally.weightedScore = weightedScore;
          }
        });

        // Calculate fairness scores based on WEIGHTED workload distribution
        const scores = Array.from(tallyMap.values()).map(t => t.weightedScore);
        const avgScore = scores.reduce((a, b) => a + b, 0) / (scores.length || 1);

        tallyMap.forEach(tally => {
          // Fairness score: closer to average = higher score
          const deviation = Math.abs(tally.weightedScore - avgScore);
          const maxDeviation = avgScore > 0 ? avgScore : 1;
          tally.fairnessScore = Math.max(0, 1 - (deviation / maxDeviation));
        });

        const tallies = Array.from(tallyMap.values());
        setTallyData(tallies);

        // Populate Chart Data (Analyst View)
        // Sort by Weighted Score (Descending) to show busiest first
        const chartData = tallies
          .sort((a, b) => b.weightedScore - a.weightedScore)
          .map(t => ({
            name: t.analystName,
            fairness: t.fairnessScore,
            avgWeightedScore: t.weightedScore
          }));
        setTrendsData(chartData);
        setFairnessData(fairness);
        setSchedules(scheds);
        setAnalysts(analystList);

        // Calculate burnout risk from the schedules (respects period selection)
        const burnoutAssessments = calculateBurnoutRisk(scheds, analystList, period);
        setBurnoutRisks(burnoutAssessments);

        // Calculate trends (mock data for now or derived)

      } catch (error) {
        console.error('Error fetching analytics data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [period, dateOffset]); // Re-fetch when period or offset changes

  // Client-side burnout calculation that respects the selected period
  const calculateBurnoutRisk = (schedules: Schedule[], analysts: Analyst[], selectedPeriod: string) => {
    const assessments: any[] = [];
    const periodDays = selectedPeriod === 'WEEKLY' ? 7 : selectedPeriod === 'MONTHLY' ? 30 : selectedPeriod === 'QUARTERLY' ? 90 : 365;

    for (const analyst of analysts.filter(a => a.isActive)) {
      const analystSchedules = schedules.filter(s => s.analystId === analyst.id).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const totalWorkDays = analystSchedules.length;
      const weekendDays = analystSchedules.filter(s => {
        const day = new Date(s.date).getDay();
        return day === 0 || day === 6;
      }).length;
      const screenerDays = analystSchedules.filter(s => s.isScreener).length;

      // Calculate consecutive streaks
      let maxStreak = 0;
      let currentStreak = 0;
      for (let i = 0; i < analystSchedules.length; i++) {
        if (i === 0) {
          currentStreak = 1;
        } else {
          const prevDate = new Date(analystSchedules[i - 1].date);
          const currDate = new Date(analystSchedules[i].date);
          const diffDays = Math.ceil((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays === 1) {
            currentStreak++;
          } else {
            maxStreak = Math.max(maxStreak, currentStreak);
            currentStreak = 1;
          }
        }
      }
      maxStreak = Math.max(maxStreak, currentStreak);

      // Calculate risk score
      let riskScore = 0;
      const factors: string[] = [];

      // Workload factor - scale by period
      const workloadThreshold = Math.floor(periodDays * 0.83); // 83% utilization
      if (totalWorkDays > workloadThreshold) {
        riskScore += 35;
        factors.push(`Excessive workload: ${totalWorkDays} days in ${periodDays} days`);
      } else if (totalWorkDays > Math.floor(periodDays * 0.75)) {
        riskScore += 15;
        factors.push(`Heavy workload: ${totalWorkDays} days in ${periodDays} days`);
      }

      // Consecutive streaks
      if (maxStreak >= 7) {
        riskScore += 30;
        factors.push(`Long consecutive streak: ${maxStreak} days without rest`);
      }

      // Weekend work - scale by period
      const expectedWeekends = Math.floor(periodDays / 7) * 2;
      if (weekendDays >= Math.floor(expectedWeekends * 0.75)) {
        riskScore += 20;
        factors.push(`Excessive weekend work: ${weekendDays} weekend days`);
      } else if (weekendDays >= Math.floor(expectedWeekends * 0.6)) {
        riskScore += 10;
        factors.push(`High weekend work: ${weekendDays} weekend days`);
      }

      // Screener duty - scale by period
      const screenerExpected = Math.floor(periodDays / 4); // ~1 per week
      if (screenerDays >= screenerExpected * 2) {
        riskScore += 15;
        factors.push(`Heavy screener duty: ${screenerDays} screener days`);
      }

      // Determine risk level
      let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
      if (riskScore >= 70) riskLevel = 'CRITICAL';
      else if (riskScore >= 50) riskLevel = 'HIGH';
      else if (riskScore >= 30) riskLevel = 'MEDIUM';

      // Recommendations
      const recommendations: string[] = [];
      if (totalWorkDays > workloadThreshold) {
        recommendations.push('Consider reducing workload for next period');
      }
      if (maxStreak >= 7) {
        recommendations.push('Add rest days between work periods');
      }
      if (weekendDays >= Math.floor(expectedWeekends * 0.75)) {
        recommendations.push('Reduce weekend assignments');
      }
      if (screenerDays >= screenerExpected * 2) {
        recommendations.push('Rotate screener duties more evenly');
      }
      if (recommendations.length === 0) {
        recommendations.push('Workload is balanced - maintain current schedule');
      }

      assessments.push({
        analystId: analyst.id,
        analystName: analyst.name,
        riskLevel,
        riskScore,
        factors,
        recommendations,
        lastAssessment: new Date(),
      });
    }

    return assessments;
  };



  // Helper to toggle filter
  const toggleFilter = (filter: 'WORKLOAD' | 'SCREENER' | 'WEEKEND') => {
    if (activeFilter !== filter) {
      setActiveFilter(filter);
      // Scroll to deep dive section
      if (deepDiveRef.current) {
        deepDiveRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  // Helper: Get dynamic ring color based on score (Apple Fitness style)
  // UPDATED: Dynamic ring color based on score
  // 0-50: Red, 50-85: Blue, 85+: Green
  const getDynamicColor = (score: number): string => {
    if (score < 0.5) return 'from-red-500 to-red-600';
    if (score < 0.85) return 'from-blue-500 to-blue-600';
    return 'from-green-500 to-green-600';
  };

  // Sort tally data based on active filter
  const sortedTallyData = useMemo(() => {
    return [...tallyData].sort((a, b) => {
      switch (activeFilter) {
        case 'SCREENER': return b.screenerDays - a.screenerDays;
        case 'WEEKEND': return b.weekendDays - a.weekendDays;
        case 'WORKLOAD': return b.totalWorkDays - a.totalWorkDays;
        default: return b.totalWorkDays - a.totalWorkDays; // Default sort by workload
      }
    });
  }, [tallyData, activeFilter]);

  // Process Data for Components
  // UPDATED: Calculate metrics from schedules to respect Period
  const metrics = useMemo(() => {
    if (schedules.length === 0 && tallyData.length === 0) return null;

    // Use schedules if available (respects period), otherwise fallback to tallyData
    // But tallyData is only for current month.
    // Let's calculate from schedules for consistency with Period.

    const analystWorkloads: Record<string, number> = {};
    const analystScreeners: Record<string, number> = {};
    const analystWeekends: Record<string, number> = {};

    // Initialize with active analysts
    analysts.forEach(a => {
      analystWorkloads[a.id] = 0;
      analystScreeners[a.id] = 0;
      analystWeekends[a.id] = 0;
    });

    schedules.forEach(s => {
      if (analystWorkloads[s.analystId] !== undefined) {
        analystWorkloads[s.analystId]++;
        if (s.isScreener) analystScreeners[s.analystId]++;
        const day = new Date(s.date).getDay();
        if (day === 0 || day === 6) analystWeekends[s.analystId]++;
      }
    });

    const workloads = Object.values(analystWorkloads);
    const screeners = Object.values(analystScreeners);
    const weekends = Object.values(analystWeekends);
    const activeCount = workloads.length || 1;

    // 1. Workload Fairness
    const avgWorkload = workloads.reduce((a, b) => a + b, 0) / activeCount;
    const workloadVariance = workloads.reduce((sum, w) => sum + Math.pow(w - avgWorkload, 2), 0) / activeCount;
    const workloadFairness = avgWorkload > 0 ? Math.max(0, 1 - (Math.sqrt(workloadVariance) / avgWorkload)) : 1;

    // 2. Screener Fairness
    const avgScreener = screeners.reduce((a, b) => a + b, 0) / activeCount;
    const screenerVariance = screeners.reduce((sum, s) => sum + Math.pow(s - avgScreener, 2), 0) / activeCount;
    const screenerFairness = avgScreener > 0 ? Math.max(0, 1 - (Math.sqrt(screenerVariance) / avgScreener)) : 1;

    // 3. Weekend Fairness
    const avgWeekend = weekends.reduce((a, b) => a + b, 0) / activeCount;
    const weekendVariance = weekends.reduce((sum, w) => sum + Math.pow(w - avgWeekend, 2), 0) / activeCount;
    const weekendFairness = avgWeekend > 0 ? Math.max(0, 1 - (Math.sqrt(weekendVariance) / avgWeekend)) : 1;

    return {
      workloadFairness,
      screenerFairness,
      weekendFairness,
      avgWorkload,
      totalShifts: workloads.reduce((a, b) => a + b, 0),
      activeAnalysts: activeCount
    };
  }, [schedules, analysts, tallyData]);

  // Process Heatmap Data
  // Period-aware heatmap data generation
  const getHeatmapData = (analystId: string) => {
    const now = moment().add(dateOffset, period === 'WEEKLY' ? 'weeks' : period === 'MONTHLY' ? 'months' : period === 'QUARTERLY' ? 'quarters' : 'years');
    let startDate, endDate;
    let aggregationType: 'daily' | 'weekly' | 'monthly' = 'daily';

    // Calculate date range and aggregation type based on period
    if (period === 'WEEKLY') {
      startDate = now.clone().startOf('week');
      endDate = now.clone().endOf('week');
      aggregationType = 'daily';
    } else if (period === 'MONTHLY') {
      startDate = now.clone().startOf('month');
      endDate = now.clone().endOf('month');
      aggregationType = 'daily';
    } else if (period === 'QUARTERLY') {
      startDate = now.clone().startOf('quarter');
      endDate = now.clone().endOf('quarter');
      aggregationType = 'weekly';
    } else { // YEARLY
      startDate = now.clone().startOf('year');
      endDate = now.clone().endOf('year');
      aggregationType = 'monthly'; // Use monthly for yearly view
    }

    if (aggregationType === 'monthly') {
      // Aggregate by months (for yearly view)
      const data = [];
      const current = startDate.clone().startOf('month');

      while (current <= endDate) {
        const monthEnd = current.clone().endOf('month');
        const monthSchedules = schedules.filter(s => {
          if (s.analystId !== analystId) return false;
          const sDate = moment(s.date);
          return sDate >= current && sDate <= monthEnd;
        });

        let totalDays = 0;
        let weekendDays = 0;
        let screenerDays = 0;
        let hasWeekend = false;
        let hasScreener = false;

        monthSchedules.forEach(shift => {
          const d = moment(shift.date);
          const dayOfWeek = d.day();
          const isWknd = dayOfWeek === 0 || dayOfWeek === 6;

          // Apply active filter
          let passesFilter = true;
          if (activeFilter === 'SCREENER' && !shift.isScreener) passesFilter = false;
          if (activeFilter === 'WEEKEND' && !isWknd) passesFilter = false;

          if (passesFilter) {
            totalDays++;
            if (isWknd) {
              weekendDays++;
              hasWeekend = true;
            }
            if (shift.isScreener && !isWknd) { // Only count screener if NOT weekend
              screenerDays++;
              hasScreener = true;
            }
          }
        });

        data.push({
          date: current.format('MMM'),
          monthStart: current.format('YYYY-MM-DD'),
          totalDays,
          weekendDays,
          screenerDays,
          hasWeekend,
          hasScreener,
          isMonthly: true // Flag for monthly aggregation
        });

        current.add(1, 'month');
      }

      return data;
    } else if (aggregationType === 'weekly') {
      // Aggregate by weeks (for quarterly view)
      const data = [];
      const current = startDate.clone().startOf('week');

      while (current <= endDate) {
        const weekEnd = current.clone().endOf('week');
        const weekSchedules = schedules.filter(s => {
          if (s.analystId !== analystId) return false;
          const sDate = moment(s.date);
          return sDate >= current && sDate <= weekEnd;
        });

        let totalDays = 0;
        let weekendDays = 0;
        let screenerDays = 0;
        let hasWeekend = false;
        let hasScreener = false;

        weekSchedules.forEach(shift => {
          const d = moment(shift.date);
          const dayOfWeek = d.day();
          const isWknd = dayOfWeek === 0 || dayOfWeek === 6;

          // Apply active filter
          let passesFilter = true;
          if (activeFilter === 'SCREENER' && !shift.isScreener) passesFilter = false;
          if (activeFilter === 'WEEKEND' && !isWknd) passesFilter = false;

          if (passesFilter) {
            totalDays++;
            if (isWknd) {
              weekendDays++;
              hasWeekend = true;
            }
            if (shift.isScreener && !isWknd) { // Only count screener if NOT weekend
              screenerDays++;
              hasScreener = true;
            }
          }
        });

        data.push({
          date: current.format('MMM D'),
          weekStart: current.format('YYYY-MM-DD'),
          totalDays,
          weekendDays,
          screenerDays,
          hasWeekend,
          hasScreener,
          isWeekly: true // Flag for weekly aggregation
        });

        current.add(1, 'week');
      }

      return data;
    } else if (aggregationType === 'daily') {
      // Daily data for weekly/monthly
      const data = [];
      const current = startDate.clone();

      while (current <= endDate) {
        const dateStr = current.format('YYYY-MM-DD');
        const shift = schedules.find(s => s.analystId === analystId && s.date.startsWith(dateStr));

        let hasShift = false;
        let isScreener = false;
        let isWeekend = false;

        if (shift) {
          const dayOfWeek = current.day();
          const isWknd = dayOfWeek === 0 || dayOfWeek === 6;

          let passesFilter = true;
          if (activeFilter === 'SCREENER' && !shift.isScreener) passesFilter = false;
          if (activeFilter === 'WEEKEND' && !isWknd) passesFilter = false;

          if (passesFilter) {
            hasShift = true;
            isScreener = shift.isScreener && !isWknd; // Only mark as screener if NOT weekend
            isWeekend = isWknd;
          }
        }

        data.push({
          date: current.format('MMM D'),
          hasShift,
          isScreener,
          isWeekend,
          isWeekly: false
        });

        current.add(1, 'day');
      }

      return data;
    }

    // Fallback (should never reach here)
    return [];
  };

  // Process Radar Data
  const getRadarData = (analyst: MonthlyTally) => {
    if (!metrics) return [];
    const avgScreener = tallyData.reduce((sum, t) => sum + t.screenerDays, 0) / tallyData.length;
    const avgWeekend = tallyData.reduce((sum, t) => sum + t.weekendDays, 0) / tallyData.length;
    const avgRegular = tallyData.reduce((sum, t) => sum + t.regularShiftDays, 0) / tallyData.length;

    // Normalize to 100 scale relative to max in group or reasonable cap
    const normalize = (val: number, avg: number) => {
      const max = Math.max(val, avg) * 1.5 || 1;
      return (val / max) * 100;
    };

    return [
      { subject: 'Regular', A: normalize(analyst.regularShiftDays, avgRegular), B: normalize(avgRegular, avgRegular), fullMark: 100 },
      { subject: 'Screener', A: normalize(analyst.screenerDays, avgScreener), B: normalize(avgScreener, avgScreener), fullMark: 100 },
      { subject: 'Weekend', A: normalize(analyst.weekendDays, avgWeekend), B: normalize(avgWeekend, avgWeekend), fullMark: 100 },
    ];
  };

  // Prepare Comparison Data based on active filter
  const comparisonData = useMemo(() => {
    return sortedTallyData.map(t => {
      let value = t.totalWorkDays;
      let metricLabel = 'Total Days';

      if (activeFilter === 'SCREENER') {
        value = t.screenerDays;
        metricLabel = 'Screener Days';
      } else if (activeFilter === 'WEEKEND') {
        value = t.weekendDays;
        metricLabel = 'Weekend Days';
      }

      // Calculate percentile for the specific metric
      const allValues = sortedTallyData.map(x =>
        activeFilter === 'SCREENER' ? x.screenerDays :
          activeFilter === 'WEEKEND' ? x.weekendDays :
            x.totalWorkDays
      );
      const sortedValues = [...allValues].sort((a, b) => b - a);
      const rank = sortedValues.indexOf(value);
      const percentile = ((sortedValues.length - rank) / sortedValues.length) * 100;

      return {
        name: t.analystName,
        value: value,
        fairnessScore: t.fairnessScore,
        percentile,
        metricLabel // Pass this if AnalystComparison supports it, or use it in title
      };
    });
  }, [sortedTallyData, activeFilter]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 relative z-10">
      <div className="max-w-7xl mx-auto space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Header Section with Navigation - Moved to AppHeader */}
          <div className="flex justify-end items-center mb-6">
          </div>
          {/* Hero: Fairness Rings */}
          <section
            className="grid grid-cols-1 md:grid-cols-3 gap-8 relative"
            onClick={(e) => {
              // Reset filter when clicking empty area (not on a ring)
              if (e.target === e.currentTarget && activeFilter !== 'WORKLOAD') {
                setActiveFilter('WORKLOAD');
              }
            }}
          >
            <ActivityRing
              value={metrics?.workloadFairness || 0}
              color={getDynamicColor(metrics?.workloadFairness || 0)}
              label="Workload Balance"
              subtitle="Team fairness score"
              onClick={() => toggleFilter('WORKLOAD')}
              isActive={activeFilter === 'WORKLOAD'}
              isFaded={activeFilter !== 'WORKLOAD'}
              infoTooltip="100% = Perfectly balanced workload compared to team average"
            />
            <ActivityRing
              value={metrics?.screenerFairness || 0}
              color={getDynamicColor(metrics?.screenerFairness || 0)}
              label="Screener Balance"
              subtitle="Duty distribution"
              onClick={() => toggleFilter('SCREENER')}
              isActive={activeFilter === 'SCREENER'}
              isFaded={activeFilter !== 'SCREENER'}
              infoTooltip="100% = Equal distribution of screener duties"
            />
            <ActivityRing
              value={metrics?.weekendFairness || 0}
              color={getDynamicColor(metrics?.weekendFairness || 0)}
              label="Weekend Balance"
              subtitle="Weekend equity"
              onClick={() => toggleFilter('WEEKEND')}
              isActive={activeFilter === 'WEEKEND'}
              isFaded={activeFilter !== 'WEEKEND'}
              infoTooltip="100% = Fair rotation of weekend shifts"
            />
          </section>

          {/* Key Metrics */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Overall Fairness"
              value={`${((metrics?.workloadFairness || 0) * 100).toFixed(0)}% `}
              trend={{ direction: 'up', value: '+2.5%' }}
              icon={<ChartBar className="h-6 w-6" />}
              color="blue"
              backContent={
                <div className="space-y-3">
                  <div className="flex justify-between items-center border-b border-white/10 pb-2">
                    <span className="text-sm opacity-80">Workload</span>
                    <span className="font-bold">{((metrics?.workloadFairness || 0) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/10 pb-2">
                    <span className="text-sm opacity-80">Screener</span>
                    <span className="font-bold">{((metrics?.screenerFairness || 0) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm opacity-80">Weekend</span>
                    <span className="font-bold">{((metrics?.weekendFairness || 0) * 100).toFixed(0)}%</span>
                  </div>
                </div>
              }
            />
            <MetricCard
              label="Active Analysts"
              value={tallyData.length.toString()}
              icon={<Users className="h-6 w-6" />}
              color="purple"
              backContent={
                <div className="space-y-2 text-center pt-4">
                  <div className="text-4xl font-bold">{tallyData.length}</div>
                  <div className="text-sm opacity-80">Active Analysts</div>
                  <div className="text-xs opacity-60 mt-2">Total Tracked: {tallyData.length}</div>
                </div>
              }
            />
            <MetricCard
              label={`Shifts This ${period === 'WEEKLY' ? 'Week' : period === 'MONTHLY' ? 'Month' : period === 'QUARTERLY' ? 'Quarter' : 'Year'} `}
              value={schedules.length.toString()}
              icon={<Calendar className="h-6 w-6" />}
              color="green"
              backContent={
                <div className="space-y-3">
                  <div className="flex justify-between items-center border-b border-white/10 pb-2">
                    <span className="text-sm opacity-80">Regular</span>
                    <span className="font-bold">{schedules.filter(s => !s.isScreener && new Date(s.date).getDay() !== 0 && new Date(s.date).getDay() !== 6).length}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/10 pb-2">
                    <span className="text-sm opacity-80">Screener</span>
                    <span className="font-bold">{schedules.filter(s => s.isScreener).length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm opacity-80">Weekend</span>
                    <span className="font-bold">{schedules.filter(s => new Date(s.date).getDay() === 0 || new Date(s.date).getDay() === 6).length}</span>
                  </div>
                </div>
              }
            />
            <MetricCard
              label="Burnout Risks"
              value={burnoutRisks.filter(r => r.riskLevel === 'HIGH' || r.riskLevel === 'CRITICAL').length.toString()}
              trend={burnoutRisks.filter(r => r.riskLevel === 'HIGH' || r.riskLevel === 'CRITICAL').length > 0 ? { direction: 'down', value: 'Risks Detected' } : undefined}
              icon={<Siren className="h-6 w-6" />}
              color="red"
              backContent={
                <div className="text-center py-8">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Click card for detailed breakdown
                  </p>
                  <button
                    onClick={() => setIsBurnoutModalOpen(true)}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
                  >
                    View Details
                  </button>
                </div>
              }
            />
          </section>

          {/* Drill Down Tabs (Moved Above Trends) */}
          <section ref={deepDiveRef}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Drill Down
                {activeFilter !== 'WORKLOAD' && (
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    (Filtered by {activeFilter.charAt(0) + activeFilter.slice(1).toLowerCase()})
                  </span>
                )}
              </h2>
              <button
                onClick={() => setActiveFilter('WORKLOAD')}
                disabled={activeFilter === 'WORKLOAD'}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 ${activeFilter === 'WORKLOAD'
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600 active:scale-95'
                  }`}
              >
                <ArrowCounterClockwise className="h-5 w-5" />
                RESET
              </button>
            </div>

            <AnalyticsTabs
              tabs={[
                {
                  id: 'workload',
                  label: 'Workload (Quantity)',
                  content: (
                    <AnalystComparison
                      analysts={comparisonData}
                      metric="workload"
                      title={`${period === 'WEEKLY' ? 'Weekly' : period === 'MONTHLY' ? 'Monthly' : period === 'QUARTERLY' ? 'Quarterly' : 'Yearly'} Workload Distribution`}
                      showPercentiles
                    />
                  )
                },
                {
                  id: 'intensity',
                  label: 'Intensity (Burnout)',
                  content: (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {sortedTallyData.map(analyst => (
                        <div key={analyst.analystId}>
                          <h4 className="font-medium text-gray-900 dark:text-white text-sm">{analyst.analystName}</h4>
                          <AnalystHeatmap data={getHeatmapData(analyst.analystId)} />
                        </div>
                      ))}
                    </div>
                  )
                },
                {
                  id: 'distribution',
                  label: 'Distribution (Equity)',
                  content: (
                    <TeamRadar data={sortedTallyData} />
                  )
                },
              ]}
            />
          </section>

          {/* Trend Analysis (Split) */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <WorkloadTrendChart
              schedules={schedules}
              analysts={analysts}
              period={period}
              dateOffset={dateOffset}
            />
            <TrendChart
              data={trendsData}
              title="Fairness distribution by Workload"
              subtitle={`Weighted Workload vs Fairness Score (${period})`}
            />
          </section>
        </motion.div>

        {/* Burn out Modal */}
        <BurnoutModal
          isOpen={isBurnoutModalOpen}
          onClose={() => setIsBurnoutModalOpen(false)}
          risks={burnoutRisks}
        />
      </div>
    </div>
  );
};

export default Analytics;
