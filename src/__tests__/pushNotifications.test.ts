import mongoose from 'mongoose';
import { DeviceToken } from '../models/DeviceToken';
import { Notification } from '../models/Notification';
import { startTestDatabase, stopTestDatabase, clearCollections } from './helpers/geoTestUtils';

// The messaging handle is the only thing we fake — everything below it (token
// storage, notification records, invalid-token cleanup) is the real code.
const sendEachForMulticast = jest.fn();

jest.mock('../config/firebase', () => ({
  getMessaging: () => (mockFirebaseReady ? { sendEachForMulticast } : null),
  isFirebaseReady: () => mockFirebaseReady,
}));

let mockFirebaseReady = true;

import {
  registerDeviceToken,
  deactivateDeviceToken,
  getActiveTokensForUser,
  sendPushToUser,
} from '../services/pushService';
import { sendNotification, sendNotificationToMany } from '../services/notificationService';

const USER_A = new mongoose.Types.ObjectId();
const USER_B = new mongoose.Types.ObjectId();

const TOKEN_A = 'fcm-token-device-a-0000000000000000';
const TOKEN_B = 'fcm-token-device-b-1111111111111111';

const okResponse = (count: number) => ({
  successCount: count,
  failureCount: 0,
  responses: Array.from({ length: count }, () => ({ success: true })),
});

beforeAll(startTestDatabase);
afterAll(stopTestDatabase);

beforeEach(() => {
  mockFirebaseReady = true;
  sendEachForMulticast.mockReset();
  sendEachForMulticast.mockResolvedValue(okResponse(1));
});

afterEach(clearCollections);

describe('device token registration', () => {
  it('registers a token for the authenticated user', async () => {
    await registerDeviceToken({ userId: USER_A, token: TOKEN_A, platform: 'android' });

    const stored = await DeviceToken.findOne({ token: TOKEN_A });
    expect(stored?.userId.toString()).toBe(USER_A.toString());
    expect(stored?.isActive).toBe(true);
    expect(stored?.platform).toBe('android');
  });

  it('updates in place when the same device re-registers, rather than duplicating', async () => {
    await registerDeviceToken({ userId: USER_A, token: TOKEN_A });
    const first = await DeviceToken.findOne({ token: TOKEN_A });

    await registerDeviceToken({ userId: USER_A, token: TOKEN_A, appVersion: '1.1.0' });

    expect(await DeviceToken.countDocuments({ token: TOKEN_A })).toBe(1);
    const second = await DeviceToken.findOne({ token: TOKEN_A });
    expect(second?._id.toString()).toBe(first?._id.toString());
    expect(second?.appVersion).toBe('1.1.0');
  });

  it('supports multiple devices for one user', async () => {
    await registerDeviceToken({ userId: USER_A, token: TOKEN_A });
    await registerDeviceToken({ userId: USER_A, token: TOKEN_B });

    expect(await getActiveTokensForUser(USER_A)).toEqual(
      expect.arrayContaining([TOKEN_A, TOKEN_B]),
    );
    expect(await getActiveTokensForUser(USER_A)).toHaveLength(2);
  });

  it('reassigns a token when the same device signs in as a different user', async () => {
    await registerDeviceToken({ userId: USER_A, token: TOKEN_A });
    await registerDeviceToken({ userId: USER_B, token: TOKEN_A });

    // The previous owner must stop receiving that device's notifications.
    expect(await getActiveTokensForUser(USER_A)).toEqual([]);
    expect(await getActiveTokensForUser(USER_B)).toEqual([TOKEN_A]);
    expect(await DeviceToken.countDocuments({ token: TOKEN_A })).toBe(1);
  });

  it('rejects an obviously invalid token', async () => {
    await expect(registerDeviceToken({ userId: USER_A, token: 'short' })).rejects.toThrow();
    await expect(registerDeviceToken({ userId: USER_A, token: '' })).rejects.toThrow();
  });

  it('deactivates a token on sign-out', async () => {
    await registerDeviceToken({ userId: USER_A, token: TOKEN_A });

    expect(await deactivateDeviceToken(USER_A, TOKEN_A)).toBe(true);
    expect(await getActiveTokensForUser(USER_A)).toEqual([]);
  });

  it('does not let one user deactivate another user\'s device', async () => {
    await registerDeviceToken({ userId: USER_A, token: TOKEN_A });

    expect(await deactivateDeviceToken(USER_B, TOKEN_A)).toBe(false);
    expect(await getActiveTokensForUser(USER_A)).toEqual([TOKEN_A]);
  });
});

