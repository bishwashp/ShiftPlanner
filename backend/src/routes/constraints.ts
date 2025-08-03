import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { constraintImpactSimulator, ConstraintChange } from '../services/ConstraintImpactSimulator';
import { realTimeConstraintValidator } from '../services/RealTimeConstraintValidator';
import { whatIfScenarioEngine, ScenarioRequest } from '../services/WhatIfScenarioEngine';
import { earlyWarningSystem } from '../services/EarlyWarningSystem';
import { conflictProbabilityScorer } from '../services/ConflictProbabilityScorer';
import { eventConstraintManager } from '../services/EventConstraintManager';
import { constraintTemplateLibrary } from '../services/ConstraintTemplateLibrary';

const router = Router();

// Get all constraints
router.get('/', async (req: Request, res: Response) => {
    try {
        const { analystId } = req.query;
        const where: any = {};
        if (analystId) {
            where.analystId = analystId as string;
        }

        const constraints = await prisma.schedulingConstraint.findMany({
            where,
            orderBy: { startDate: 'asc' },
        });
        res.json(constraints);
    } catch (error) {
        console.error('Error fetching constraints:', error);
        res.status(500).json({ error: 'Failed to fetch constraints' });
    }
});

// Create new constraint
router.post('/', async (req: Request, res: Response) => {
    try {
        const { analystId, shiftType, startDate, endDate, constraintType, description, isActive } = req.body;

        if (!startDate || !endDate || !constraintType) {
            return res.status(400).json({ error: 'startDate, endDate, and constraintType are required' });
        }

        const constraint = await prisma.schedulingConstraint.create({
            data: {
                analystId,
                shiftType,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                constraintType,
                description,
                isActive,
            },
        });

        res.status(201).json(constraint);
    } catch (error) {
        console.error('Error creating constraint:', error);
        res.status(400).json({ error: 'Failed to create constraint' });
    }
});

// Update constraint
router.put('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { analystId, shiftType, startDate, endDate, constraintType, description, isActive } = req.body;

        const constraint = await prisma.schedulingConstraint.update({
            where: { id },
            data: {
                analystId,
                shiftType,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
                constraintType,
                description,
                isActive,
            },
        });

        res.json(constraint);
    } catch (error: any) {
        console.error('Error updating constraint:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Constraint not found' });
        }
        res.status(400).json({ error: 'Failed to update constraint' });
    }
});

// Delete constraint
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.schedulingConstraint.delete({ where: { id } });
        res.status(204).send();
    } catch (error: any) {
        console.error('Error deleting constraint:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Constraint not found' });
        }
        res.status(400).json({ error: 'Failed to delete constraint' });
    }
});

// Real-time constraint impact preview
router.post('/impact-preview', async (req: Request, res: Response) => {
    try {
        const { constraintChange } = req.body;
        
        if (!constraintChange || !constraintChange.type || !constraintChange.constraint) {
            return res.status(400).json({ error: 'constraintChange with type and constraint are required' });
        }

        const preview = await constraintImpactSimulator.getQuickImpactPreview(constraintChange);
        res.json(preview);
    } catch (error) {
        console.error('Error generating impact preview:', error);
        res.status(500).json({ error: 'Failed to generate impact preview' });
    }
});

// Full constraint impact simulation
router.post('/impact-simulation', async (req: Request, res: Response) => {
    try {
        const { constraintChange, dateRange, algorithmConfig, includeReschedule } = req.body;
        
        if (!constraintChange || !dateRange) {
            return res.status(400).json({ error: 'constraintChange and dateRange are required' });
        }

        const startDate = new Date(dateRange.startDate);
        const endDate = new Date(dateRange.endDate);

        const impact = await constraintImpactSimulator.simulateConstraintImpact({
            constraintChange,
            dateRange: { startDate, endDate },
            algorithmConfig,
            includeReschedule: includeReschedule || false
        });

        res.json(impact);
    } catch (error) {
        console.error('Error running impact simulation:', error);
        res.status(500).json({ error: 'Failed to run impact simulation' });
    }
});

// Real-time constraint validation (fast response for form validation)
router.post('/validate-realtime', async (req: Request, res: Response) => {
    try {
        const { constraint, operation = 'CREATE', originalConstraint } = req.body;
        
        if (!constraint) {
            return res.status(400).json({ error: 'constraint is required' });
        }

        const validation = await realTimeConstraintValidator.validateConstraint({
            constraint,
            operation,
            originalConstraint
        });

        res.json(validation);
    } catch (error) {
        console.error('Error in real-time validation:', error);
        res.status(500).json({ error: 'Failed to validate constraint' });
    }
});

