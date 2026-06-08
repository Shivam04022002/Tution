import mongoose, { Document } from 'mongoose';
export interface ITeacherProfile extends Document {
    userId: mongoose.Types.ObjectId;
    basicDetails: {
        fullName: string;
        gender: 'male' | 'female' | 'other';
        dateOfBirth: Date;
        mobileNumber: string;
        email: string;
        languages: string[];
        profilePhoto: string;
    };
    education: {
        highestQualification: string;
        degree: string;
        university: string;
        yearOfCompletion: number;
        certifications: Array<{
            name: string;
            issuer: string;
            year: number;
            certificateUrl?: string;
        }>;
        status: 'completed' | 'pursuing';
    };
    teachingDetails: {
        subjects: string[];
        classes: string[];
        boards: string[];
        specialization: string;
        teachingModes: string[];
        groupTuitionOption: boolean;
        groupSize: number;
        groupRate: number;
    };
    locationAvailability: {
        address: string;
        city: string;
        pincode: string;
        coordinates: {
            latitude: number;
            longitude: number;
        };
        preferredAreas: string[];
        preferredLocations: Array<{
            area: string;
            city: string;
            latitude: number;
            longitude: number;
            radiusKm: number;
        }>;
        teachingRadius: number;
        availableDays: string[];
        availableTimeSlots: string[];
        vacationMode: boolean;
    };
    bio?: string;
    pricingRevenue: {
        hourlyRate: number;
        monthlyRate: number;
        currentRevenue: string;
        experienceYears: number;
        pricingStrategy: string;
        negotiationAllowed: boolean;
    };
    verificationDocuments: {
        aadhaarCard: string;
        panCard: string;
        qualificationDocuments: string[];
        introVideo?: string;
        portfolioPhotos: string[];
    };
    verificationStatus: 'pending' | 'verified' | 'rejected';
    verificationDate?: Date;
    rejectionReason?: string;
    stats: {
        totalStudents: number;
        activeStudents: number;
        completedClasses: number;
        averageRating: number;
        totalReviews: number;
        totalEarnings: number;
        leadUnlocks: number;
        responseRate: number;
        responseTime: string;
    };
    preferences: {
        notifications: boolean;
        whatsappUpdates: boolean;
        emailUpdates: boolean;
        leadAlerts: boolean;
    };
    isActive: boolean;
    isVerified: boolean;
    isBlocked: boolean;
    blockReason?: string;
    isProfileComplete?: boolean;
    profileCompletionPercentage?: number;
    createdAt: Date;
    updatedAt: Date;
    toggleVacationMode(): Promise<ITeacherProfile>;
    updateStats(statsUpdate: Partial<ITeacherProfile['stats']>): Promise<ITeacherProfile>;
    canAcceptLead(): boolean;
}
export declare const TeacherProfile: mongoose.Model<ITeacherProfile, {}, {}, {}, mongoose.Document<unknown, {}, ITeacherProfile, {}, mongoose.DefaultSchemaOptions> & ITeacherProfile & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, ITeacherProfile>;
//# sourceMappingURL=TeacherProfile.d.ts.map