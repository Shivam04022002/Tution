import mongoose, { Document } from 'mongoose';
export interface ITutorApplication extends Document {
    parentRequirementId: mongoose.Types.ObjectId;
    teacherId: mongoose.Types.ObjectId;
    teacherProfileId: mongoose.Types.ObjectId;
    parentId: mongoose.Types.ObjectId;
    applicationId: string;
    status: 'pending' | 'shortlisted' | 'rejected' | 'accepted' | 'withdrawn';
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
    acceptedAt?: Date;
    rejectionReason?: string;
    demoScheduled: boolean;
    demoId?: mongoose.Types.ObjectId;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
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