// Validate constraint against existing schedules (comprehensive validation)
router.post('/validate', async (req: Request, res: Response) => {
    try {
        const { constraint, dateRange } = req.body;
        
        if (!constraint || !dateRange) {
            return res.status(400).json({ error: 'constraint and dateRange are required' });
        }

        const constraintChange: ConstraintChange = {
            type: 'CREATE',
            constraint
        };

        const startDate = new Date(dateRange.startDate);
        const endDate = new Date(dateRange.endDate);

        // Run quick validation
        const preview = await constraintImpactSimulator.getQuickImpactPreview(constraintChange);
        
        // Run full simulation for validation
        const impact = await constraintImpactSimulator.simulateConstraintImpact({
            constraintChange,
            dateRange: { startDate, endDate },
            includeReschedule: false
        });

        res.json({
            isValid: impact.scheduleChanges.conflicts.length === 0,
            preview,
            impact: {
                conflictCount: impact.scheduleChanges.conflicts.length,
                affectedDays: impact.affectedDates.length,
                affectedAnalysts: impact.affectedAnalysts.length,
                recommendations: impact.recommendations
            }
        });
    } catch (error) {
        console.error('Error validating constraint:', error);
        res.status(500).json({ error: 'Failed to validate constraint' });
    }
});

// What-if scenario modeling endpoints
router.post('/scenario/analyze', async (req: Request, res: Response) => {
    try {
        const scenarioRequest: ScenarioRequest = req.body;
        
        if (!scenarioRequest.name || !scenarioRequest.changes || !scenarioRequest.dateRange) {
            return res.status(400).json({ error: 'name, changes, and dateRange are required' });
        }

        const analysis = await whatIfScenarioEngine.analyzeScenario(scenarioRequest);
        res.json(analysis);
    } catch (error) {
        console.error('Error analyzing scenario:', error);
        res.status(500).json({ error: 'Failed to analyze scenario' });
    }
});

router.post('/scenario/compare', async (req: Request, res: Response) => {
    try {
        const { scenarios } = req.body;
        
        if (!scenarios || !Array.isArray(scenarios) || scenarios.length === 0) {
            return res.status(400).json({ error: 'scenarios array is required' });
        }

        const comparison = await whatIfScenarioEngine.compareScenarios(scenarios);
        res.json(comparison);
    } catch (error) {
        console.error('Error comparing scenarios:', error);
        res.status(500).json({ error: 'Failed to compare scenarios' });
    }
});

router.post('/scenario/incremental', async (req: Request, res: Response) => {
    try {
        const scenarioRequest: ScenarioRequest = req.body;
        
        if (!scenarioRequest.changes || !scenarioRequest.dateRange) {
            return res.status(400).json({ error: 'changes and dateRange are required' });
        }

        const analysis = await whatIfScenarioEngine.testIncrementalChanges(scenarioRequest);
        res.json(analysis);
    } catch (error) {
        console.error('Error testing incremental changes:', error);
        res.status(500).json({ error: 'Failed to test incremental changes' });
    }
});

router.post('/scenario/rollback', async (req: Request, res: Response) => {
    try {
        const { currentConstraints, changes } = req.body;
        
        if (!currentConstraints || !changes) {
            return res.status(400).json({ error: 'currentConstraints and changes are required' });
        }

        const rollbackAnalysis = await whatIfScenarioEngine.simulateRollback(currentConstraints, changes);
        res.json(rollbackAnalysis);
    } catch (error) {
        console.error('Error simulating rollback:', error);
        res.status(500).json({ error: 'Failed to simulate rollback' });
    }
});

// Early Warning System endpoints
router.get('/warnings', async (req: Request, res: Response) => {
    try {
        const { severity } = req.query;
        
        let warnings;
        if (severity && typeof severity === 'string') {
            warnings = earlyWarningSystem.getWarningsBySeverity(severity as any);
        } else {
            warnings = earlyWarningSystem.getActiveWarnings();
        }
        
        res.json({ warnings, count: warnings.length });
    } catch (error) {
        console.error('Error getting warnings:', error);
        res.status(500).json({ error: 'Failed to get warnings' });
    }
});

router.get('/warnings/metrics', async (req: Request, res: Response) => {
    try {
        const metrics = earlyWarningSystem.getSystemMetrics();
        res.json(metrics);
    } catch (error) {
        console.error('Error getting warning metrics:', error);
        res.status(500).json({ error: 'Failed to get warning metrics' });
    }
});

