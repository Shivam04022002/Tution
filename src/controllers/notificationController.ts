import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { Notification } from '../models/Notification';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/notifications
// Returns paginated notifications for the authenticated user.
// Query: ?page=1&limit=20&category=payment&unreadOnly=true
// ─────────────────────────────────────────────────────────────────────────────
export const listNotifications = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Auth required.' });

    const page       = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit      = Math.min(50, parseInt(req.query.limit as string) || 20);
    const skip       = (page - 1) * limit;
    const category   = req.query.category as string | undefined;
    const unreadOnly = req.query.unreadOnly === 'true';

    // Admin can query any userId; others only own
    const targetUserId =
      req.user.role === 'admin' && req.query.userId
        ? new mongoose.Types.ObjectId(req.query.userId as string)
        : req.user._id as mongoose.Types.ObjectId;

    const filter: Record<string, any> = { userId: targetUserId };
    if (category)  filter.category = category;
    if (unreadOnly) filter.isRead  = false;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ userId: targetUserId, isRead: false }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        notifications,
        unreadCount,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error('listNotifications error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch notifications.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/notifications/unread-count
// Lightweight poll endpoint for the notification bell badge.
// ─────────────────────────────────────────────────────────────────────────────
export const getUnreadCount = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Auth required.' });

    const count = await Notification.countDocuments({
      userId:  req.user._id,
      isRead:  false,
    });

    return res.status(200).json({ success: true, data: { unreadCount: count } });
  } catch (error) {
    console.error('getUnreadCount error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch unread count.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/notifications/:id/read
// Marks a single notification as read.
// ─────────────────────────────────────────────────────────────────────────────
export const markAsRead = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Auth required.' });

    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { isRead: true, readAt: new Date() },
      { new: true },
    );

    if (!notif) return res.status(404).json({ success: false, message: 'Notification not found.' });

    return res.status(200).json({ success: true, data: notif });
  } catch (error) {
    console.error('markAsRead error:', error);
    return res.status(500).json({ success: false, message: 'Failed to mark notification as read.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/notifications/read-all
// Marks ALL unread notifications for the user as read.
// ─────────────────────────────────────────────────────────────────────────────
export const markAllAsRead = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Auth required.' });

    const result = await Notification.updateMany(
      { userId: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() },
    );

    return res.status(200).json({
      success: true,
      message: `${result.modifiedCount} notification(s) marked as read.`,
      data:    { markedCount: result.modifiedCount },
    });
  } catch (error) {
    console.error('markAllAsRead error:', error);
    return res.status(500).json({ success: false, message: 'Failed to mark all as read.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/notifications/:id
// Deletes a single notification (owner only).
// ─────────────────────────────────────────────────────────────────────────────
export const deleteNotification = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Auth required.' });

    const notif = await Notification.findOneAndDelete({
      _id:    req.params.id,
      userId: req.user._id,
    });

    if (!notif) return res.status(404).json({ success: false, message: 'Notification not found.' });

    return res.status(200).json({ success: true, message: 'Notification deleted.' });
  } catch (error) {
    console.error('deleteNotification error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete notification.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/notifications  (admin only — bulk delete old notifications)
// Removes notifications older than `days` days for cleanup.
// ─────────────────────────────────────────────────────────────────────────────
export const bulkDeleteOld = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required.' });
    }

    const days   = parseInt(req.query.days as string) || 90;
    const before = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await Notification.deleteMany({
      isRead:    true,
      createdAt: { $lt: before },
    });

    return res.status(200).json({
      success: true,
      message: `Deleted ${result.deletedCount} old read notifications.`,
      data:    { deletedCount: result.deletedCount },
    });
  } catch (error) {
    console.error('bulkDeleteOld error:', error);
    return res.status(500).json({ success: false, message: 'Failed to bulk delete.' });
  }
};
