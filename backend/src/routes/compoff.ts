import { Router, Request, Response } from 'express';
import { compOffService } from '../services/CompOffService';
import { compOffDetectionService } from '../services/CompOffDetectionService';

const router = Router();

// Get all analysts' comp-off balances (summary view)
// Query params: ?regionId=xxx
router.get('/', async (req: Request, res: Response) => {
    try {
        const regionId = req.query.regionId as string | undefined;
        const balances = await compOffService.getAllBalances(regionId);
        res.json(balances);
    } catch (error) {
        console.error('Error fetching comp-off balances:', error);
        res.status(500).json({ error: 'Failed to fetch comp-off balances' });
    }
});

// Get transaction history (admin only)
// Query params: ?regionId=xxx&analystId=xxx&startDate=xxx&endDate=xxx&limit=50&offset=0
router.get('/transactions', async (req: Request, res: Response) => {
    try {
        const { regionId, analystId, startDate, endDate, limit, offset } = req.query;

        const result = await compOffService.getTransactionHistory({
            regionId: regionId as string | undefined,
            analystId: analystId as string | undefined,
            startDate: startDate ? new Date(startDate as string) : undefined,
            endDate: endDate ? new Date(endDate as string) : undefined,
            limit: limit ? parseInt(limit as string) : 50,
            offset: offset ? parseInt(offset as string) : 0,
        });

        res.json(result);
    } catch (error) {
        console.error('Error fetching transaction history:', error);
        res.status(500).json({ error: 'Failed to fetch transaction history' });
    }
});

// Get total liability (for reporting)
// Query params: ?regionId=xxx
router.get('/liability', async (req: Request, res: Response) => {
    try {
        const liability = await compOffService.getTotalLiability();
        res.json(liability);
    } catch (error) {
        console.error('Error fetching liability:', error);
        res.status(500).json({ error: 'Failed to fetch liability' });
    }
});

// Validate eligibility for "Report Missing CompOff"
// Used by admin to review a missing compoff report
router.post('/validate-eligibility', async (req: Request, res: Response) => {
    try {
        const { analystId, startDate, endDate } = req.body;

        if (!analystId || !startDate || !endDate) {
            return res.status(400).json({
                error: 'analystId, startDate, and endDate are required'
            });
        }

        const summary = await compOffDetectionService.getEligibilitySummary(
            analystId,
            startDate,
            endDate
        );

        res.json(summary);
    } catch (error: any) {
        console.error('Error validating compoff eligibility:', error);
        res.status(500).json({ error: error.message || 'Failed to validate eligibility' });
    }
});

// Report missing compoff (analyst submits, admin reviews)
// This creates a pending request that admin can approve
router.post('/report-missing', async (req: Request, res: Response) => {
    try {
        const { analystId, startDate, endDate, notes } = req.body;

        if (!analystId || !startDate || !endDate) {
            return res.status(400).json({
                error: 'analystId, startDate, and endDate are required'
            });
        }

        // Validate eligibility first
        const eligibility = await compOffDetectionService.validateRolling7DayEligibility(
            analystId,
            startDate,
            endDate
        );

        if (!eligibility.isEligible) {
            return res.status(400).json({
                error: 'Not eligible for compoff',
                reason: eligibility.reason,
                details: eligibility
            });
        }

        // For now, return the validation result
        // In production, this would create a pending request for admin review
        res.json({
            success: true,
            message: 'Report submitted for review',
            eligibility,
            notes
        });
    } catch (error: any) {
        console.error('Error reporting missing compoff:', error);
        res.status(500).json({ error: error.message || 'Failed to report missing compoff' });
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

// Update a transaction (admin only)
router.put('/transactions/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { amount, reason } = req.body;
        // In a real app, we'd get this from req.user
        const performerId = (req as any).user?.id || 'admin';

        if (amount === undefined && reason === undefined) {
            return res.status(400).json({ error: 'At least one field (amount or reason) is required' });
        }

        const transaction = await compOffService.updateTransaction(
            id,
            performerId,
            { amount: amount ? parseFloat(amount) : undefined, reason }
        );

        res.json(transaction);
    } catch (error: any) {
        console.error('Error updating transaction:', error);
        if (error.message === 'Transaction not found') {
            return res.status(404).json({ error: 'Transaction not found' });
        }
        res.status(500).json({ error: 'Failed to update transaction' });
    }
});

// Delete a transaction (admin only)
router.delete('/transactions/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        // In a real app, we'd get this from req.user
        const performerId = (req as any).user?.id || 'admin';

        await compOffService.deleteTransaction(id, performerId);
        res.status(204).send();
    } catch (error: any) {
        console.error('Error deleting transaction:', error);
        if (error.message === 'Transaction not found') {
            return res.status(404).json({ error: 'Transaction not found' });
        }
        res.status(500).json({ error: 'Failed to delete transaction' });
    }
});

// Update analyst balance (admin only)
router.put('/balance/:analystId', async (req: Request, res: Response) => {
    try {
        const { analystId } = req.params;
        const { earnedUnits, usedUnits, reason } = req.body;
        // In a real app, we'd get this from req.user
        const performerId = (req as any).user?.id || 'admin';

        if (earnedUnits === undefined && usedUnits === undefined) {
            return res.status(400).json({ error: 'At least one field (earnedUnits or usedUnits) is required' });
        }

        const balance = await compOffService.updateBalance(
            analystId,
            performerId,
            {
                earnedUnits: earnedUnits !== undefined ? parseFloat(earnedUnits) : undefined,
                usedUnits: usedUnits !== undefined ? parseFloat(usedUnits) : undefined,
                reason
            }
        );

        res.json(balance);
    } catch (error: any) {
        console.error('Error updating balance:', error);
        res.status(500).json({ error: 'Failed to update balance' });
    }
});

// Delete analyst balance (admin only)
router.delete('/balance/:analystId', async (req: Request, res: Response) => {
    try {
        const { analystId } = req.params;
        // In a real app, we'd get this from req.user
        const performerId = (req as any).user?.id || 'admin';

        await compOffService.deleteBalance(analystId, performerId);
        res.status(204).send();
    } catch (error: any) {
        console.error('Error deleting balance:', error);
        if (error.message === 'Balance not found') {
            return res.status(404).json({ error: 'Balance not found' });
        }
        res.status(500).json({ error: 'Failed to delete balance' });
    }
});

export default router;