describe('FCM delivery', () => {
  it('sends to every active device of the recipient', async () => {
    await registerDeviceToken({ userId: USER_A, token: TOKEN_A });
    await registerDeviceToken({ userId: USER_A, token: TOKEN_B });
    sendEachForMulticast.mockResolvedValue(okResponse(2));

    const result = await sendPushToUser(USER_A, {
      notificationId: 'n1',
      type: 'NEW_LEAD_MATCH',
      title: 'New Lead',
      body: 'A lead is available',
      screen: 'Leads',
    });

    expect(result.sent).toBe(2);
    const arg = sendEachForMulticast.mock.calls[0][0];
    expect(arg.tokens).toEqual(expect.arrayContaining([TOKEN_A, TOKEN_B]));
    expect(arg.notification).toEqual({ title: 'New Lead', body: 'A lead is available' });
  });

  it('carries only routing identifiers in the data payload', async () => {
    await registerDeviceToken({ userId: USER_A, token: TOKEN_A });

    await sendPushToUser(USER_A, {
      notificationId: 'n1',
      type: 'TEACHER_APPLIED',
      title: 'T',
      body: 'B',
      screen: 'Applications',
      entityType: 'TutorApplication',
      entityId: 'abc123',
    });

    const { data } = sendEachForMulticast.mock.calls[0][0];
    expect(Object.keys(data).sort()).toEqual(
      ['entityId', 'entityType', 'notificationId', 'screen', 'type'].sort(),
    );
    // Every FCM data value must be a string.
    Object.values(data).forEach((v) => expect(typeof v).toBe('string'));
  });

  it('deactivates tokens FCM reports as permanently invalid', async () => {
    await registerDeviceToken({ userId: USER_A, token: TOKEN_A });
    await registerDeviceToken({ userId: USER_A, token: TOKEN_B });

    sendEachForMulticast.mockResolvedValue({
      successCount: 1,
      failureCount: 1,
      responses: [
        { success: true },
        { success: false, error: { code: 'messaging/registration-token-not-registered' } },
      ],
    });

    const result = await sendPushToUser(USER_A, {
      notificationId: 'n1', type: 'SYSTEM', title: 'T', body: 'B',
    });

    expect(result.deactivated).toBe(1);

    const remaining = await getActiveTokensForUser(USER_A);
    expect(remaining).toEqual([TOKEN_A]);

    const dead = await DeviceToken.findOne({ token: TOKEN_B });
    expect(dead?.isActive).toBe(false);
    expect(dead?.deactivatedReason).toBe('fcm-token-invalid');
  });

  it('keeps the token when the failure is transient', async () => {
    await registerDeviceToken({ userId: USER_A, token: TOKEN_A });

    sendEachForMulticast.mockResolvedValue({
      successCount: 0,
      failureCount: 1,
      responses: [{ success: false, error: { code: 'messaging/server-unavailable' } }],
    });

    const result = await sendPushToUser(USER_A, {
      notificationId: 'n1', type: 'SYSTEM', title: 'T', body: 'B',
    });

    expect(result.deactivated).toBe(0);
    expect(await getActiveTokensForUser(USER_A)).toEqual([TOKEN_A]);
  });

  it('skips cleanly when Firebase is not configured', async () => {
    mockFirebaseReady = false;
    await registerDeviceToken({ userId: USER_A, token: TOKEN_A });

    const result = await sendPushToUser(USER_A, {
      notificationId: 'n1', type: 'SYSTEM', title: 'T', body: 'B',
    });

    expect(result.skippedReason).toBe('firebase-not-configured');
    expect(sendEachForMulticast).not.toHaveBeenCalled();
  });

  it('reports no-active-tokens instead of calling FCM', async () => {
    const result = await sendPushToUser(USER_A, {
      notificationId: 'n1', type: 'SYSTEM', title: 'T', body: 'B',
    });

    expect(result.skippedReason).toBe('no-active-tokens');
    expect(sendEachForMulticast).not.toHaveBeenCalled();
  });

  it('resolves rather than throwing when the FCM call itself fails', async () => {
    await registerDeviceToken({ userId: USER_A, token: TOKEN_A });
    sendEachForMulticast.mockRejectedValue(new Error('network down'));

    await expect(
      sendPushToUser(USER_A, { notificationId: 'n1', type: 'SYSTEM', title: 'T', body: 'B' }),
    ).resolves.toMatchObject({ failed: 1 });
  });
});

