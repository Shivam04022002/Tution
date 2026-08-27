import mongoose from 'mongoose';
import { DeviceToken, DevicePlatform } from '../models/DeviceToken';
import { getMessaging, isFirebaseReady } from '../config/firebase';

/**
 * FCM delivery layer.
 *
 * Nothing here is allowed to throw into a caller: a push failure must never
 * roll back the business operation that produced the notification. Every entry
 * point resolves to a result object instead.
 */

/** FCM error codes that mean the token will never work again. */
const PERMANENTLY_INVALID_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
  'messaging/invalid-argument',
]);

export interface PushPayload {
  notificationId: string;
  type: string;
  title: string;
  body: string;
  screen?: string;
  entityType?: string;
  entityId?: string;
}

export interface PushResult {
  attempted: number;
  sent: number;
  failed: number;
  deactivated: number;
  skippedReason?: 'firebase-not-configured' | 'no-active-tokens';
}

export interface RegisterTokenInput {
  userId: mongoose.Types.ObjectId | string;
  token: string;
  platform?: DevicePlatform;
  deviceId?: string;
  appVersion?: string;
}

/**
 * Register or refresh a device token for a user.
 *
 * Upserts on the token itself so that a refreshed token belonging to the same
 * device updates in place, and a token that has moved to a different user is
 * reassigned rather than duplicated.
 */
export const registerDeviceToken = async (input: RegisterTokenInput) => {
  const token = String(input.token ?? '').trim();

  if (!token || token.length < 20) {
    throw new Error('A valid FCM registration token is required');
  }

  return DeviceToken.findOneAndUpdate(
    { token },
    {
      $set: {
        userId: input.userId,
        token,
        platform: input.platform ?? 'android',
        deviceId: input.deviceId,
        appVersion: input.appVersion,
        isActive: true,
        lastSeenAt: new Date(),
      },
      $unset: { deactivatedReason: '' },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
};

/**
 * Deactivate a token on logout. Scoped to the owning user so one account can
 * never disable another account's device.
 */
export const deactivateDeviceToken = async (
  userId: mongoose.Types.ObjectId | string,
  token: string,
): Promise<boolean> => {
  const result = await DeviceToken.findOneAndUpdate(
    { token, userId },
    { $set: { isActive: false, deactivatedReason: 'signed-out' } },
  );
  return Boolean(result);
};

export const getActiveTokensForUser = async (
  userId: mongoose.Types.ObjectId | string,
): Promise<string[]> => {
  const rows = await DeviceToken.find({ userId, isActive: true }).select('token').lean();
  return rows.map((r) => r.token);
};

/**
 * FCM data messages must be a flat map of strings.
 * The record in MongoDB is the source of truth, so only the identifiers needed
 * for routing travel in the payload — never private profile data.
 */
const buildDataPayload = (payload: PushPayload): Record<string, string> => {
  const data: Record<string, string> = {
    notificationId: payload.notificationId,
    type: payload.type,
  };

  if (payload.screen) data.screen = payload.screen;
  if (payload.entityType) data.entityType = payload.entityType;
  if (payload.entityId) data.entityId = payload.entityId;

  return data;
};

/**
 * Send one notification to every active device of one user.
 * Tokens that FCM reports as permanently invalid are deactivated so they are
 * never retried.
 */
export const sendPushToUser = async (
  userId: mongoose.Types.ObjectId | string,
  payload: PushPayload,
): Promise<PushResult> => {
  const empty: PushResult = { attempted: 0, sent: 0, failed: 0, deactivated: 0 };

  try {
    const messaging = getMessaging();
    if (!messaging) {
      return { ...empty, skippedReason: 'firebase-not-configured' };
    }

    const tokens = await getActiveTokensForUser(userId);
    if (tokens.length === 0) {
      return { ...empty, skippedReason: 'no-active-tokens' };
    }

    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: { title: payload.title, body: payload.body },
      data: buildDataPayload(payload),
      android: {
        priority: 'high',
        notification: {
          channelId: 'default',
          sound: 'default',
        },
      },
    });

    const invalidTokens: string[] = [];

    response.responses.forEach((res, index) => {
      if (res.success) return;

      const code = (res.error as any)?.code;
      if (code && PERMANENTLY_INVALID_CODES.has(code)) {
        invalidTokens.push(tokens[index]);
      } else {
        // Transient (quota, unavailable) — keep the token, log the code only.
        console.warn(`[Push] Transient FCM failure for user ${String(userId)}: ${code ?? 'unknown'}`);
      }
    });

    let deactivated = 0;
    if (invalidTokens.length > 0) {
      const result = await DeviceToken.updateMany(
        { token: { $in: invalidTokens } },
        { $set: { isActive: false, deactivatedReason: 'fcm-token-invalid' } },
      );
      deactivated = result.modifiedCount ?? 0;
    }

    return {
      attempted: tokens.length,
      sent: response.successCount,
      failed: response.failureCount,
      deactivated,
    };
  } catch (error: any) {
    // Never surface FCM credentials or the underlying error object.
    console.error(`[Push] Send failed for user ${String(userId)}: ${error?.code ?? error?.message ?? 'unknown error'}`);
    return { ...empty, failed: 1 };
  }
};

/** Fan out to several recipients, each with their own delivery result. */
export const sendPushToUsers = async (
  userIds: (mongoose.Types.ObjectId | string)[],
  payloadFor: (userId: string) => PushPayload,
): Promise<PushResult> => {
  const totals: PushResult = { attempted: 0, sent: 0, failed: 0, deactivated: 0 };

  for (const userId of userIds) {
    const result = await sendPushToUser(userId, payloadFor(String(userId)));
    totals.attempted += result.attempted;
    totals.sent += result.sent;
    totals.failed += result.failed;
    totals.deactivated += result.deactivated;
  }

  return totals;
};

export const isPushEnabled = (): boolean => isFirebaseReady();
