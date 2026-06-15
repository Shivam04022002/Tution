import mongoose, { Document } from 'mongoose';
export interface ITutorApplication extends Document {
    parentRequirementId: mongoose.Types.ObjectId;
    teacherId: mongoose.Types.ObjectId;
    teacherProfileId: mongoose.Types.ObjectId;
    parentId: mongoose.Types.ObjectId;
    applicationId: string;
    status: 'pending' | 'viewed' | 'shortlisted' | 'rejected' | 'demo_scheduled' | 'demo_completed' | 'selected' | 'hired' | 'withdrawn';
    message?: string;
    proposedFee?: number;
    proposedSchedule?: {
        daysPerWeek: string;
        preferredTimeSlots: string[];
    };
    viewedByParent: boolean;
    viewedAt?: Date;
    shortlistedAt?: Date;
    rejectedAt?: Date;
    selectedAt?: Date;
    hiredAt?: Date;
    rejectionReason?: string;
    selectionReason?: string;
    hireNotes?: string;
    demoScheduled: boolean;
    demoId?: mongoose.Types.ObjectId;
    demoCompletedAt?: Date;
    demoOutcome?: 'interested' | 'not_interested' | 'need_follow_up';
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    markAsViewed(): Promise<ITutorApplication>;
    markAsShortlisted(): Promise<ITutorApplication>;
    markAsRejected(reason?: string): Promise<ITutorApplication>;
    markAsDemoScheduled(demoId: mongoose.Types.ObjectId): Promise<ITutorApplication>;
    markAsDemoCompleted(outcome: 'interested' | 'not_interested' | 'need_follow_up'): Promise<ITutorApplication>;
    markAsSelected(reason?: string): Promise<ITutorApplication>;
    markAsHired(notes?: string): Promise<ITutorApplication>;
}
export declare const TutorApplication: mongoose.Model<ITutorApplication, {}, {}, {}, mongoose.Document<unknown, {}, ITutorApplication, {}, mongoose.DefaultSchemaOptions> & ITutorApplication & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, ITutorApplication>;
export default TutorApplication;
//# sourceMappingURL=TutorApplication.d.ts.map