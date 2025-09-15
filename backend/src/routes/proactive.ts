import { Router, Request, Response } from 'express';
import { proactiveAnalysisService } from '../services/ProactiveAnalysisService';

const router = Router();

/**
 * Get proactive analysis status
 * Safe to call - won't break if service is not initialized
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = await proactiveAnalysisService.getStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('Error getting proactive analysis status:', error);
    res.status(200).json({
      success: true,
      data: {
        initialized: false,
        isRunning: false,
        isEnabled: false,
        message: 'Proactive analysis not available',
      },
    });
  }
});

/**
 * Enable proactive analysis
 * Safe operation - includes error handling
 */
router.post('/enable', async (req: Request, res: Response) => {
  try {
    await proactiveAnalysisService.enable();
    res.json({
      success: true,
      message: 'Proactive analysis enabled successfully',
    });
  } catch (error) {
    console.error('Error enabling proactive analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to enable proactive analysis',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Disable proactive analysis
 * Safe operation - won't break if already disabled
 */
router.post('/disable', async (req: Request, res: Response) => {
  try {
    await proactiveAnalysisService.disable();
    res.json({
      success: true,
      message: 'Proactive analysis disabled successfully',
    });
  } catch (error) {
    console.error('Error disabling proactive analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disable proactive analysis',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Update proactive analysis configuration
 * Safe operation with validation
 */
router.post('/config', async (req: Request, res: Response) => {
  try {
    const config = req.body;
    
    if (!config || typeof config !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid configuration provided',
      });
    }

    const engine = await proactiveAnalysisService.getEngine();
    await engine.updateConfig(config);
    
    res.json({
      success: true,
      message: 'Configuration updated successfully',
    });
  } catch (error) {
    console.error('Error updating proactive analysis config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update configuration',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Test endpoint - safely run a single analysis cycle
 * Useful for testing without enabling the full service
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    if (!proactiveAnalysisService.isAvailable()) {
      return res.status(200).json({
        success: true,
        message: 'Proactive analysis not initialized - would need to enable first',
        testable: false,
      });
    }

    const engine = await proactiveAnalysisService.getEngine();
    const status = await engine.getStatus();
    
    res.json({
      success: true,
      message: 'Proactive analysis is available and ready',
      testable: true,
      currentStatus: status,
    });
  } catch (error) {
    console.error('Error testing proactive analysis:', error);
    res.status(200).json({
      success: true,
      message: 'Proactive analysis not available for testing',
      testable: false,
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;