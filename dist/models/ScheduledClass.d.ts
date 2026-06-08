import mongoose, { Document } from 'mongoose';
export interface IScheduledClass extends Document {
    classId: string;
    parentId: mongoose.Types.ObjectId;
    teacherId: mongoose.Types.ObjectId;
    teacherProfileId: mongoose.Types.ObjectId;
    studentId?: mongoose.Types.ObjectId;
    requirementId: mongoose.Types.ObjectId;
    applicationId: mongoose.Types.ObjectId;
    demoId?: mongoose.Types.ObjectId;
    subject: string;
    grade: string;
    schedule: {
        daysPerWeek: number;
        days: string[];
        timeSlot: string;
        startDate: Date;
        endDate?: Date;
    };
    fee: {
        amount: number;
        currency: string;
        billingCycle: 'hourly' | 'weekly' | 'monthly';
        paymentStatus: 'pending' | 'paid' | 'overdue';
        lastPaymentDate?: Date;
        nextPaymentDate?: Date;
    };
    mode: 'home' | 'online' | 'center';
    location?: {
        address: string;
        city: string;
        pincode: string;
        coordinates?: {
            latitude: number;
            longitude: number;
        };
    };
    meetingDetails?: {
        platform?: string;
        meetingLink?: string;
        meetingId?: string;
        password?: string;
    };
    status: 'active' | 'paused' | 'completed' | 'cancelled';
    progress: {
        totalClasses: number;
        completedClasses: number;
        upcomingClasses: number;
        lastClassDate?: Date;
        nextClassDate?: Date;
    };
    attendance: Array<{
        date: Date;
        status: 'present' | 'absent' | 'cancelled' | 'rescheduled';
        notes?: string;
    }>;
    performance?: {
        parentRating?: number;
        teacherRating?: number;
        parentReview?: string;
        teacherReview?: string;
    };
    cancellation?: {
        cancelledBy: 'parent' | 'teacher';
        cancelledAt: Date;
        reason: string;
        refundAmount?: number;
    };
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare const ScheduledClass: mongoose.Model<IScheduledClass, {}, {}, {}, mongoose.Document<unknown, {}, IScheduledClass, {}, mongoose.DefaultSchemaOptions> & IScheduledClass & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IScheduledClass>;
export default ScheduledClass;
//# sourceMappingURL=ScheduledClass.d.ts.map