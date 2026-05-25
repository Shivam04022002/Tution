import mongoose, { Document } from 'mongoose';
export interface IRequirement extends Document {
    parentId: mongoose.Types.ObjectId;
    studentInfo: {
        name: string;
        grade: string;
        board: string;
        school?: string;
        currentPerformance?: string;
        learningGoals: string[];
    };
    subjectRequirements: [
        {
            subject: string;
            currentLevel: string;
            targetLevel: string;
            priority: 'high' | 'medium' | 'low';
        }
    ];
    location: {
        address: string;
        city: string;
        state: string;
        pincode: string;
        coordinates: {
            latitude: number;
            longitude: number;
        };
        preferredRadius: number;
    };
    schedule: {
        preferredDays: string[];
        preferredTimeSlots: string[];
        frequency: 'daily' | 'weekly' | 'bi-weekly' | 'monthly';
        startDate?: Date;
        endDate?: Date;
    };
    preferences: {
        mode: 'online' | 'offline' | 'both';
        genderPreference?: 'male' | 'female' | 'any';
        tutorQualification: string[];
        minExperience: number;
        budget: {
            minHourlyRate: number;
            maxHourlyRate: number;
            negotiationAllowed: boolean;
        };
        trialClassRequired: boolean;
        groupClassAllowed: boolean;
        maxGroupSize: number;
    };
    urgency: {
        level: 'immediate' | 'within_week' | 'within_month' | 'flexible';
        reason?: string;
    };
    status: 'active' | 'closed' | 'paused' | 'fulfilled';
    matches: [
        {
            tutorId: mongoose.Types.ObjectId;
            matchScore: number;
            contactedAt?: Date;
            responseStatus: 'pending' | 'interested' | 'not_interested' | 'hired';
            contactedBy: 'parent' | 'tutor' | 'admin';
        }
    ];
    visibility: {
        isPublic: boolean;
        expiresAt?: Date;
        maxContacts: number;
        currentContacts: number;
    };
    createdAt: Date;
    updatedAt: Date;
}
export declare const Requirement: mongoose.Model<IRequirement, {}, {}, {}, mongoose.Document<unknown, {}, IRequirement, {}, mongoose.DefaultSchemaOptions> & IRequirement & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IRequirement>;
//# sourceMappingURL=Requirement.d.ts.map