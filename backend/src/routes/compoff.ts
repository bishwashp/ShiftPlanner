import { Router, Request, Response } from 'express';
import { compOffService } from '../services/CompOffService';

const router = Router();

// Get all analysts' comp-off balances (summary view)
router.get('/', async (req: Request, res: Response) => {
    try {
        const balances = await compOffService.getAllBalances();
        res.json(balances);
    } catch (error) {
        console.error('Error fetching comp-off balances:', error);
        res.status(500).json({ error: 'Failed to fetch comp-off balances' });
    }
});

// Get total liability (for reporting)
router.get('/liability', async (req: Request, res: Response) => {
    try {
        const liability = await compOffService.getTotalLiability();
        res.json(liability);
    } catch (error) {
        console.error('Error fetching liability:', error);
        res.status(500).json({ error: 'Failed to fetch liability' });
    }
});

// Get specific analyst's balance
router.get('/:analystId', async (req: Request, res: Response) => {
    try {
        const { analystId } = req.params;
        const balance = await compOffService.getBalance(analystId);
        res.json(balance);
    } catch (error) {
        console.error('Error fetching comp-off balance:', error);
        res.status(500).json({ error: 'Failed to fetch comp-off balance' });
    }
});

// Get analyst's transaction history
router.get('/:analystId/transactions', async (req: Request, res: Response) => {
    try {
        const { analystId } = req.params;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
        const transactions = await compOffService.getTransactions(analystId, limit);
        res.json(transactions);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

// Get analyst's full balance with transactions
router.get('/:analystId/details', async (req: Request, res: Response) => {
    try {
        const { analystId } = req.params;
        const details = await compOffService.getBalanceWithTransactions(analystId);

        if (!details) {
            // Return empty balance for analysts with no comp-off history
            return res.json({
                earned: 0,
                used: 0,
                available: 0,
                transactions: [],
            });
        }

        res.json({
            earned: details.earnedUnits,
            used: details.usedUnits,
            available: details.earnedUnits - details.usedUnits,
            transactions: details.transactions,
        });
    } catch (error) {
        console.error('Error fetching balance details:', error);
        res.status(500).json({ error: 'Failed to fetch balance details' });
    }
});

// Check if analyst has sufficient balance
router.get('/:analystId/check/:units', async (req: Request, res: Response) => {
    try {
        const { analystId, units } = req.params;
        const hasSufficient = await compOffService.hasAvailableBalance(
            analystId,
            parseFloat(units)
        );
        res.json({ hasAvailableBalance: hasSufficient });
    } catch (error) {
        console.error('Error checking balance:', error);
        res.status(500).json({ error: 'Failed to check balance' });
    }
});

// Manual credit (admin only)
router.post('/:analystId/credit', async (req: Request, res: Response) => {
    try {
        const { analystId } = req.params;
        const { units, reason, constraintId } = req.body;

        if (!units || !reason) {
            return res.status(400).json({ error: 'units and reason are required' });
        }

        const transaction = await compOffService.creditFromConstraint(
            analystId,
            constraintId || 'MANUAL',
            parseFloat(units),
            reason
        );

        res.status(201).json(transaction);
    } catch (error) {
        console.error('Error crediting comp-off:', error);
        res.status(500).json({ error: 'Failed to credit comp-off' });
    }
});

// Manual debit (admin only)
router.post('/:analystId/debit', async (req: Request, res: Response) => {
    try {
        const { analystId } = req.params;
        const { units, absenceId } = req.body;

        if (!units) {
            return res.status(400).json({ error: 'units is required' });
        }

        const transaction = await compOffService.debitForAbsence(
            analystId,
            absenceId || 'MANUAL',
            parseFloat(units)
        );

        res.status(201).json(transaction);
    } catch (error: any) {
        console.error('Error debiting comp-off:', error);
        if (error.message?.includes('Insufficient')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to debit comp-off' });
    }
});

export default router;
