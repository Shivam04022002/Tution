import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import {
  NotificationCampaign,
  CampaignAudience,
  CampaignStatus,
} from '../models/NotificationCampaign';
import { Notification } from '../models/Notification';
import { User } from '../models/User';

// ─────────────────────────────────────────────────────────────────────────────
// Helper: resolve audience → array of userIds
// ─────────────────────────────────────────────────────────────────────────────
async function resolveAudienceUserIds(
  audience: CampaignAudience,
  customSegment?: any,
): Promise<mongoose.Types.ObjectId[]> {
  let filter: Record<string, any> = {};

  switch (audience) {
    case 'all_users':
      filter = { isActive: { $ne: false } };
      break;
    case 'all_teachers':
      filter = { role: 'teacher', isActive: { $ne: false } };
      break;
    case 'all_parents':
      filter = { role: 'parent', isActive: { $ne: false } };
      break;
    case 'verified_teachers': {
      const { TeacherProfile } = require('../models/TeacherProfile');
      const profiles = await TeacherProfile.find({ isVerified: true }).select('userId').lean();
      const ids = profiles.map((p: any) => p.userId);
      filter = { _id: { $in: ids }, role: 'teacher' };
      break;
    }
    case 'premium_teachers': {
      const { TeacherSubscription } = require('../models/TeacherSubscription');
      const subs = await TeacherSubscription.find({
        planName: { $in: ['professional', 'premium'] },
        status: 'active',
      }).select('userId').lean();
      const ids = subs.map((s: any) => s.userId);
      filter = { _id: { $in: ids }, role: 'teacher' };
      break;
    }
    case 'free_teachers': {
      const { TeacherSubscription } = require('../models/TeacherSubscription');
      const subs = await TeacherSubscription.find({
        planName: 'free',
      }).select('userId').lean();
      const ids = subs.map((s: any) => s.userId);
      filter = { _id: { $in: ids }, role: 'teacher' };
      break;
    }
    case 'kyc_pending': {
      const { KycDocument } = require('../models/KycDocument');
      const kycs = await KycDocument.find({ status: 'pending' }).select('userId').lean();
      const ids = kycs.map((k: any) => k.userId);
      filter = { _id: { $in: ids } };
      break;
    }
    case 'active_parents': {
      // Parents with at least one active requirement in the last 30 days
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const { ParentRequirement } = require('../models/ParentRequirement');
      const reqs = await ParentRequirement.find({
        status: 'active',
        updatedAt: { $gte: since },
      }).select('parentId').lean();
      const ids = [...new Set(reqs.map((r: any) => String(r.parentId)))];
      filter = { _id: { $in: ids }, role: 'parent' };
      break;
    }
    case 'inactive_users': {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      filter = { updatedAt: { $lt: since }, isActive: { $ne: false } };
      break;
    }
    case 'custom_segment': {
      if (customSegment) {
        if (customSegment.roles?.length) filter.role = { $in: customSegment.roles };
        if (customSegment.registeredAfter)  filter.createdAt = { $gte: customSegment.registeredAfter };
        if (customSegment.registeredBefore) {
          filter.createdAt = { ...(filter.createdAt || {}), $lte: customSegment.registeredBefore };
        }
      }
      filter.isActive = { $ne: false };
      break;
    }
    default:
      filter = {};
  }

  const users = await User.find(filter).select('_id').lean();
  return users.map((u: any) => u._id as mongoose.Types.ObjectId);
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/campaigns
// ─────────────────────────────────────────────────────────────────────────────
export const listCampaigns = async (req: AuthRequest, res: Response) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit  = Math.min(50, parseInt(req.query.limit as string) || 20);
    const skip   = (page - 1) * limit;
    const status = req.query.status as string | undefined;
    const type   = req.query.type   as string | undefined;

    const filter: Record<string, any> = {};
    if (status) filter.status = status;
    if (type)   filter.campaignType = type;

    const [campaigns, total] = await Promise.all([
      NotificationCampaign.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'name email')
        .lean(),
      NotificationCampaign.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        campaigns,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error('listCampaigns error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch campaigns.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/campaigns
// ─────────────────────────────────────────────────────────────────────────────
export const createCampaign = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Auth required.' });

    const {
      title, message, imageUrl, deepLinkScreen, deepLinkParams,
      campaignType, targetAudience, customSegment, scheduledAt,
    } = req.body;

    if (!title || !message || !targetAudience) {
      return res.status(400).json({ success: false, message: 'title, message, and targetAudience are required.' });
    }

    const status: CampaignStatus = scheduledAt ? 'scheduled' : 'draft';

    const campaign = await NotificationCampaign.create({
      title,
      message,
      imageUrl,
      deepLinkScreen,
      deepLinkParams,
      campaignType:   campaignType || 'broadcast',
      targetAudience,
      customSegment,
      status,
      scheduledAt:    scheduledAt ? new Date(scheduledAt) : undefined,
      createdBy:      req.user._id,
    });

    if (__DEV_LOG__) console.log('[Campaign] Created:', campaign.campaignId);

    return res.status(201).json({ success: true, data: campaign });
  } catch (error) {
    console.error('createCampaign error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create campaign.' });
  }
};

