import mongoose, { Schema, Document } from 'mongoose';

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketCategory =
  | 'payment_issue'
  | 'refund_request'
  | 'tutor_issue'
  | 'teacher_issue'
  | 'technical_issue'
  | 'account_issue'
  | 'lead_unlock_issue'
  | 'profile_verification'
  | 'application_issue'
  | 'other';

export interface TicketMessage {
  _id?: mongoose.Types.ObjectId;
  sender: 'user' | 'admin' | 'staff';
  senderId: mongoose.Types.ObjectId;
  senderName: string;
  message: string;
  createdAt: Date;
}

export interface ITicket extends Document {
  _id: mongoose.Types.ObjectId;
  ticketId: string;
  userId: mongoose.Types.ObjectId;
  userName: string;
  userEmail: string;
  userPhone?: string;
  userRole: 'parent' | 'teacher' | 'admin' | 'staff';
  category: TicketCategory;
  priority: TicketPriority;
  subject: string;
  description: string;
  status: TicketStatus;
  assignedTo?: mongoose.Types.ObjectId;
  assignedToName?: string;
  messages: TicketMessage[];
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  closedAt?: Date;
}

const TicketMessageSchema = new Schema<TicketMessage>({
  sender: { type: String, enum: ['user', 'admin', 'staff'], required: true },
  senderId: { type: Schema.Types.ObjectId, required: true },
  senderName: { type: String, required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

const TicketSchema = new Schema<ITicket>(
  {
    ticketId: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userName: { type: String, required: true },
    userEmail: { type: String, required: true },
    userPhone: { type: String },
    userRole: { type: String, enum: ['parent', 'teacher', 'admin', 'staff'], required: true },
    category: {
      type: String,
      enum: [
        'payment_issue',
        'refund_request',
        'tutor_issue',
        'teacher_issue',
        'technical_issue',
        'account_issue',
        'lead_unlock_issue',
        'profile_verification',
        'application_issue',
        'other',
      ],
      required: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    subject: { type: String, required: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 2000 },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved', 'closed'],
      default: 'open',
      index: true,
    },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    assignedToName: { type: String },
    messages: { type: [TicketMessageSchema], default: [] },
    resolvedAt: { type: Date },
    closedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound indexes for common queries
TicketSchema.index({ userId: 1, status: 1, createdAt: -1 });
TicketSchema.index({ status: 1, createdAt: -1 });
TicketSchema.index({ assignedTo: 1, status: 1 });
TicketSchema.index({ category: 1, status: 1 });
TicketSchema.index({ priority: 1, createdAt: -1 });

// Generate ticket ID (TKT-XXXX format)
let ticketCounter = 1000;
TicketSchema.pre('save', async function (next: any) {
  if (!this.ticketId) {
    const count = await mongoose.model('Ticket').countDocuments();
    this.ticketId = `TKT-${1001 + count}`;
  }
  next();
});

export default mongoose.model<ITicket>('Ticket', TicketSchema);
