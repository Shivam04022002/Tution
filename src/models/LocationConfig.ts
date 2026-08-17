import mongoose, { Document, Schema } from 'mongoose';

// ─────────────────────────────────────────────────────────────────────────────
// Singleton document — holds the platform's Google Maps API key, admin-toggled
// independently of whatever GOOGLE_MAPS_API_KEY is set in the server's .env.
// ─────────────────────────────────────────────────────────────────────────────
export interface ILocationConfig extends Document {
  isActive: boolean;
  apiKeyEncrypted: string;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LocationConfigSchema = new Schema<ILocationConfig>(
  {
    isActive: { type: Boolean, default: false },
    apiKeyEncrypted: { type: String, default: '' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const LocationConfig = mongoose.model<ILocationConfig>('LocationConfig', LocationConfigSchema);
