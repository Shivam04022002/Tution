import mongoose, { Document } from 'mongoose';
export interface ITutor extends Document {
    userId: mongoose.Types.ObjectId;
    personalInfo: {
        qualification: string;
        experience: number;
        subjects: string[];
        classes: string[];
        boards: string[];
        languages: string[];
        about: string;
    };
    location: {
        address: string;
        city: string;
        state: string;
        pincode: string;
        coordinates: {
            latitude: number;
            longitude: number;
        };
        teachingRadius: number;
    };
    availability: {
        preferredTimeSlots: string[];
        preferredDays: string[];
        isAvailableForOnline: boolean;
        isAvailableForOffline: boolean;
    };
    pricing: {
        hourlyRate: number;
        monthlyRate?: number;
        negotiationAllowed: boolean;
    };
    verification: {
        isVerified: boolean;
        verificationDocuments: string[];
        verificationDate?: Date;
        verifiedBy?: mongoose.Types.ObjectId;
    };
    stats: {
        totalStudents: number;
        activeStudents: number;
        completedClasses: number;
        averageRating: number;
        totalReviews: number;
    };
    preferences: {
        minimumClassDuration: number;
        maximumStudentsPerBatch: number;
        trialClassAvailable: boolean;
        trialClassDuration: number;
    };
    isActive: boolean;
    isProfilePublic: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Tutor: mongoose.Model<ITutor, {}, {}, {}, mongoose.Document<unknown, {}, ITutor, {}, mongoose.DefaultSchemaOptions> & ITutor & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, ITutor>;
//# sourceMappingURL=Tutor.d.ts.map