router.post('/warnings/check', async (req: Request, res: Response) => {
    try {
        const warnings = await earlyWarningSystem.performComprehensiveCheck();
        res.json({ 
            message: 'Warning check completed',
            newWarnings: warnings.length,
            warnings: warnings
        });
    } catch (error) {
        console.error('Error performing warning check:', error);
        res.status(500).json({ error: 'Failed to perform warning check' });
    }
});

router.post('/warnings/:id/resolve', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { resolvedBy, notes } = req.body;
        
        if (!resolvedBy) {
            return res.status(400).json({ error: 'resolvedBy is required' });
        }
        
        const resolved = await earlyWarningSystem.resolveWarning(id, resolvedBy, notes);
        
        if (resolved) {
            res.json({ message: 'Warning resolved successfully' });
        } else {
            res.status(404).json({ error: 'Warning not found or already resolved' });
        }
    } catch (error) {
        console.error('Error resolving warning:', error);
        res.status(500).json({ error: 'Failed to resolve warning' });
    }
});

router.put('/warnings/config', async (req: Request, res: Response) => {
    try {
        const config = req.body;
        earlyWarningSystem.updateConfiguration(config);
        res.json({ message: 'Configuration updated successfully' });
    } catch (error) {
        console.error('Error updating warning configuration:', error);
        res.status(500).json({ error: 'Failed to update configuration' });
    }
});

// Conflict Probability Scoring endpoints
router.get('/risk-assessment/upcoming', async (req: Request, res: Response) => {
    try {
        const { days = 30 } = req.query;
        const daysNum = parseInt(days as string);
        
        if (isNaN(daysNum) || daysNum < 1 || daysNum > 90) {
            return res.status(400).json({ error: 'days must be between 1 and 90' });
        }
        
        const assessment = await conflictProbabilityScorer.getUpcomingRisks(daysNum);
        res.json(assessment);
    } catch (error) {
        console.error('Error getting upcoming risks:', error);
        res.status(500).json({ error: 'Failed to get upcoming risks' });
    }
});

router.get('/risk-assessment/date/:date', async (req: Request, res: Response) => {
    try {
        const { date } = req.params;
        const targetDate = new Date(date);
        
        if (isNaN(targetDate.getTime())) {
            return res.status(400).json({ error: 'Invalid date format' });
        }
        
        const score = await conflictProbabilityScorer.calculateDateRisk(targetDate);
        res.json(score);
    } catch (error) {
        console.error('Error calculating date risk:', error);
        res.status(500).json({ error: 'Failed to calculate date risk' });
    }
});

router.post('/risk-assessment/range', async (req: Request, res: Response) => {
    try {
        const { startDate, endDate } = req.body;
        
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate are required' });
        }
        
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({ error: 'Invalid date format' });
        }
        
        if (end <= start) {
            return res.status(400).json({ error: 'endDate must be after startDate' });
        }
        
        const assessment = await conflictProbabilityScorer.calculateRangeRisk(start, end);
        res.json(assessment);
    } catch (error) {
        console.error('Error calculating range risk:', error);
        res.status(500).json({ error: 'Failed to calculate range risk' });
    }
});

router.get('/risk-assessment/factors', async (req: Request, res: Response) => {
    try {
        const factors = conflictProbabilityScorer.getRiskFactorAnalysis();
        res.json({ factors });
    } catch (error) {
        console.error('Error getting risk factors:', error);
        res.status(500).json({ error: 'Failed to get risk factors' });
    }
});

router.put('/risk-assessment/config', async (req: Request, res: Response) => {
    try {
        const config = req.body;
        conflictProbabilityScorer.updateConfiguration(config);
        res.json({ message: 'Risk assessment configuration updated successfully' });
    } catch (error) {
        console.error('Error updating risk assessment config:', error);
        res.status(500).json({ error: 'Failed to update configuration' });
    }
});

router.post('/risk-assessment/clear-cache', async (req: Request, res: Response) => {
    try {
        conflictProbabilityScorer.clearCache();
        res.json({ message: 'Risk assessment cache cleared successfully' });
    } catch (error) {
        console.error('Error clearing risk assessment cache:', error);
        res.status(500).json({ error: 'Failed to clear cache' });
    }
});

// Event Constraint Management endpoints
router.get('/events', async (req: Request, res: Response) => {
    try {
        const { days = 30 } = req.query;
        const daysNum = parseInt(days as string);
        
        const events = await eventConstraintManager.getUpcomingEvents(daysNum);
        res.json({ events, count: events.length });
    } catch (error) {
        console.error('Error getting events:', error);
        res.status(500).json({ error: 'Failed to get events' });
    }
});

