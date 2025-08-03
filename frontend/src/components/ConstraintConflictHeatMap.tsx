import React, { useState, useEffect, useMemo } from 'react';
import moment from 'moment-timezone';
import apiService, { Schedule, SchedulingConstraint } from '../services/api';

interface ConflictData {
  date: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  conflicts: Array<{
    type: 'CONSTRAINT_VIOLATION' | 'COVERAGE_GAP' | 'OVERLAP' | 'FAIRNESS_ISSUE';
    message: string;
    analystId?: string;
    constraintId?: string;
  }>;
  probability: number;
}

interface ConstraintConflictHeatMapProps {
  startDate: Date;
  endDate: Date;
  constraints: SchedulingConstraint[];
  schedules: Schedule[];
  onDateClick?: (date: Date, conflicts: ConflictData) => void;
  className?: string;
}

const ConstraintConflictHeatMap: React.FC<ConstraintConflictHeatMapProps> = ({
  startDate,
  endDate,
  constraints,
  schedules,
  onDateClick,
  className = ''
}) => {
  const [conflictData, setConflictData] = useState<Map<string, ConflictData>>(new Map());
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Generate calendar grid
  const calendarDays = useMemo(() => {
    const days: Date[] = [];
    const current = moment(startDate).startOf('day');
    const end = moment(endDate).startOf('day');

    while (current <= end) {
      days.push(current.toDate());
      current.add(1, 'day');
    }

    return days;
  }, [startDate, endDate]);

  // Analyze conflicts for the date range
  useEffect(() => {
    analyzeConflicts();
  }, [constraints, schedules, startDate, endDate]);

  const analyzeConflicts = async () => {
    setLoading(true);
    
    try {
      const conflictMap = new Map<string, ConflictData>();

      // Analyze each day in the range
      for (const day of calendarDays) {
        const dateStr = day.toISOString().split('T')[0];
        const daySchedules = schedules.filter(s => s.date.startsWith(dateStr));
        const applicableConstraints = constraints.filter(c => 
          c.isActive && 
          moment(c.startDate) <= moment(day) && 
          moment(c.endDate) >= moment(day)
        );

        const conflicts = await analyzeDayConflicts(day, daySchedules, applicableConstraints);
        
        if (conflicts.length > 0) {
          const severity = calculateSeverity(conflicts);
          const probability = calculateConflictProbability(conflicts, daySchedules);
          
          conflictMap.set(dateStr, {
            date: dateStr,
            severity,
            conflicts,
            probability
          });
        }
      }

      setConflictData(conflictMap);
    } catch (error) {
      console.error('Error analyzing conflicts:', error);
    } finally {
      setLoading(false);
    }
  };

  const analyzeDayConflicts = async (
    date: Date, 
    daySchedules: Schedule[], 
    applicableConstraints: SchedulingConstraint[]
  ) => {
    const conflicts: ConflictData['conflicts'] = [];

    // Check constraint violations
    for (const constraint of applicableConstraints) {
      const violations = checkConstraintViolations(constraint, daySchedules, date);
      conflicts.push(...violations);
    }

    // Check coverage gaps
    const coverageGaps = checkCoverageGaps(daySchedules, date);
    conflicts.push(...coverageGaps);

    // Check overlaps
    const overlaps = checkScheduleOverlaps(daySchedules);
    conflicts.push(...overlaps);

    // Check fairness issues (simplified)
    const fairnessIssues = checkFairnessIssues(daySchedules, date);
    conflicts.push(...fairnessIssues);

    return conflicts;
  };

  const checkConstraintViolations = (
    constraint: SchedulingConstraint,
    daySchedules: Schedule[],
    date: Date
  ): ConflictData['conflicts'] => {
    const violations: ConflictData['conflicts'] = [];

    switch (constraint.constraintType) {
      case 'BLACKOUT_DATE':
        const blackoutViolations = daySchedules.filter(s => 
          !constraint.analystId || s.analystId === constraint.analystId
        );
        violations.push(...blackoutViolations.map(s => ({
          type: 'CONSTRAINT_VIOLATION' as const,
          message: `Blackout date violation: ${s.analyst?.name} scheduled during blackout`,
          analystId: s.analystId,
          constraintId: constraint.id
        })));
        break;

      case 'UNAVAILABLE_SCREENER':
        const screenerViolations = daySchedules.filter(s => 
          s.isScreener && (!constraint.analystId || s.analystId === constraint.analystId)
        );
        violations.push(...screenerViolations.map(s => ({
          type: 'CONSTRAINT_VIOLATION' as const,
          message: `Screener unavailability violation: ${s.analyst?.name} assigned as screener when unavailable`,
          analystId: s.analystId,
          constraintId: constraint.id
        })));
        break;

      case 'MAX_SCREENER_DAYS':
        // For this, we'd need to check across multiple days
        // Simplified check for demonstration
        const maxScreenerDays = parseInt(constraint.description || '2');
        const screenerCount = daySchedules.filter(s => 
          s.isScreener && (!constraint.analystId || s.analystId === constraint.analystId)
        ).length;
        
        if (screenerCount > maxScreenerDays) {
          violations.push({
            type: 'CONSTRAINT_VIOLATION',
            message: `Max screener days exceeded: ${screenerCount} > ${maxScreenerDays}`,
            constraintId: constraint.id
          });
        }
        break;
    }

    return violations;
  };

  const checkCoverageGaps = (daySchedules: Schedule[], date: Date): ConflictData['conflicts'] => {
    const violations: ConflictData['conflicts'] = [];
    
    // Check if it's a weekday (Mon-Fri)
    const dayOfWeek = moment(date).day();
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

    if (isWeekday) {
      const morningShift = daySchedules.find(s => s.shiftType === 'MORNING');
      const eveningShift = daySchedules.find(s => s.shiftType === 'EVENING');
      const morningScreener = daySchedules.find(s => s.shiftType === 'MORNING' && s.isScreener);
      const eveningScreener = daySchedules.find(s => s.shiftType === 'EVENING' && s.isScreener);

      if (!morningShift) {
        violations.push({
          type: 'COVERAGE_GAP',
          message: 'Missing morning shift coverage'
        });
      }

      if (!eveningShift) {
        violations.push({
          type: 'COVERAGE_GAP',
          message: 'Missing evening shift coverage'
        });
      }

      if (!morningScreener) {
        violations.push({
          type: 'COVERAGE_GAP',
          message: 'Missing morning screener assignment'
        });
      }

      if (!eveningScreener) {
        violations.push({
          type: 'COVERAGE_GAP',
          message: 'Missing evening screener assignment'
        });
      }
    }

    return violations;
  };

  const checkScheduleOverlaps = (daySchedules: Schedule[]): ConflictData['conflicts'] => {
    const violations: ConflictData['conflicts'] = [];
    const analystSchedules = new Map<string, Schedule[]>();

    // Group schedules by analyst
    daySchedules.forEach(schedule => {
      if (!analystSchedules.has(schedule.analystId)) {
        analystSchedules.set(schedule.analystId, []);
      }
      analystSchedules.get(schedule.analystId)!.push(schedule);
    });

    // Check for multiple assignments per analyst per day
    analystSchedules.forEach((schedules, analystId) => {
      if (schedules.length > 1) {
        violations.push({
          type: 'OVERLAP',
          message: `Multiple schedule assignments for ${schedules[0].analyst?.name}`,
          analystId
        });
      }
    });

    return violations;
  };

  const checkFairnessIssues = (daySchedules: Schedule[], date: Date): ConflictData['conflicts'] => {
    const violations: ConflictData['conflicts'] = [];
    
    // Simple fairness check: same analyst shouldn't be screener every day
    // This would need more sophisticated logic in a real implementation
    const screeners = daySchedules.filter(s => s.isScreener);
    
    if (screeners.length > 2) {
      violations.push({
        type: 'FAIRNESS_ISSUE',
        message: `Too many screener assignments (${screeners.length}) may affect fairness`
      });
    }

    return violations;
  };

  const calculateSeverity = (conflicts: ConflictData['conflicts']): 'LOW' | 'MEDIUM' | 'HIGH' => {
    const hasConstraintViolations = conflicts.some(c => c.type === 'CONSTRAINT_VIOLATION');
    const hasCoverageGaps = conflicts.some(c => c.type === 'COVERAGE_GAP');
    const hasOverlaps = conflicts.some(c => c.type === 'OVERLAP');

    if (hasConstraintViolations || hasCoverageGaps) {
      return 'HIGH';
    } else if (hasOverlaps) {
      return 'MEDIUM';
    } else {
      return 'LOW';
    }
  };

  const calculateConflictProbability = (
    conflicts: ConflictData['conflicts'],
    daySchedules: Schedule[]
  ): number => {
    let probability = 0;

    // Base probability on conflict types
    conflicts.forEach(conflict => {
      switch (conflict.type) {
        case 'CONSTRAINT_VIOLATION':
          probability += 0.3;
          break;
        case 'COVERAGE_GAP':
          probability += 0.25;
          break;
        case 'OVERLAP':
          probability += 0.2;
          break;
        case 'FAIRNESS_ISSUE':
          probability += 0.1;
          break;
      }
    });

    // Factor in schedule density
    const scheduleDensity = daySchedules.length / 4; // Assuming max 4 schedules per day
    probability += scheduleDensity * 0.1;

    return Math.min(probability, 1.0);
  };

  const getHeatMapColor = (severity: 'LOW' | 'MEDIUM' | 'HIGH', probability: number) => {
    const intensity = Math.min(probability * 2, 1); // Scale intensity
    
    switch (severity) {
      case 'HIGH':
        return `rgba(239, 68, 68, ${intensity})`; // Red
      case 'MEDIUM':
        return `rgba(245, 158, 11, ${intensity})`; // Yellow
      case 'LOW':
        return `rgba(59, 130, 246, ${intensity})`; // Blue
      default:
        return 'transparent';
    }
  };

  const handleDateClick = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const conflicts = conflictData.get(dateStr);
    
    setSelectedDate(dateStr);
    
    if (conflicts && onDateClick) {
      onDateClick(date, conflicts);
    }
  };

  const renderCalendarGrid = () => {
    const weeks: Date[][] = [];
    let currentWeek: Date[] = [];

    calendarDays.forEach((day, index) => {
      const dayOfWeek = moment(day).day();
      
      // Start new week on Sunday
      if (dayOfWeek === 0 && currentWeek.length > 0) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      
      currentWeek.push(day);
      
      // Push last week
      if (index === calendarDays.length - 1) {
        weeks.push(currentWeek);
      }
    });

    return (
      <div className="space-y-1">
        {/* Header */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-xs font-medium text-muted-foreground p-2">
              {day}
            </div>
          ))}
        </div>
        
        {/* Calendar Body */}
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 gap-1">
            {week.map((day, dayIndex) => {
              const dateStr = day.toISOString().split('T')[0];
              const conflicts = conflictData.get(dateStr);
              const isSelected = selectedDate === dateStr;
              
              return (
                <div
                  key={dayIndex}
                  className={`
                    relative h-12 border border-border rounded cursor-pointer
                    hover:border-primary transition-colors
                    ${isSelected ? 'ring-2 ring-primary' : ''}
                  `}
                  style={{
                    backgroundColor: conflicts ? getHeatMapColor(conflicts.severity, conflicts.probability) : 'transparent'
                  }}
                  onClick={() => handleDateClick(day)}
                >
                  <div className="absolute top-1 left-1 text-xs font-medium">
                    {moment(day).date()}
                  </div>
                  
                  {conflicts && (
                    <div className="absolute bottom-1 right-1">
                      <div className={`w-2 h-2 rounded-full ${
                        conflicts.severity === 'HIGH' ? 'bg-red-600' :
                        conflicts.severity === 'MEDIUM' ? 'bg-yellow-600' :
                        'bg-blue-600'
                      }`} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  const renderLegend = () => (
    <div className="flex items-center justify-between text-xs text-muted-foreground mt-4">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 bg-red-400 rounded"></div>
          <span>High Risk</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 bg-yellow-400 rounded"></div>
          <span>Medium Risk</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 bg-blue-400 rounded"></div>
          <span>Low Risk</span>
        </div>
      </div>
      
      {loading && (
        <div className="flex items-center space-x-2">
          <div className="animate-spin w-3 h-3 border border-primary border-t-transparent rounded-full"></div>
          <span>Analyzing conflicts...</span>
        </div>
      )}
    </div>
  );

  const renderConflictDetails = () => {
    if (!selectedDate) return null;
    
    const conflicts = conflictData.get(selectedDate);
    if (!conflicts) return null;

    return (
      <div className="mt-4 p-4 bg-card rounded-lg border">
        <h4 className="font-semibold text-foreground mb-3">
          Conflicts for {moment(selectedDate).format('MMM D, YYYY')}
        </h4>
        
        <div className="space-y-2">
          {conflicts.conflicts.map((conflict, index) => (
            <div
              key={index}
              className={`p-2 rounded border-l-4 text-sm ${
                conflict.type === 'CONSTRAINT_VIOLATION' ? 'border-red-500 bg-red-50' :
                conflict.type === 'COVERAGE_GAP' ? 'border-orange-500 bg-orange-50' :
                conflict.type === 'OVERLAP' ? 'border-yellow-500 bg-yellow-50' :
                'border-blue-500 bg-blue-50'
              }`}
            >
              <div className="font-medium">{conflict.type.replace('_', ' ')}</div>
              <div className="text-muted-foreground">{conflict.message}</div>
            </div>
          ))}
        </div>
        
        <div className="mt-3 text-xs text-muted-foreground">
          Conflict Probability: {Math.round(conflicts.probability * 100)}%
        </div>
      </div>
    );
  };

  return (
    <div className={`constraint-conflict-heatmap ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-foreground mb-2">Constraint Conflict Heat Map</h3>
        <p className="text-sm text-muted-foreground">
          Visual indicators show potential constraint conflicts and coverage gaps
        </p>
      </div>
      
      {renderCalendarGrid()}
      {renderLegend()}
      {renderConflictDetails()}
    </div>
  );
};

export default ConstraintConflictHeatMap;