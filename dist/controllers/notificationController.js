"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkDeleteOld = exports.deleteNotification = exports.markAllAsRead = exports.markAsRead = exports.getUnreadCount = exports.listNotifications = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Notification_1 = require("../models/Notification");
const listNotifications = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ success: false, message: 'Auth required.' });
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 20);
        const skip = (page - 1) * limit;
        const category = req.query.category;
        const unreadOnly = req.query.unreadOnly === 'true';
        const targetUserId = req.user.role === 'admin' && req.query.userId
            ? new mongoose_1.default.Types.ObjectId(req.query.userId)
            : req.user._id;
        const filter = { userId: targetUserId };
        if (category)
            filter.category = category;
        if (unreadOnly)
            filter.isRead = false;
        const [notifications, total, unreadCount] = await Promise.all([
            Notification_1.Notification.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Notification_1.Notification.countDocuments(filter),
            Notification_1.Notification.countDocuments({ userId: targetUserId, isRead: false }),
        ]);
        return res.status(200).json({
            success: true,
            data: {
                notifications,
                unreadCount,
                pagination: { page, limit, total, pages: Math.ceil(total / limit) },
            },
        });
    }
    catch (error) {
        console.error('listNotifications error:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch notifications.' });
    }
};
exports.listNotifications = listNotifications;
const getUnreadCount = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ success: false, message: 'Auth required.' });
        const count = await Notification_1.Notification.countDocuments({
            userId: req.user._id,
            isRead: false,
        });
        return res.status(200).json({ success: true, data: { unreadCount: count } });
    }
    catch (error) {
        console.error('getUnreadCount error:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch unread count.' });
    }
};
exports.getUnreadCount = getUnreadCount;
const markAsRead = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ success: false, message: 'Auth required.' });
        const notif = await Notification_1.Notification.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, { isRead: true, readAt: new Date() }, { new: true });
        if (!notif)
            return res.status(404).json({ success: false, message: 'Notification not found.' });
        return res.status(200).json({ success: true, data: notif });
    }
    catch (error) {
        console.error('markAsRead error:', error);
        return res.status(500).json({ success: false, message: 'Failed to mark notification as read.' });
    }
};
exports.markAsRead = markAsRead;
const markAllAsRead = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ success: false, message: 'Auth required.' });
        const result = await Notification_1.Notification.updateMany({ userId: req.user._id, isRead: false }, { isRead: true, readAt: new Date() });
        return res.status(200).json({
            success: true,
            message: `${result.modifiedCount} notification(s) marked as read.`,
            data: { markedCount: result.modifiedCount },
        });
    }
    catch (error) {
        console.error('markAllAsRead error:', error);
        return res.status(500).json({ success: false, message: 'Failed to mark all as read.' });
    }
};
exports.markAllAsRead = markAllAsRead;
const deleteNotification = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ success: false, message: 'Auth required.' });
        const notif = await Notification_1.Notification.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id,
        });
        if (!notif)
            return res.status(404).json({ success: false, message: 'Notification not found.' });
        return res.status(200).json({ success: true, message: 'Notification deleted.' });
    }
    catch (error) {
        console.error('deleteNotification error:', error);
        return res.status(500).json({ success: false, message: 'Failed to delete notification.' });
    }
};
exports.deleteNotification = deleteNotification;
const bulkDeleteOld = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Admin access required.' });
        }
        const days = parseInt(req.query.days) || 90;
        const before = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const result = await Notification_1.Notification.deleteMany({
            isRead: true,
            createdAt: { $lt: before },
        });
        return res.status(200).json({
            success: true,
            message: `Deleted ${result.deletedCount} old read notifications.`,
            data: { deletedCount: result.deletedCount },
        });
    }
    catch (error) {
        console.error('bulkDeleteOld error:', error);
        return res.status(500).json({ success: false, message: 'Failed to bulk delete.' });
    }
};
exports.bulkDeleteOld = bulkDeleteOld;
//# sourceMappingURL=notificationController.js.map