router.get('/events/definitions', async (req: Request, res: Response) => {
    try {
        const definitions = eventConstraintManager.getEventDefinitions();
        res.json({ definitions });
    } catch (error) {
        console.error('Error getting event definitions:', error);
        res.status(500).json({ error: 'Failed to get event definitions' });
    }
});

router.post('/events/definitions', async (req: Request, res: Response) => {
    try {
        const definition = req.body;
        
        if (!definition.id || !definition.name || !definition.type) {
            return res.status(400).json({ error: 'id, name, and type are required' });
        }
        
        eventConstraintManager.addEventDefinition(definition);
        res.json({ message: 'Event definition created successfully' });
    } catch (error) {
        console.error('Error creating event definition:', error);
        res.status(500).json({ error: 'Failed to create event definition' });
    }
});

router.put('/events/definitions/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        const updated = eventConstraintManager.updateEventDefinition(id, updates);
        
        if (updated) {
            res.json({ message: 'Event definition updated successfully' });
        } else {
            res.status(404).json({ error: 'Event definition not found' });
        }
    } catch (error) {
        console.error('Error updating event definition:', error);
        res.status(500).json({ error: 'Failed to update event definition' });
    }
});

router.delete('/events/definitions/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        
        const deleted = eventConstraintManager.deleteEventDefinition(id);
        
        if (deleted) {
            res.json({ message: 'Event definition deleted successfully' });
        } else {
            res.status(404).json({ error: 'Event definition not found' });
        }
    } catch (error) {
        console.error('Error deleting event definition:', error);
        res.status(500).json({ error: 'Failed to delete event definition' });
    }
});

router.post('/events/generate', async (req: Request, res: Response) => {
    try {
        const { startDate, endDate } = req.body;
        
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate are required' });
        }
        
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({ error: 'Invalid date format' });
        }
        
        const instances = await eventConstraintManager.generateEventInstances(start, end);
        res.json({ 
            message: 'Event instances generated successfully',
            generated: instances.length,
            instances 
        });
    } catch (error) {
        console.error('Error generating event instances:', error);
        res.status(500).json({ error: 'Failed to generate event instances' });
    }
});

router.post('/events/apply-constraints', async (req: Request, res: Response) => {
    try {
        const result = await eventConstraintManager.processAutomaticConstraints();
        res.json(result);
    } catch (error) {
        console.error('Error applying event constraints:', error);
        res.status(500).json({ error: 'Failed to apply event constraints' });
    }
});

router.get('/events/holidays', async (req: Request, res: Response) => {
    try {
        const { startDate, endDate } = req.query;
        
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate are required' });
        }
        
        const start = new Date(startDate as string);
        const end = new Date(endDate as string);
        
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({ error: 'Invalid date format' });
        }
        
        const holidays = eventConstraintManager.getHolidayCalendar(start, end);
        res.json({ holidays });
    } catch (error) {
        console.error('Error getting holidays:', error);
        res.status(500).json({ error: 'Failed to get holidays' });
    }
});

router.get('/events/date/:date', async (req: Request, res: Response) => {
    try {
        const { date } = req.params;
        const targetDate = new Date(date);
        
        if (isNaN(targetDate.getTime())) {
            return res.status(400).json({ error: 'Invalid date format' });
        }
        
        const events = eventConstraintManager.getEventsForDate(targetDate);
        const holiday = eventConstraintManager.isHoliday(targetDate);
        
        res.json({ events, holiday, date });
    } catch (error) {
        console.error('Error getting events for date:', error);
        res.status(500).json({ error: 'Failed to get events for date' });
    }
});

router.get('/events/stats', async (req: Request, res: Response) => {
    try {
        const stats = eventConstraintManager.getSystemStats();
        res.json(stats);
    } catch (error) {
        console.error('Error getting event stats:', error);
        res.status(500).json({ error: 'Failed to get event stats' });
    }
});

// Constraint Template Library endpoints
router.get('/templates', async (req: Request, res: Response) => {
    try {
        const { category, tags, minRating, createdBy, isPublic, isVerified, textSearch } = req.query;
        
        const filters: any = {};
        if (category) filters.category = category;
        if (tags) filters.tags = (tags as string).split(',');
        if (minRating) filters.minRating = parseFloat(minRating as string);
        if (createdBy) filters.createdBy = createdBy;
        if (isPublic !== undefined) filters.isPublic = isPublic === 'true';
        if (isVerified !== undefined) filters.isVerified = isVerified === 'true';
        if (textSearch) filters.textSearch = textSearch;
        
        const templates = constraintTemplateLibrary.getTemplates(filters);
        res.json({ templates, count: templates.length });
    } catch (error) {
        console.error('Error getting templates:', error);
        res.status(500).json({ error: 'Failed to get templates' });
    }
});

