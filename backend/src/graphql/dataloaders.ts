import DataLoader from 'dataloader';
import { prisma } from '../lib/prisma';

// Analyst DataLoader
export const createAnalystLoader = () => {
  return new DataLoader(async (ids: readonly string[]) => {
    const analysts = await prisma.analyst.findMany({
      where: { id: { in: [...ids] } },
      include: {
        preferences: true,
        schedules: true,
        vacations: true,
        constraints: true,
      }
    });
    
    // Return analysts in the same order as the requested IDs
    return ids.map(id => analysts.find(analyst => analyst.id === id));
  });
};

// Schedule DataLoader
export const createScheduleLoader = () => {
  return new DataLoader(async (ids: readonly string[]) => {
    const schedules = await prisma.schedule.findMany({
      where: { id: { in: [...ids] } },
      include: { analyst: true }
    });
    
    return ids.map(id => schedules.find(schedule => schedule.id === id));
  });
};

// Vacation DataLoader
export const createVacationLoader = () => {
  return new DataLoader(async (ids: readonly string[]) => {
    const vacations = await prisma.vacation.findMany({
      where: { id: { in: [...ids] } },
      include: { analyst: true }
    });
    
    return ids.map(id => vacations.find(vacation => vacation.id === id));
  });
};

// Constraint DataLoader
export const createConstraintLoader = () => {
  return new DataLoader(async (ids: readonly string[]) => {
    const constraints = await prisma.schedulingConstraint.findMany({
      where: { id: { in: [...ids] } },
      include: { analyst: true }
    });
    
    return ids.map(id => constraints.find(constraint => constraint.id === id));
  });
};

// Schedules by Analyst DataLoader
export const createSchedulesByAnalystLoader = () => {
  return new DataLoader(async (analystIds: readonly string[]) => {
    const schedules = await prisma.schedule.findMany({
      where: { analystId: { in: [...analystIds] } },
      include: { analyst: true },
      orderBy: { date: 'asc' }
    });
    
    // Group schedules by analyst ID
    const schedulesByAnalyst = analystIds.map(analystId => 
      schedules.filter(schedule => schedule.analystId === analystId)
    );
    
    return schedulesByAnalyst;
  });
};

// Vacations by Analyst DataLoader
export const createVacationsByAnalystLoader = () => {
  return new DataLoader(async (analystIds: readonly string[]) => {
    const vacations = await prisma.vacation.findMany({
      where: { analystId: { in: [...analystIds] } },
      include: { analyst: true },
      orderBy: { startDate: 'asc' }
    });
    
    // Group vacations by analyst ID
    const vacationsByAnalyst = analystIds.map(analystId => 
      vacations.filter(vacation => vacation.analystId === analystId)
    );
    
    return vacationsByAnalyst;
  });
};

// Constraints by Analyst DataLoader
export const createConstraintsByAnalystLoader = () => {
  return new DataLoader(async (analystIds: readonly string[]) => {
    const constraints = await prisma.schedulingConstraint.findMany({
      where: { analystId: { in: [...analystIds] } },
      include: { analyst: true },
      orderBy: { startDate: 'asc' }
    });
    
    // Group constraints by analyst ID
    const constraintsByAnalyst = analystIds.map(analystId => 
      constraints.filter(constraint => constraint.analystId === analystId)
    );
    
    return constraintsByAnalyst;
  });
};

// Schedules by Date Range DataLoader
export const createSchedulesByDateRangeLoader = () => {
  return new DataLoader(async (dateRanges: readonly { start: Date; end: Date }[]) => {
    const schedules = await prisma.schedule.findMany({
      where: {
        OR: dateRanges.map(range => ({
          date: {
            gte: range.start,
            lte: range.end
          }
        }))
      },
      include: { analyst: true },
      orderBy: { date: 'asc' }
    });
    
    // Group schedules by date range
    const schedulesByRange = dateRanges.map(range => 
      schedules.filter(schedule => 
        schedule.date >= range.start && schedule.date <= range.end
      )
    );
    
    return schedulesByRange;
  });
};

// Batch operations for creating multiple schedules
export const createBatchOperations = () => {
  return new DataLoader(async (operations: readonly { type: 'create' | 'update' | 'delete'; data: any }[]) => {
    const results = [];
    
    for (const operation of operations) {
      try {
        switch (operation.type) {
          case 'create':
            const creation = {
              analystId: operation.data.analystId,
              date: new Date(operation.data.date),
              shiftType: operation.data.shiftType as any,
              isScreener: operation.data.isScreener
            };
            
            const created = await prisma.schedule.create({
              data: creation,
              include: { analyst: true }
            });
            results.push(created);
            break;
            
          case 'update':
            const updated = await prisma.schedule.update({
              where: { id: operation.data.id },
              data: {
                shiftType: operation.data.shiftType as any,
                isScreener: operation.data.isScreener
              },
              include: { analyst: true }
            });
            results.push(updated);
            break;
            
          case 'delete':
            const deleted = await prisma.schedule.delete({
              where: { id: operation.data.id },
              include: { analyst: true }
            });
            results.push(deleted);
            break;
        }
      } catch (error) {
        results.push(null);
      }
    }
    
    return results;
  });
}; 