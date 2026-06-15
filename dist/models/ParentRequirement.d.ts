import mongoose, { Document } from 'mongoose';
export interface IParentRequirement extends Document {
    parentId: mongoose.Types.ObjectId;
    requirementId: string;
    studentDetails: {
        studentName: string;
        age: number;
        grade: string;
        board: string;
        schoolName: string;
        genderPreference: 'any' | 'male' | 'female';
        multipleChildren: boolean;
        children?: Array<{
            name: string;
            age: number;
            grade: string;
            board: string;
            schoolName: string;
        }>;
    };
    subjects: string[];
    languagePreference: string[];
    tuitionType: 'home' | 'online' | 'group' | 'crash';
    location: {
        address: string;
        city: string;
        pincode: string;
        coordinates: {
            latitude: number;
            longitude: number;
        };
        teachingRadius: number;
    };
    schedule: {
        daysPerWeek: string;
        preferredTimings: string[];
        startDate: string;
    };
    tutorPreferences?: string;
    budget: {
        minAmount: number;
        maxAmount: number;
        negotiationAllowed: boolean;
    };
    status: 'draft' | 'published' | 'receiving_applications' | 'shortlisted' | 'demo_scheduled' | 'teacher_selected' | 'hired' | 'closed' | 'cancelled' | 'expired' | 'paused';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    matchedTutors: Array<{
        tutorId: mongoose.Types.ObjectId;
        matchScore: number;
        matchDate: Date;
        status: 'recommended' | 'viewed' | 'contacted' | 'rejected' | 'expired';
        contactedDate?: Date;
        expiryDate: Date;
    }>;
    totalMatches: number;
    views: number;
    unlocks: number;
    applicationsCount: number;
    shortlistedCount: number;
    demosScheduledCount: number;
    demosCompletedCount: number;
    hiredTeacherId?: mongoose.Types.ObjectId;
    hiredTeacherProfileId?: mongoose.Types.ObjectId;
    hiredAt?: Date;
    hireReason?: string;
    closedReason?: string;
    closedAt?: Date;
    isActive: boolean;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
    addTutorMatch(tutorId: mongoose.Types.ObjectId, matchScore: number): Promise<IParentRequirement>;
    updateTutorMatchStatus(tutorId: mongoose.Types.ObjectId, status: string): Promise<IParentRequirement>;
    incrementViews(): Promise<IParentRequirement>;
    incrementUnlocks(): Promise<IParentRequirement>;
    extendExpiry(days?: number): Promise<IParentRequirement>;
    closeRequirement(reason?: string): Promise<IParentRequirement>;
    getTopMatches(limit?: number): any[];
}
export declare const ParentRequirement: mongoose.Model<IParentRequirement, {}, {}, {}, mongoose.Document<unknown, {}, IParentRequirement, {}, mongoose.DefaultSchemaOptions> & IParentRequirement & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IParentRequirement>;
//# sourceMappingURL=ParentRequirement.d.ts.map