router.get('/templates/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const template = constraintTemplateLibrary.getTemplate(id);
        
        if (template) {
            res.json(template);
        } else {
            res.status(404).json({ error: 'Template not found' });
        }
    } catch (error) {
        console.error('Error getting template:', error);
        res.status(500).json({ error: 'Failed to get template' });
    }
});

router.post('/templates', async (req: Request, res: Response) => {
    try {
        const template = req.body;
        
        if (!template.id || !template.name || !template.category) {
            return res.status(400).json({ error: 'id, name, and category are required' });
        }
        
        constraintTemplateLibrary.addTemplate(template);
        res.json({ message: 'Template created successfully', templateId: template.id });
    } catch (error) {
        console.error('Error creating template:', error);
        res.status(500).json({ error: 'Failed to create template' });
    }
});

router.put('/templates/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        const updated = constraintTemplateLibrary.updateTemplate(id, updates);
        
        if (updated) {
            res.json({ message: 'Template updated successfully' });
        } else {
            res.status(404).json({ error: 'Template not found' });
        }
    } catch (error) {
        console.error('Error updating template:', error);
        res.status(500).json({ error: 'Failed to update template' });
    }
});

router.delete('/templates/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        
        const deleted = constraintTemplateLibrary.deleteTemplate(id);
        
        if (deleted) {
            res.json({ message: 'Template deleted successfully' });
        } else {
            res.status(404).json({ error: 'Template not found' });
        }
    } catch (error) {
        console.error('Error deleting template:', error);
        res.status(500).json({ error: 'Failed to delete template' });
    }
});

router.post('/templates/:id/apply', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { variables, targetDate, targetDateRange, applicableAnalysts, previewMode } = req.body;
        
        const application = {
            templateId: id,
            variables: variables || {},
            targetDate: targetDate ? new Date(targetDate) : undefined,
            targetDateRange: targetDateRange ? {
                startDate: new Date(targetDateRange.startDate),
                endDate: new Date(targetDateRange.endDate)
            } : undefined,
            applicableAnalysts,
            previewMode: previewMode || false
        };
        
        const result = await constraintTemplateLibrary.applyTemplate(application);
        res.json(result);
    } catch (error) {
        console.error('Error applying template:', error);
        res.status(500).json({ error: 'Failed to apply template' });
    }
});

router.get('/templates/categories/stats', async (req: Request, res: Response) => {
    try {
        const categories = constraintTemplateLibrary.getCategories();
        res.json({ categories });
    } catch (error) {
        console.error('Error getting template categories:', error);
        res.status(500).json({ error: 'Failed to get template categories' });
    }
});

router.get('/templates/popular/:limit?', async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.params.limit || '10');
        const templates = constraintTemplateLibrary.getPopularTemplates(limit);
        res.json({ templates });
    } catch (error) {
        console.error('Error getting popular templates:', error);
        res.status(500).json({ error: 'Failed to get popular templates' });
    }
});

router.get('/templates/top-rated/:limit?', async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.params.limit || '10');
        const templates = constraintTemplateLibrary.getTopRatedTemplates(limit);
        res.json({ templates });
    } catch (error) {
        console.error('Error getting top-rated templates:', error);
        res.status(500).json({ error: 'Failed to get top-rated templates' });
    }
});

router.get('/templates/search/:query', async (req: Request, res: Response) => {
    try {
        const { query } = req.params;
        const templates = constraintTemplateLibrary.searchTemplates(query);
        res.json({ templates, query });
    } catch (error) {
        console.error('Error searching templates:', error);
        res.status(500).json({ error: 'Failed to search templates' });
    }
});

router.get('/templates/stats/library', async (req: Request, res: Response) => {
    try {
        const stats = constraintTemplateLibrary.getLibraryStats();
        res.json(stats);
    } catch (error) {
        console.error('Error getting library stats:', error);
        res.status(500).json({ error: 'Failed to get library stats' });
    }
});

router.post('/templates/create-from-constraints', async (req: Request, res: Response) => {
    try {
        const { constraintIds, templateData } = req.body;
        
        if (!constraintIds || !Array.isArray(constraintIds) || constraintIds.length === 0) {
            return res.status(400).json({ error: 'constraintIds array is required' });
        }
        
        const templateId = await constraintTemplateLibrary.createTemplateFromConstraints(constraintIds, templateData);
        res.json({ message: 'Template created from constraints', templateId });
    } catch (error) {
        console.error('Error creating template from constraints:', error);
        res.status(500).json({ error: 'Failed to create template from constraints' });
    }
});

export default router; 