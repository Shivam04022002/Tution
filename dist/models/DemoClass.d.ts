import mongoose, { Document } from 'mongoose';
export interface IDemoClass extends Document {
    demoId: string;
    parentId: mongoose.Types.ObjectId;
    teacherId: mongoose.Types.ObjectId;
    teacherProfileId: mongoose.Types.ObjectId;
    requirementId: mongoose.Types.ObjectId;
    applicationId: mongoose.Types.ObjectId;
    studentDetails: {
        studentName: string;
        grade: string;
        subject: string;
    };
    scheduledDate: Date;
    scheduledTime: string;
    duration: number;
    mode: 'online' | 'offline';
    meetingDetails?: {
        platform: string;
        meetingLink?: string;
        meetingId?: string;
        password?: string;
        address?: string;
    };
    status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled' | 'no_show';
    previousDates?: Array<{
        date: Date;
        time: string;
        reason: string;
    }>;
    feedback?: {
        parentFeedback?: {
            rating: number;
            comment: string;
            isInterested: boolean;
            submittedAt: Date;
        };
        teacherFeedback?: {
            rating: number;
            comment: string;
            isInterested: boolean;
            submittedAt: Date;
        };
    };
    outcome?: 'interested' | 'not_interested' | 'pending';
    nextSteps?: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare const DemoClass: mongoose.Model<IDemoClass, {}, {}, {}, mongoose.Document<unknown, {}, IDemoClass, {}, mongoose.DefaultSchemaOptions> & IDemoClass & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IDemoClass>;
export default DemoClass;
//# sourceMappingURL=DemoClass.d.ts.map