describe('notification record + push together', () => {
  it('persists the record and pushes it', async () => {
    await registerDeviceToken({ userId: USER_A, token: TOKEN_A });

    const doc = await sendNotification({
      userId: USER_A,
      type: 'NEW_LEAD_MATCH',
      category: 'lead',
      title: 'New Lead Available',
      body: 'A new Maths lead matches your profile.',
      data: { screen: 'Leads' },
    });

    expect(doc).toBeTruthy();
    expect(await Notification.countDocuments({ userId: USER_A })).toBe(1);
    expect(sendEachForMulticast).toHaveBeenCalledTimes(1);

    // The pushed id must point at the stored record.
    expect(sendEachForMulticast.mock.calls[0][0].data.notificationId).toBe(String(doc!._id));
  });

  it('still stores the notification when push delivery fails', async () => {
    await registerDeviceToken({ userId: USER_A, token: TOKEN_A });
    sendEachForMulticast.mockRejectedValue(new Error('FCM exploded'));

    const doc = await sendNotification({
      userId: USER_A,
      type: 'SYSTEM',
      category: 'system',
      title: 'Still saved',
      body: 'Push failed but the record survives.',
    });

    expect(doc).toBeTruthy();
    expect(await Notification.countDocuments({ userId: USER_A })).toBe(1);
  });

  it('gives every recipient their own record and their own push', async () => {
    await registerDeviceToken({ userId: USER_A, token: TOKEN_A });
    await registerDeviceToken({ userId: USER_B, token: TOKEN_B });

    await sendNotificationToMany([USER_A, USER_B], {
      type: 'CAMPAIGN_BROADCAST',
      category: 'system',
      title: 'Broadcast',
      body: 'To both users',
    });

    expect(await Notification.countDocuments({ userId: USER_A })).toBe(1);
    expect(await Notification.countDocuments({ userId: USER_B })).toBe(1);
    // One multicast call per recipient keeps read/unread state per user.
    expect(sendEachForMulticast).toHaveBeenCalledTimes(2);
  });

  it('keeps recipients isolated — a notification belongs to exactly one user', async () => {
    await sendNotification({
      userId: USER_A, type: 'SYSTEM', category: 'system', title: 'A only', body: 'x',
    });

    expect(await Notification.countDocuments({ userId: USER_B })).toBe(0);
  });
});

describe('read / unread state', () => {
  const seed = async () => {
    await sendNotification({ userId: USER_A, type: 'SYSTEM', category: 'system', title: '1', body: 'x' });
    await sendNotification({ userId: USER_A, type: 'SYSTEM', category: 'system', title: '2', body: 'x' });
    await sendNotification({ userId: USER_B, type: 'SYSTEM', category: 'system', title: '3', body: 'x' });
  };

  it('counts only the recipient\'s unread notifications', async () => {
    await seed();

    expect(await Notification.countDocuments({ userId: USER_A, isRead: false })).toBe(2);
    expect(await Notification.countDocuments({ userId: USER_B, isRead: false })).toBe(1);
  });

  it('marks one as read', async () => {
    await seed();
    const target = await Notification.findOne({ userId: USER_A });

    await Notification.updateOne(
      { _id: target!._id, userId: USER_A },
      { $set: { isRead: true, readAt: new Date() } },
    );

    expect(await Notification.countDocuments({ userId: USER_A, isRead: false })).toBe(1);
  });

  it('cannot mark another user\'s notification as read', async () => {
    await seed();
    const foreign = await Notification.findOne({ userId: USER_B });

    // Same filter shape the controller uses: always scoped by userId.
    const result = await Notification.updateOne(
      { _id: foreign!._id, userId: USER_A },
      { $set: { isRead: true } },
    );

    expect(result.matchedCount).toBe(0);
    expect((await Notification.findById(foreign!._id))!.isRead).toBe(false);
  });

  it('marks all as read for one user only', async () => {
    await seed();

    await Notification.updateMany(
      { userId: USER_A, isRead: false },
      { $set: { isRead: true, readAt: new Date() } },
    );

    expect(await Notification.countDocuments({ userId: USER_A, isRead: false })).toBe(0);
    expect(await Notification.countDocuments({ userId: USER_B, isRead: false })).toBe(1);
  });
});
