import mongoose from 'mongoose';
import { ParentSubscription } from '../models/ParentSubscription';

// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for parent contact-access checks. Validity is
// computed dynamically from status + date range on every call — a stale
// status: 'active' document past its endDate correctly evaluates to false,
// so there is no dependency on a scheduled job to flip expired subscriptions.
// ─────────────────────────────────────────────────────────────────────────────

export const hasActiveSubscription = async (
  parentId: string | mongoose.Types.ObjectId
): Promise<boolean> => {
  const now = new Date();
  const subscription = await ParentSubscription.findOne({
    parentId,
    status: 'active',
    startDate: { $lte: now },
    endDate: { $gte: now },
  }).lean();

  return !!subscription;
};

export const getActiveSubscription = async (parentId: string | mongoose.Types.ObjectId) => {
  const now = new Date();
  return ParentSubscription.findOne({
    parentId,
    status: 'active',
    startDate: { $lte: now },
    endDate: { $gte: now },
  })
    .populate('planId')
    .lean();
};
