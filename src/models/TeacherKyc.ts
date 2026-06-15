import mongoose, { Schema, Document } from 'mongoose';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export type KycStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'reupload_required';

export type KycDocumentType =
  | 'PAN_CARD'
  | 'AADHAAR_FRONT'
  | 'AADHAAR_BACK'
  | 'BANK_PROOF'
  | 'ADDRESS_PROOF'
  | 'SELFIE_PHOTO';

export type KycDocumentStatus = 'pending' | 'verified' | 'rejected' | 'reupload_required';

export interface IKycDocument {
  _id: mongoose.Types.ObjectId;
  documentType: KycDocumentType;
  documentUrl: string;
  cloudinaryPublicId: string;
  verificationStatus: KycDocumentStatus;
  uploadedAt: Date;
  verifiedAt?: Date;
  notes?: string;
}

export interface ITeacherKyc extends Document {
  teacherId: mongoose.Types.ObjectId;
  kycId: string;
  status: KycStatus;
  documents: IKycDocument[];
  verificationNotes?: string;
  submittedAt?: Date;
  reviewedAt?: Date;
  reviewedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────
const KycDocumentSchema = new Schema<IKycDocument>(
  {
    documentType: {
      type: String,
      required: true,
      enum: ['PAN_CARD', 'AADHAAR_FRONT', 'AADHAAR_BACK', 'BANK_PROOF', 'ADDRESS_PROOF', 'SELFIE_PHOTO'],
    },
    documentUrl: { type: String, required: true },
    cloudinaryPublicId: { type: String, required: true },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected', 'reupload_required'],
      default: 'pending',
    },
    uploadedAt: { type: Date, default: Date.now },
    verifiedAt: { type: Date },
    notes: { type: String },
  },
  { _id: true },
);

const TeacherKycSchema = new Schema<ITeacherKyc>(
  {
    teacherId: { type: Schema.Types.ObjectId, ref: 'TeacherProfile', required: true, index: true },
    kycId: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'reupload_required'],
      default: 'draft',
    },
    documents: [KycDocumentSchema],
    verificationNotes: { type: String },
    submittedAt: { type: Date },
    reviewedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    rejectedAt: { type: Date },
    rejectionReason: { type: String },
  },
  { timestamps: true },
);

// Compound indexes
TeacherKycSchema.index({ status: 1, submittedAt: -1 });
TeacherKycSchema.index({ teacherId: 1, status: 1 });

// Auto-generate kycId
TeacherKycSchema.pre('save', function () {
  if (!this.kycId) {
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.kycId = `KYC-${random}`;
  }
});

export const TeacherKyc = mongoose.model<ITeacherKyc>('TeacherKyc', TeacherKycSchema);
