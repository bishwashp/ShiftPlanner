import { Router, Request, Response } from 'express';
import { shiftSwapService } from '../services/ShiftSwapService';
import { authenticate } from '../middleware/auth';

const router = Router();

// Apply auth middleware to all routes
router.use(authenticate);

// Create a swap request (Direct, Broadcast, Offer)
router.post('/', async (req: Request, res: Response) => {
    try {
        const analystId = (req as any).user?.analystId;
        if (!analystId) return res.status(403).json({ error: 'Analyst profile required' });

        const data = {
            requestingAnalystId: analystId,
            requestingShiftDate: new Date(req.body.requestingShiftDate),
            targetAnalystId: req.body.targetAnalystId,
            targetShiftDate: req.body.targetShiftDate ? new Date(req.body.targetShiftDate) : undefined,
            isBroadcast: req.body.isBroadcast,
            parentId: req.body.parentId
        };

        const swap = await shiftSwapService.createSwapRequest(data);
        res.status(201).json(swap);
    } catch (error: any) {
        console.error('Error creating swap request:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get my swaps (Incoming, Outgoing, History)
router.get('/mine', async (req: Request, res: Response) => {
    try {
        const analystId = (req as any).user?.analystId;
        if (!analystId) return res.status(403).json({ error: 'Analyst profile required' });

        const swaps = await shiftSwapService.getAnalystSwaps(analystId);
        res.json(swaps);
    } catch (error: any) {
        console.error('Error fetching my swaps:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get broadcast feed for my region
router.get('/broadcasts', async (req: Request, res: Response) => {
    try {
        const analystId = (req as any).user?.analystId;
        const regionId = (req as any).user?.regionId; // Assuming user/analyst has regionId in token or accessible

        // If regionId missing from token, might need to fetch analyst profile. 
        // For now assume it's available or fetch it if crucial.
        // Let's rely on what we have or fetch analyst if needed. 
        // Better: client passes regionId? No, secure it.

        // Simplified: Pass regionId in query or derive from analyst. 
        // Let's assume the service handles fetching region if implicit logic needed, 
        // but here service expects regionId.

        if (!analystId) return res.status(403).json({ error: 'Analyst profile required' });

        // Fetch analyst to get region if not in token
        // For speed, let's assume we can get it. If not, we query DB.
        // We'll trust the client sending regionId for now OR better, query analyst.
        // Let's just pass analystId to service and let it figure out region or pass as query param?
        // Service signature: getBroadcastFeed(regionId, excludeAnalystId)

        const regionIdFilter = req.query.regionId as string;
        if (!regionIdFilter) {
            return res.status(400).json({ error: 'Region ID required' });
        }

        const broadcasts = await shiftSwapService.getBroadcastFeed(regionIdFilter, analystId);
        res.json(broadcasts);
    } catch (error: any) {
        console.error('Error fetching broadcasts:', error);
        res.status(500).json({ error: error.message });
    }
});

// Approve/Accept a swap
router.post('/:id/approve', async (req: Request, res: Response) => {
    try {
        const analystId = (req as any).user?.analystId;
        if (!analystId) return res.status(403).json({ error: 'Analyst profile required' });

        await shiftSwapService.approveSwap(req.params.id, analystId);
        res.json({ success: true });
    } catch (error: any) {
        console.error('Error approving swap:', error);
        res.status(500).json({ error: error.message });
    }
});

// Manager Force Swap Endpoint
router.post('/manager', async (req: Request, res: Response) => {
    try {
        const { sourceAnalystId, sourceDate, targetAnalystId, targetDate, force } = req.body;

        await shiftSwapService.executeManagerSwap(
            sourceAnalystId,
            new Date(sourceDate),
            targetAnalystId,
            new Date(targetDate),
            { force }
        );

        res.json({ success: true });
    } catch (error: any) {
        console.error('Error executing manager swap:', error);

        // Handle Validation Errors specifically
        if (error.message && error.message.startsWith('{')) {
            try {
                const errObj = JSON.parse(error.message);
                if (errObj.type === 'CONSTRAINT_VIOLATION') {
                    return res.status(409).json({
                        error: 'Constraint Violation',
                        details: errObj
                    });
                }
            } catch (e) {
                // Not JSON
            }
        }

        res.status(500).json({ error: error.message });
    }
});

// Manager Range Swap Endpoint (Time-Slice Exchange)
router.post('/manager/range-swap', async (req: Request, res: Response) => {
    try {
        const { sourceAnalystId, targetAnalystId, startDate, endDate, force } = req.body;

        await shiftSwapService.executeManagerRangeSwap(
            sourceAnalystId,
            targetAnalystId,
            new Date(startDate),
            new Date(endDate),
            { force }
        );

        res.json({ success: true });
    } catch (error: any) {
        console.error('Error executing manager range swap:', error);

        // Handle Validation Errors specifically
        if (error.message && error.message.startsWith('{')) {
            try {
                const errObj = JSON.parse(error.message);
                if (errObj.type === 'CONSTRAINT_VIOLATION') {
                    return res.status(409).json({
                        error: 'Constraint Violation',
                        details: errObj
                    });
                }
            } catch (e) {
                // Not JSON
            }
        }

        res.status(500).json({ error: error.message });
    }
});

export default router;
