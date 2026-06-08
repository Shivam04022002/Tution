import mongoose, { Document, Schema } from 'mongoose';

export type ImportType = 'parents' | 'teachers';
export type ImportStatus = 'processing' | 'completed' | 'failed' | 'partial';

export interface IImportError {
  rowNumber: number;
  rowData?: Record<string, any>;
  errorMessage: string;
}

export interface IImportHistory extends Document {
  uploadedBy: mongoose.Types.ObjectId;
  fileName: string;
  importType: ImportType;
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  duplicates: number;
  status: ImportStatus;
  rowErrors: IImportError[];
  createdAt: Date;
}

const ImportErrorSchema = new Schema<IImportError>(
  {
    rowNumber: { type: Number, required: true },
    rowData: { type: Schema.Types.Mixed },
    errorMessage: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const ImportHistorySchema = new Schema<IImportHistory>(
  {
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    importType: {
      type: String,
      enum: ['parents', 'teachers'],
      required: true,
    },
    totalRows: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    successfulRows: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    failedRows: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    duplicates: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['processing', 'completed', 'failed', 'partial'],
      required: true,
      default: 'processing',
    },
    rowErrors: {
      type: [ImportErrorSchema],
      default: [],
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

ImportHistorySchema.index({ uploadedBy: 1, createdAt: -1 });
ImportHistorySchema.index({ importType: 1, createdAt: -1 });
ImportHistorySchema.index({ status: 1 });
ImportHistorySchema.index({ createdAt: -1 });

export const ImportHistory = mongoose.model<IImportHistory>('ImportHistory', ImportHistorySchema);
export default ImportHistory;
