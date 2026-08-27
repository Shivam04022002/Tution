import mongoose, { Document, Schema } from 'mongoose';

export type DevicePlatform = 'android' | 'ios' | 'web';

/**
 * FCM registration token for one physical device belonging to one user.
 *
 * A user may have several active devices, so tokens live in their own
 * collection rather than an array on User. The token itself is unique across
 * the whole collection: when a device is handed to a different user, FCM
 * re-issues the same token string, and the re-registration must move it to the
 * new owner rather than deliver that user's notifications to the old one.
 */
export interface IDeviceToken extends Document {
  userId: mongoose.Types.ObjectId;
  token: string;
  platform: DevicePlatform;
  deviceId?: string;
  appVersion?: string;
  isActive: boolean;
  lastSeenAt: Date;
  /** Why the token stopped being used — set when FCM rejects it. */
  deactivatedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DeviceTokenSchema = new Schema<IDeviceToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    token: { type: String, required: true, unique: true },

    platform: {
      type: String,
      enum: ['android', 'ios', 'web'],
      required: true,
      default: 'android',
    },

    deviceId: { type: String },
    appVersion: { type: String },

    isActive: { type: Boolean, default: true },
    lastSeenAt: { type: Date, default: Date.now },
    deactivatedReason: { type: String },
  },
  { timestamps: true },
);

// Primary lookup: every active token for a recipient.
DeviceTokenSchema.index({ userId: 1, isActive: 1 });

export const DeviceToken = mongoose.model<IDeviceToken>('DeviceToken', DeviceTokenSchema);
