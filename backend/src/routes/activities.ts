import { Router, Request, Response } from 'express';
import { ActivityService } from '../services/ActivityService';

const router = Router();

// Get recent activities for dashboard
router.get('/recent', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const activities = await ActivityService.getRecentActivities(limit);

    res.json(activities);
  } catch (error: any) {
    console.error('Error fetching recent activities:', error);
    res.status(500).json({ error: 'Failed to fetch recent activities' });
  }
});

// Get activities with filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const filters: any = {
      category: req.query.category as string,
      type: req.query.type as string,
      performedBy: req.query.performedBy as string,
      impact: req.query.impact as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    };

    // Parse date filters
    if (req.query.startDate) {
      filters.startDate = new Date(req.query.startDate as string);
    }
    if (req.query.endDate) {
      filters.endDate = new Date(req.query.endDate as string);
    }

    const activities = await ActivityService.getActivities(filters);
    res.json(activities);
  } catch (error: any) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

// Get activity statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const stats = await ActivityService.getActivityStats(days);

    res.json(stats);
  } catch (error: any) {
    console.error('Error fetching activity stats:', error);
    res.status(500).json({ error: 'Failed to fetch activity statistics' });
  }
});

// Log a new activity (for internal use)
router.post('/log', async (req: Request, res: Response) => {
  try {
    const activityData = req.body;

    // Validate required fields
    if (!activityData.type || !activityData.category || !activityData.title || !activityData.description) {
      return res.status(400).json({
        error: 'Missing required fields: type, category, title, description'
      });
    }

    await ActivityService.logActivity(activityData);
    res.status(201).json({ success: true, message: 'Activity logged successfully' });
  } catch (error: any) {
    console.error('Error logging activity:', error);
    res.status(500).json({ error: 'Failed to log activity' });
  }
});

// Test endpoint to create a dummy high-impact activity
router.post('/test-high-impact', async (req: Request, res: Response) => {
  try {
    const testActivity = {
      type: 'SYSTEM_MAINTENANCE',
      category: 'SYSTEM' as const,
      title: 'Critical System Update',
      description: 'Emergency security patch applied to resolve critical vulnerability affecting all user accounts',
      performedBy: 'admin',
      resourceType: 'system',
      impact: 'CRITICAL' as const,
      metadata: {
        patchVersion: 'v2.1.3',
        affectedSystems: ['authentication', 'user-management'],
        downtime: '2 minutes'
      }
    };

    await ActivityService.logActivity(testActivity);
    res.status(201).json({
      success: true,
      message: 'High-impact test activity created successfully',
      activity: testActivity
    });
  } catch (error: any) {
    console.error('Error creating test activity:', error);
    res.status(500).json({ error: 'Failed to create test activity' });
  }
});

// Test endpoint to create multiple test activities with different impact levels
router.post('/test-all-impacts', async (req: Request, res: Response) => {
  try {
    const testActivities = [
      {
        type: 'ANALYST_ADDED',
        category: 'ANALYST' as const,
        title: 'New Analyst Added',
        description: 'Added new analyst: Sarah Johnson (EVENING shift)',
        performedBy: 'admin',
        resourceType: 'analyst',
        impact: 'HIGH' as const,
      },
      {
        type: 'SCHEDULE_GENERATED',
        category: 'SCHEDULE' as const,
        title: 'Schedule Generated',
        description: '15 new schedules generated for Nov 15 - Nov 21 using Weekend Rotation algorithm',
        performedBy: 'admin',
        resourceType: 'schedule',
        impact: 'MEDIUM' as const,
      },
      {
        type: 'ALGORITHM_UPDATED',
        category: 'ALGORITHM' as const,
        title: 'Algorithm Updated',
        description: 'Updated Weekend Rotation configuration: fairness weight increased to 0.8',
        performedBy: 'admin',
        resourceType: 'algorithm',
        impact: 'MEDIUM' as const,
      },
      {
        type: 'ABSENCE_ADDED',
        category: 'ABSENCE' as const,
        title: 'Absence Recorded',
        description: 'VACATION absence recorded for Mike Davis from Nov 20 - Nov 22',
        performedBy: 'admin',
        resourceType: 'absence',
        impact: 'LOW' as const,
      }
    ];

    const results = [];
    for (const activity of testActivities) {
      await ActivityService.logActivity(activity);
      results.push(activity);
    }

    res.status(201).json({
      success: true,
      message: 'All impact level test activities created successfully',
      activities: results
    });
  } catch (error: any) {
    console.error('Error creating test activities:', error);
    res.status(500).json({ error: 'Failed to create test activities' });
  }
});

// Cleanup old activities (data retention)
router.post('/cleanup', async (req: Request, res: Response) => {
  try {
    const result = await ActivityService.cleanupOldActivities();
    res.json({
      success: true,
      message: 'Activity cleanup completed',
      deleted: result.deleted,
      criticalKept: result.criticalKept
    });
  } catch (error: any) {
    console.error('Error during activity cleanup:', error);
    res.status(500).json({ error: 'Failed to cleanup activities' });
  }
});

export default router;
