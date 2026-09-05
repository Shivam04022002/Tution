import mongoose, { Document, Schema } from 'mongoose';

// ─────────────────────────────────────────────────────────────────────────────
// Singleton document — one row holds the platform's active AWS S3 credentials
// used for course lesson video storage. See src/config/awsConfig.ts, which
// hydrates its in-memory config from this document (falling back to the
// AWS_* env vars when no active document is saved).
// ─────────────────────────────────────────────────────────────────────────────
export interface IAwsS3Config extends Document {
  isActive: boolean;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKeyEncrypted: string;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AwsS3ConfigSchema = new Schema<IAwsS3Config>(
  {
    isActive: { type: Boolean, default: false },
    region: { type: String, trim: true, default: 'ap-south-1' },
    bucket: { type: String, trim: true, default: '' },
    accessKeyId: { type: String, trim: true, default: '' },
    secretAccessKeyEncrypted: { type: String, default: '' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const AwsS3Config = mongoose.model<IAwsS3Config>('AwsS3Config', AwsS3ConfigSchema);
