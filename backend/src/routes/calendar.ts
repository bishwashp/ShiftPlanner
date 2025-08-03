import { Router } from 'express';
import { CalendarLayerService } from '../services/CalendarLayerService';
import { ViewManagementService } from '../services/ViewManagementService';
import { prisma } from '../lib/prisma';

const router = Router();
const calendarLayerService = new CalendarLayerService(prisma);
const viewManagementService = new ViewManagementService(prisma);

// Helper function to get user ID from request (placeholder for auth)
const getUserId = (req: any): string => {
  // TODO: Implement proper authentication
  return req.headers['user-id'] || 'default-user';
};

// Helper function to validate date range
const validateDateRange = (startDate: string, endDate: string) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error('Invalid date format');
  }
  
  if (start > end) {
    throw new Error('Start date must be before end date');
  }
  
  return { startDate: start, endDate: end };
};

/**
 * GET /api/calendar/layers
 * Get all available calendar layers with user preferences
 */
router.get('/layers', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        error: 'startDate and endDate query parameters are required' 
      });
    }

    const dateRange = validateDateRange(startDate as string, endDate as string);
    const userId = getUserId(req);
    
    const result = await calendarLayerService.getCalendarLayers(dateRange, userId);
    
    res.json(result);
  } catch (error) {
    console.error('Error getting calendar layers:', error);
    res.status(500).json({ 
      error: 'Failed to get calendar layers',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/calendar/layers/:layerId/data
 * Get data for specific layer within date range
 */
router.get('/layers/:layerId/data', async (req, res) => {
  try {
    const { layerId } = req.params;
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        error: 'startDate and endDate query parameters are required' 
      });
    }

    const dateRange = validateDateRange(startDate as string, endDate as string);
    
    const result = await calendarLayerService.getLayerData(layerId, dateRange);
    
    res.json(result);
  } catch (error) {
    console.error('Error getting layer data:', error);
    res.status(500).json({ 
      error: 'Failed to get layer data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/calendar/layers/:layerId/toggle
 * Toggle layer visibility
 */
router.post('/layers/:layerId/toggle', async (req, res) => {
  try {
    const { layerId } = req.params;
    const { enabled } = req.body;
    const userId = getUserId(req);
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ 
        error: 'enabled must be a boolean value' 
      });
    }
    
    await calendarLayerService.toggleLayer(layerId, enabled, userId);
    
    res.json({ success: true, message: `Layer ${layerId} ${enabled ? 'enabled' : 'disabled'}` });
  } catch (error) {
    console.error('Error toggling layer:', error);
    res.status(500).json({ 
      error: 'Failed to toggle layer',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/calendar/layers/preferences
 * Update layer preferences (opacity, color, order)
 */
router.put('/layers/preferences', async (req, res) => {
  try {
    const { layerId, opacity, color, orderIndex } = req.body;
    const userId = getUserId(req);
    
    if (!layerId) {
      return res.status(400).json({ 
        error: 'layerId is required' 
      });
    }
    
    const preferences = {
      layerId,
      opacity: opacity !== undefined ? Number(opacity) : undefined,
      color,
      orderIndex: orderIndex !== undefined ? Number(orderIndex) : undefined
    };
    
    await calendarLayerService.updateLayerPreferences(userId, preferences);
    
    res.json({ success: true, message: 'Layer preferences updated' });
  } catch (error) {
    console.error('Error updating layer preferences:', error);
    res.status(500).json({ 
      error: 'Failed to update layer preferences',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/calendar/layers/conflicts
 * Get conflicts across all enabled layers
 */
router.get('/layers/conflicts', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        error: 'startDate and endDate query parameters are required' 
      });
    }

    const dateRange = validateDateRange(startDate as string, endDate as string);
    const userId = getUserId(req);
    
    // Get all layers to check for conflicts
    const layers = await calendarLayerService.getCalendarLayers(dateRange, userId);
    const enabledLayerIds = layers.layers.filter(l => l.enabled).map(l => l.id);
    
    const allConflicts = [];
    for (const layerId of enabledLayerIds) {
      const conflicts = await calendarLayerService.getLayerConflicts(layerId, dateRange);
      allConflicts.push(...conflicts);
    }
    
    res.json({ conflicts: allConflicts });
  } catch (error) {
    console.error('Error getting layer conflicts:', error);
    res.status(500).json({ 
      error: 'Failed to get layer conflicts',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/calendar/layers/reset
 * Reset layer preferences to defaults
 */
router.post('/layers/reset', async (req, res) => {
  try {
    const userId = getUserId(req);
    
    await calendarLayerService.resetLayerPreferences(userId);
    
    res.json({ success: true, message: 'Layer preferences reset to defaults' });
  } catch (error) {
    console.error('Error resetting layer preferences:', error);
    res.status(500).json({ 
      error: 'Failed to reset layer preferences',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/calendar/view/:type
 * Get optimized data for specific view type
 */
router.get('/view/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { date, layers } = req.query;
    
    if (!date) {
      return res.status(400).json({ 
        error: 'date query parameter is required' 
      });
    }

    const viewDate = new Date(date as string);
    if (isNaN(viewDate.getTime())) {
      return res.status(400).json({ 
        error: 'Invalid date format' 
      });
    }

    const userId = getUserId(req);
    
    // Get view context
    const context = await viewManagementService.getViewContext(type as 'day' | 'week' | 'month', viewDate);
    
    // Use provided layers or get user preferences
    const enabledLayers = layers ? (layers as string).split(',') : context.recommendedLayers;
    
    // Get view data
    const result = await viewManagementService.getViewData(type, context.dateRange, enabledLayers);
    
    res.json({
      ...result,
      context
    });
  } catch (error) {
    console.error('Error getting view data:', error);
    res.status(500).json({ 
      error: 'Failed to get view data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/calendar/view/preferences
 * Save view preferences
 */
router.put('/view/preferences', async (req, res) => {
  try {
    const { viewType, defaultLayers, zoomLevel, showConflicts, showFairnessIndicators } = req.body;
    const userId = getUserId(req);
    
    if (!viewType) {
      return res.status(400).json({ 
        error: 'viewType is required' 
      });
    }
    
    const preferences = {
      viewType,
      defaultLayers: Array.isArray(defaultLayers) ? defaultLayers : [],
      zoomLevel: zoomLevel !== undefined ? Number(zoomLevel) : 1,
      showConflicts: showConflicts !== undefined ? Boolean(showConflicts) : true,
      showFairnessIndicators: showFairnessIndicators !== undefined ? Boolean(showFairnessIndicators) : true
    };
    
    await viewManagementService.saveViewPreferences(userId, preferences);
    
    res.json({ success: true, message: 'View preferences saved' });
  } catch (error) {
    console.error('Error saving view preferences:', error);
    res.status(500).json({ 
      error: 'Failed to save view preferences',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/calendar/view/:type/preferences
 * Get user's view preferences for specific view type
 */
router.get('/view/:type/preferences', async (req, res) => {
  try {
    const { type } = req.params;
    const userId = getUserId(req);
    
    const preferences = await viewManagementService.getUserViewPreferences(userId, type);
    
    if (!preferences) {
      // Return default preferences if none exist
      const defaultPreferences = viewManagementService.getDefaultViewPreferences(type);
      res.json(defaultPreferences);
    } else {
      res.json(preferences);
    }
  } catch (error) {
    console.error('Error getting view preferences:', error);
    res.status(500).json({ 
      error: 'Failed to get view preferences',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 