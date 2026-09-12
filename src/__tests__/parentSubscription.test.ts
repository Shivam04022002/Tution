import mongoose from 'mongoose';
import { User } from '../models/User';
import { ParentSubscription } from '../models/ParentSubscription';
import { ParentSubscriptionPlan } from '../models/ParentSubscriptionPlan';
import { hasActiveSubscription } from '../services/parentSubscriptionService';
import { createContactRequest, createDemoRequest } from '../controllers/contactController';
import { startTestDatabase, stopTestDatabase, clearCollections } from './helpers/geoTestUtils';

/**
 * Covers the subscription-gate on parent → tutor contact:
 *   1. hasActiveSubscription() — the single source of truth, checked directly
 *   2. createContactRequest / createDemoRequest — the 403 enforcement itself
 *
 * Validity is computed dynamically from status + date range on every call, so
 * these tests deliberately include a stale "active" document past its
 * endDate to prove there is no dependency on a cron job to expire it.
 */

beforeAll(startTestDatabase);
afterAll(stopTestDatabase);
afterEach(clearCollections);

const makeParent = async (overrides: Partial<{ email: string; phoneNumber: string }> = {}) =>
  User.create({
    email: overrides.email ?? `parent-${Date.now()}-${Math.random()}@test.com`,
    phoneNumber: overrides.phoneNumber ?? `9${Math.floor(100000000 + Math.random() * 899999999)}`,
    role: 'parent',
    profile: { firstName: 'Test', lastName: 'Parent' },
  });

const makePlan = async () =>
  ParentSubscriptionPlan.create({
    planId: 'plan_parent_monthly',
    name: 'monthly',
    displayName: 'Monthly Access',
    description: 'test plan',
    price: 199,
    durationDays: 30,
    contactLimit: -1,
    features: [],
    badge: 'Monthly',
    badgeColor: '#3B82F6',
    isActive: true,
  });

const makeSubscription = async (
  parentId: mongoose.Types.ObjectId,
  planId: mongoose.Types.ObjectId,
  overrides: Partial<{
    status: 'active' | 'expired' | 'cancelled' | 'pending' | 'inactive';
    startDate: Date;
    endDate: Date;
  }> = {}
) => {
  const now = new Date();
  const startDate = overrides.startDate ?? new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const endDate = overrides.endDate ?? new Date(now.getTime() + 29 * 24 * 60 * 60 * 1000);
  return ParentSubscription.create({
    subscriptionId: '',
    parentId,
    planId,
    planName: 'monthly',
    status: overrides.status ?? 'active',
    startDate,
    endDate,
    usage: { contactsUsed: 0, periodStart: startDate, periodEnd: endDate },
    history: [{ action: 'subscribed', toPlan: 'monthly', date: now }],
  });
};

// A mocked Express Response — matches the convention of calling the real
// controller function directly with a constructed req/res, as every other
// test in this suite does (no supertest anywhere in this repo).
const mockRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('hasActiveSubscription', () => {
  it('returns false when the parent has no subscription document at all', async () => {
    const parent = await makeParent();
    expect(await hasActiveSubscription(parent._id as mongoose.Types.ObjectId)).toBe(false);
  });

  it('returns true when status is active and now is within the date range', async () => {
    const parent = await makeParent();
    const plan = await makePlan();
    await makeSubscription(parent._id as mongoose.Types.ObjectId, plan._id as mongoose.Types.ObjectId);
    expect(await hasActiveSubscription(parent._id as mongoose.Types.ObjectId)).toBe(true);
  });

  it('returns false when status is active but endDate is in the past (no cron dependency)', async () => {
    const parent = await makeParent();
    const plan = await makePlan();
    const now = new Date();
    await makeSubscription(parent._id as mongoose.Types.ObjectId, plan._id as mongoose.Types.ObjectId, {
      status: 'active',
      startDate: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    });
    expect(await hasActiveSubscription(parent._id as mongoose.Types.ObjectId)).toBe(false);
  });

  it.each(['cancelled', 'pending', 'inactive', 'expired'] as const)(
    'returns false for status "%s" even when the date range would otherwise match',
    async (status) => {
      const parent = await makeParent();
      const plan = await makePlan();
      await makeSubscription(parent._id as mongoose.Types.ObjectId, plan._id as mongoose.Types.ObjectId, { status });
      expect(await hasActiveSubscription(parent._id as mongoose.Types.ObjectId)).toBe(false);
    }
  );

  it('does not leak one parent\'s active subscription to another parent', async () => {
    const parentA = await makeParent();
    const parentB = await makeParent();
    const plan = await makePlan();
    await makeSubscription(parentA._id as mongoose.Types.ObjectId, plan._id as mongoose.Types.ObjectId);

    expect(await hasActiveSubscription(parentA._id as mongoose.Types.ObjectId)).toBe(true);
    expect(await hasActiveSubscription(parentB._id as mongoose.Types.ObjectId)).toBe(false);
  });

  it('returns true when the parent has one expired and one active subscription', async () => {
    const parent = await makeParent();
    const plan = await makePlan();
    const now = new Date();
    await makeSubscription(parent._id as mongoose.Types.ObjectId, plan._id as mongoose.Types.ObjectId, {
      status: 'expired',
      startDate: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    });
    await makeSubscription(parent._id as mongoose.Types.ObjectId, plan._id as mongoose.Types.ObjectId);

    expect(await hasActiveSubscription(parent._id as mongoose.Types.ObjectId)).toBe(true);
  });
});

