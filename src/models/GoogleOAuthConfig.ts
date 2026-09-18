import mongoose, { Document, Schema } from 'mongoose';

// ─────────────────────────────────────────────────────────────────────────────
// Singleton document — holds the platform's Google Sign-In credentials,
// admin-managed so they can be rotated from the admin panel without a
// redeploy. Three client IDs are needed because Google issues a separate
// OAuth client per surface:
//   - webClientId    → the one the backend actually verifies id_tokens
//                       against (audience), and the one the mobile app also
//                       passes as `webClientId` to the native Google Sign-In
//                       SDK so it requests a token in that audience.
//   - androidClientId → registered against the app's package name + signing
//                       certificate SHA-1 in Google Cloud Console. Not read
//                       by any code path here — Google Play Services matches
//                       it automatically at sign-in time — stored only so
//                       admins have a single place to see/document it.
//   - iosClientId     → passed to the native SDK's `iosClientId` config on
//                       iOS; without it Google Sign-In cannot initialize on
//                       that platform.
// ─────────────────────────────────────────────────────────────────────────────
export interface IGoogleOAuthConfig extends Document {
  isActive: boolean;
  webClientId: string;
  webClientSecretEncrypted: string;
  androidClientId: string;
  iosClientId: string;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const GoogleOAuthConfigSchema = new Schema<IGoogleOAuthConfig>(
  {
    isActive: { type: Boolean, default: false },
    webClientId: { type: String, default: '', trim: true },
    webClientSecretEncrypted: { type: String, default: '' },
    androidClientId: { type: String, default: '', trim: true },
    iosClientId: { type: String, default: '', trim: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const GoogleOAuthConfig = mongoose.model<IGoogleOAuthConfig>('GoogleOAuthConfig', GoogleOAuthConfigSchema);
