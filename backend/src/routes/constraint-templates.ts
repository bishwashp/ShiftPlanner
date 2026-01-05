import { Router, Request, Response } from 'express';
import { constraintTemplateService } from '../services/ConstraintTemplateService';

const router = Router();

// Get all templates
router.get('/', async (req: Request, res: Response) => {
    try {
        const templates = await constraintTemplateService.getTemplates();

        // Parse parameters for each template for easier frontend consumption
        const templatesWithParsedParams = templates.map(t => ({
            ...t,
            parsedParameters: constraintTemplateService.parseParameters(t),
        }));

        res.json(templatesWithParsedParams);
    } catch (error) {
        console.error('Error fetching constraint templates:', error);
        res.status(500).json({ error: 'Failed to fetch constraint templates' });
    }
});

// Get template by name
router.get('/:name', async (req: Request, res: Response) => {
    try {
        const { name } = req.params;
        const template = await constraintTemplateService.getTemplateByName(name);

        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        res.json({
            ...template,
            parsedParameters: constraintTemplateService.parseParameters(template),
        });
    } catch (error) {
        console.error('Error fetching template:', error);
        res.status(500).json({ error: 'Failed to fetch template' });
    }
});

// Validate constraint parameters against template
router.post('/:name/validate', async (req: Request, res: Response) => {
    try {
        const { name } = req.params;
        const params = req.body;

        const template = await constraintTemplateService.getTemplateByName(name);

        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        const validation = constraintTemplateService.validateParams(template, params);
        res.json(validation);
    } catch (error) {
        console.error('Error validating parameters:', error);
        res.status(500).json({ error: 'Failed to validate parameters' });
    }
});

// Seed default templates (admin)
router.post('/seed', async (req: Request, res: Response) => {
    try {
        const result = await constraintTemplateService.seedDefaultTemplates();
        res.json({
            message: 'Seed completed',
            ...result,
        });
    } catch (error) {
        console.error('Error seeding templates:', error);
        res.status(500).json({ error: 'Failed to seed templates' });
    }
});

// Deactivate template (admin)
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const template = await constraintTemplateService.deactivateTemplate(id);
        res.json({
            message: 'Template deactivated',
            template,
        });
    } catch (error: any) {
        console.error('Error deactivating template:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Template not found' });
        }
        res.status(500).json({ error: 'Failed to deactivate template' });
    }
});

export default router;
