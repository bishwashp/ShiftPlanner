import { Router } from 'express';
import { notificationController } from '../controllers/NotificationController';

const router = Router();

router.get('/', notificationController.getNotifications);
router.put('/:id/read', notificationController.markAsRead);
router.put('/read-all', notificationController.markAllAsRead);
router.delete('/:id', notificationController.deleteNotification);

export default router;