describe('contact endpoints — subscription gate', () => {
  it('createContactRequest: parent with no subscription is rejected with 403 SUBSCRIPTION_REQUIRED', async () => {
    const parent = await makeParent();
    const req: any = {
      user: { _id: parent._id, role: 'parent' },
      body: { teacherId: new mongoose.Types.ObjectId(), teacherProfileId: new mongoose.Types.ObjectId(), contactType: 'message' },
    };
    const res = mockRes();

    await createContactRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, code: 'SUBSCRIPTION_REQUIRED' })
    );
  });

  it('createDemoRequest: parent with no subscription is rejected with 403 SUBSCRIPTION_REQUIRED', async () => {
    const parent = await makeParent();
    const req: any = {
      user: { _id: parent._id, role: 'parent' },
      body: {
        teacherId: new mongoose.Types.ObjectId(),
        teacherProfileId: new mongoose.Types.ObjectId(),
        demoDate: '2026-01-01',
        demoTime: '10:00',
      },
    };
    const res = mockRes();

    await createDemoRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, code: 'SUBSCRIPTION_REQUIRED' })
    );
  });

  it('createContactRequest: parent WITH an active subscription is not blocked by the gate', async () => {
    const parent = await makeParent();
    const plan = await makePlan();
    await makeSubscription(parent._id as mongoose.Types.ObjectId, plan._id as mongoose.Types.ObjectId);

    const req: any = {
      user: { _id: parent._id, role: 'parent' },
      body: { teacherId: new mongoose.Types.ObjectId(), teacherProfileId: new mongoose.Types.ObjectId(), contactType: 'message' },
    };
    const res = mockRes();

    await createContactRequest(req, res);

    // The gate is skipped; execution reaches the next validation step (teacher
    // lookup, which 404s since no teacher fixture exists) — proving this is
    // NOT the subscription gate rejecting the request.
    expect(res.status).not.toHaveBeenCalledWith(403);
  });

  it('createContactRequest: admin role bypasses the gate even with no subscription', async () => {
    const admin = await User.create({
      email: `admin-${Date.now()}@test.com`,
      phoneNumber: `9${Math.floor(100000000 + Math.random() * 899999999)}`,
      role: 'admin',
      profile: { firstName: 'Test', lastName: 'Admin' },
    });

    const req: any = {
      user: { _id: admin._id, role: 'admin' },
      body: { teacherId: new mongoose.Types.ObjectId(), teacherProfileId: new mongoose.Types.ObjectId(), contactType: 'message' },
    };
    const res = mockRes();

    await createContactRequest(req, res);

    expect(res.status).not.toHaveBeenCalledWith(403);
  });
});

describe('ParentSubscriptionPlan seeding', () => {
  it('ensureParentPlansSeeded (via getParentPlans) seeds once and does not duplicate', async () => {
    const { getParentPlans } = await import('../controllers/parentSubscriptionController');
    const req: any = { user: null };

    const res1 = mockRes();
    await getParentPlans(req, res1);
    expect(await ParentSubscriptionPlan.countDocuments()).toBe(3);

    const res2 = mockRes();
    await getParentPlans(req, res2);
    expect(await ParentSubscriptionPlan.countDocuments()).toBe(3);
  });
});
