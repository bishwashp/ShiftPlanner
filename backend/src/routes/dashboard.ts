
import { Router, Request, Response } from 'express';
import { dashboardService } from '../services/DashboardService';

const router = Router();

// GET /status - no auth required for dashboard widgets
router.get('/status', async (req: Request, res: Response) => {
    try {
        const regionId = req.headers['x-region-id'] as string;

        if (!regionId) {
            return res.status(400).json({ error: 'x-region-id header is required' });
        }

        const status = await dashboardService.getOperationalStatus(regionId);
        res.json(status);
    } catch (error) {
        console.error('Error fetching dashboard status:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard status' });
    }
});

// GET /global-status - global view across all regions (no auth, no region header needed)
router.get('/global-status', async (req: Request, res: Response) => {
    try {
        const status = await dashboardService.getGlobalOperationalStatus();
        res.json(status);
    } catch (error) {
        console.error('Error fetching global dashboard status:', error);
        res.status(500).json({ error: 'Failed to fetch global dashboard status' });
    }
});

export default router;