// Tiny dev-log helper — compiles away in production environments
const __DEV_LOG__ = process.env.NODE_ENV !== 'production';

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/admin/campaigns/:id
// ─────────────────────────────────────────────────────────────────────────────
export const updateCampaign = async (req: AuthRequest, res: Response) => {
  try {
    const campaign = await NotificationCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found.' });

    if (['sending', 'sent'].includes(campaign.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit a campaign that is already sending or sent.',
      });
    }

    const allowed = [
      'title', 'message', 'imageUrl', 'deepLinkScreen', 'deepLinkParams',
      'campaignType', 'targetAudience', 'customSegment', 'scheduledAt',
    ];
    allowed.forEach((key) => {
      if (req.body[key] !== undefined) (campaign as any)[key] = req.body[key];
    });

    if (req.body.scheduledAt && campaign.status === 'draft') {
      campaign.status = 'scheduled';
    }

    await campaign.save();
    return res.status(200).json({ success: true, data: campaign });
  } catch (error) {
    console.error('updateCampaign error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update campaign.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/admin/campaigns/:id
// ─────────────────────────────────────────────────────────────────────────────
export const deleteCampaign = async (req: AuthRequest, res: Response) => {
  try {
    const campaign = await NotificationCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found.' });

    if (['sending', 'sent'].includes(campaign.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a sent or sending campaign.',
      });
    }

    await campaign.deleteOne();
    return res.status(200).json({ success: true, message: 'Campaign deleted.' });
  } catch (error) {
    console.error('deleteCampaign error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete campaign.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/campaigns/:id/send
// Sends the campaign immediately — creates Notification docs for all targets
// ─────────────────────────────────────────────────────────────────────────────
export const sendCampaign = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Auth required.' });

    const campaign = await NotificationCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found.' });

    if (['sending', 'sent', 'cancelled'].includes(campaign.status)) {
      return res.status(400).json({
        success: false,
        message: `Campaign is already in status: ${campaign.status}.`,
      });
    }

    // Mark as sending
    campaign.status = 'sending';
    await campaign.save();

    // Resolve target users
    const userIds = await resolveAudienceUserIds(campaign.targetAudience, campaign.customSegment);
    const totalTargeted = userIds.length;

    if (totalTargeted === 0) {
      campaign.status = 'sent';
      campaign.sentAt = new Date();
      campaign.deliveryStats.totalTargeted = 0;
      campaign.deliveryStats.sent = 0;
      await campaign.save();
      return res.status(200).json({ success: true, data: campaign, message: 'No users matched the target audience.' });
    }

    // Build notification docs in batches of 500
    const BATCH = 500;
    const notifDocs: any[] = [];
    const notifIds: mongoose.Types.ObjectId[] = [];

    for (const uid of userIds) {
      notifDocs.push({
        userId:     uid,
        type:       'CAMPAIGN_BROADCAST' as const,
        category:   campaign.campaignType === 'promotional' ? 'promotions' : 'system',
        title:      campaign.title,
        body:       campaign.message,
        data: {
          campaignId:      campaign.campaignId,
          screen:          campaign.deepLinkScreen,
          ...(campaign.deepLinkParams || {}),
        },
        isRead: false,
      });
    }

    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < notifDocs.length; i += BATCH) {
      try {
        const batch  = notifDocs.slice(i, i + BATCH);
        const result = await Notification.insertMany(batch, { ordered: false });
        result.forEach((doc) => notifIds.push(doc._id as mongoose.Types.ObjectId));
        sentCount += result.length;
      } catch (err: any) {
        // insertMany partial failure
        const inserted = (err?.insertedDocs || []).length;
        sentCount   += inserted;
        failedCount += BATCH - inserted;
        console.error('[Campaign] Batch insert partial failure:', err?.message);
      }
    }

    // Update campaign stats
    campaign.status           = 'sent';
    campaign.sentAt           = new Date();
    campaign.notificationIds  = notifIds;
    campaign.deliveryStats    = {
      totalTargeted,
      sent:      sentCount,
      delivered: sentCount,  // Optimistic: all in-app delivered
      opened:    0,
      clicked:   0,
      failed:    failedCount,
      openRate:  0,
      ctr:       0,
    };
    await campaign.save();

    if (__DEV_LOG__) {
      console.log(`[Campaign] ${campaign.campaignId} sent to ${sentCount}/${totalTargeted} users`);
    }

    return res.status(200).json({ success: true, data: campaign });
  } catch (error) {
    // Roll back to draft on unexpected error
    try {
      await NotificationCampaign.findByIdAndUpdate(req.params.id, { status: 'failed' });
    } catch (_) {}
    console.error('sendCampaign error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send campaign.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/campaigns/:id/cancel
// ─────────────────────────────────────────────────────────────────────────────
export const cancelCampaign = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Auth required.' });

    const campaign = await NotificationCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found.' });

    if (['sent', 'cancelled'].includes(campaign.status)) {
      return res.status(400).json({
        success: false,
        message: `Campaign cannot be cancelled from status: ${campaign.status}.`,
      });
    }

    campaign.status       = 'cancelled';
    campaign.cancelledBy  = req.user._id as mongoose.Types.ObjectId;
    campaign.cancelReason = req.body.reason || 'Cancelled by admin';
    await campaign.save();

    return res.status(200).json({ success: true, data: campaign });
  } catch (error) {
    console.error('cancelCampaign error:', error);
    return res.status(500).json({ success: false, message: 'Failed to cancel campaign.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/campaigns/:id/stats
// Returns delivery analytics with open/click rates
// ─────────────────────────────────────────────────────────────────────────────
export const getCampaignStats = async (req: AuthRequest, res: Response) => {
  try {
    const campaign = await NotificationCampaign.findById(req.params.id)
      .populate('createdBy', 'name email')
      .lean();
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found.' });

    // Live read count from Notification docs for accuracy
    let openCount = 0;
    if (campaign.notificationIds?.length) {
      openCount = await Notification.countDocuments({
        _id:    { $in: campaign.notificationIds },
        isRead: true,
      });
    }

    const stats = { ...campaign.deliveryStats };
    if (stats.sent > 0) {
      stats.opened   = openCount;
      stats.openRate = parseFloat(((openCount / stats.sent) * 100).toFixed(1));
    }

    // Daily open trend (last 7 days if sent within that window)
    let dailyTrend: { date: string; opened: number }[] = [];
    if (campaign.sentAt && campaign.notificationIds?.length) {
      const since = new Date(campaign.sentAt);
      const trend = await Notification.aggregate([
        { $match: { _id: { $in: campaign.notificationIds }, isRead: true, readAt: { $gte: since } } },
        {
          $group: {
            _id:   { $dateToString: { format: '%Y-%m-%d', date: '$readAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: 14 },
      ]);
      dailyTrend = trend.map((t) => ({ date: t._id, opened: t.count }));
    }

    return res.status(200).json({
      success: true,
      data: {
        campaign,
        stats,
        dailyTrend,
      },
    });
  } catch (error) {
    console.error('getCampaignStats error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch campaign stats.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/campaigns/:id/duplicate
// Clones an existing campaign as a new draft
// ─────────────────────────────────────────────────────────────────────────────
export const duplicateCampaign = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Auth required.' });

    const original = await NotificationCampaign.findById(req.params.id).lean();
    if (!original) return res.status(404).json({ success: false, message: 'Campaign not found.' });

    const copy = await NotificationCampaign.create({
      title:           `${original.title} (Copy)`,
      message:         original.message,
      imageUrl:        original.imageUrl,
      deepLinkScreen:  original.deepLinkScreen,
      deepLinkParams:  original.deepLinkParams,
      campaignType:    original.campaignType,
      targetAudience:  original.targetAudience,
      customSegment:   original.customSegment,
      status:          'draft',
      createdBy:       req.user._id,
    });

    return res.status(201).json({ success: true, data: copy });
  } catch (error) {
    console.error('duplicateCampaign error:', error);
    return res.status(500).json({ success: false, message: 'Failed to duplicate campaign.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/campaigns/summary
// Overview stats for the campaigns dashboard header
// ─────────────────────────────────────────────────────────────────────────────
export const getCampaignsSummary = async (_req: AuthRequest, res: Response) => {
  try {
    const [statusCounts, typeCounts, recentAgg] = await Promise.all([
      NotificationCampaign.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      NotificationCampaign.aggregate([
        { $group: { _id: '$campaignType', count: { $sum: 1 } } },
      ]),
      NotificationCampaign.aggregate([
        { $match: { status: 'sent' } },
        {
          $group: {
            _id:            null,
            totalSent:      { $sum: '$deliveryStats.sent' },
            totalDelivered: { $sum: '$deliveryStats.delivered' },
            totalOpened:    { $sum: '$deliveryStats.opened' },
            totalFailed:    { $sum: '$deliveryStats.failed' },
          },
        },
      ]),
    ]);

    const byStatus: Record<string, number> = {};
    statusCounts.forEach((s) => { byStatus[s._id] = s.count; });

    const byType: Record<string, number> = {};
    typeCounts.forEach((t) => { byType[t._id] = t.count; });

    const agg = recentAgg[0] || { totalSent: 0, totalDelivered: 0, totalOpened: 0, totalFailed: 0 };
    const overallOpenRate = agg.totalSent > 0
      ? parseFloat(((agg.totalOpened / agg.totalSent) * 100).toFixed(1))
      : 0;

    return res.status(200).json({
      success: true,
      data: {
        byStatus,
        byType,
        totals: { ...agg, overallOpenRate },
        total: await NotificationCampaign.countDocuments(),
      },
    });
  } catch (error) {
    console.error('getCampaignsSummary error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch summary.' });
  }
};
