import { Router, Request, Response } from 'express';
import { generationBlockService, GenerationBlockService } from '../services/GenerationBlockService';

const router = Router();

// Get recent generation blocks
router.get('/', async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 10;
        const blocks = await generationBlockService.getRecentBlocks(limit);
        res.json(blocks);
    } catch (error) {
        console.error('Error fetching generation blocks:', error);
        res.status(500).json({ error: 'Failed to fetch generation blocks' });
    }
});

// Get generation statistics
router.get('/stats', async (req: Request, res: Response) => {
    try {
        const stats = await generationBlockService.getGenerationStats();
        res.json(stats);
    } catch (error) {
        console.error('Error fetching generation stats:', error);
        res.status(500).json({ error: 'Failed to fetch generation stats' });
    }
});

// Get a specific block by ID
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = await generationBlockService.getBlockById(id);

        if (!result) {
            return res.status(404).json({ error: 'Generation block not found' });
        }

        res.json(result);
    } catch (error) {
        console.error('Error fetching generation block:', error);
        res.status(500).json({ error: 'Failed to fetch generation block' });
    }
});

// Get decision log for a block
router.get('/:id/decisions', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = await generationBlockService.getBlockById(id);

        if (!result) {
            return res.status(404).json({ error: 'Generation block not found' });
        }

        res.json(result.decisions);
    } catch (error) {
        console.error('Error fetching decisions:', error);
        res.status(500).json({ error: 'Failed to fetch decisions' });
    }
});

// Manually apply retention policy (admin)
router.post('/apply-retention', async (req: Request, res: Response) => {
    try {
        const result = await generationBlockService.applyRetentionPolicy();
        res.json({ message: 'Retention policy applied', ...result });
    } catch (error) {
        console.error('Error applying retention policy:', error);
        res.status(500).json({ error: 'Failed to apply retention policy' });
    }
});

export default router;
