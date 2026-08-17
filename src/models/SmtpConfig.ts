import mongoose, { Document, Schema } from 'mongoose';

// ─────────────────────────────────────────────────────────────────────────────
// Singleton document — one row holds the platform's active SMTP configuration.
// ─────────────────────────────────────────────────────────────────────────────
export interface IMailService {
  key: string;    // stable identifier, e.g. 'otp_verification'
  label: string;  // display name, e.g. 'OTP Verification'
  enabled: boolean;
}

export interface ISmtpConfig extends Document {
  isActive: boolean;
  fromEmail: string;
  fromName: string;
  replyToEmail?: string;
  host: string;
  port: number;
  encryption: 'none' | 'SSL/TLS' | 'STARTTLS';
  authRequired: boolean;
  username: string;
  passwordEncrypted: string;
  services: IMailService[];
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Every mail-sending feature in the app should have exactly one entry here so
// admins can toggle it independently of the master isActive switch. Add new
// features to this list as they're built — DEFAULT_SERVICES seeds a fresh
// SmtpConfig doc, and any keys missing from an existing doc get backfilled on
// read (see smtpConfigController.getSmtpConfig).
export const DEFAULT_MAIL_SERVICES: IMailService[] = [
  { key: 'otp_verification', label: 'OTP Verification', enabled: false },
];

const MailServiceSchema = new Schema<IMailService>(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    enabled: { type: Boolean, default: false },
  },
  { _id: false }
);

const SmtpConfigSchema = new Schema<ISmtpConfig>(
  {
    isActive: { type: Boolean, default: false },
    fromEmail: { type: String, required: true, trim: true, lowercase: true },
    fromName: { type: String, required: true, trim: true },
    replyToEmail: { type: String, trim: true, lowercase: true, default: '' },
    host: { type: String, required: true, trim: true },
    port: { type: Number, required: true, default: 587 },
    encryption: { type: String, enum: ['none', 'SSL/TLS', 'STARTTLS'], default: 'STARTTLS' },
    authRequired: { type: Boolean, default: true },
    username: { type: String, trim: true, default: '' },
    passwordEncrypted: { type: String, default: '' },
    services: { type: [MailServiceSchema], default: DEFAULT_MAIL_SERVICES },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const SmtpConfig = mongoose.model<ISmtpConfig>('SmtpConfig', SmtpConfigSchema);
