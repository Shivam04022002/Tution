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
        subjectExperience: Array<{
            subject: string;
            yearsExperience: number;
        }>;
        studentTypes: string[];
        teachingLevel: string[];
        examPreparation: string[];
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
        customTimeSlots: Array<{
            id: string;
            startTime: string;
            endTime: string;
            label: string;
            isActive: boolean;
        }>;
        weeklySchedule: {
            [key: string]: {
                isEnabled: boolean;
                timeSlots: string[];
            };
        };
        maxStudents: {
            active: number;
            daily: number;
        };
        vacationMode: boolean;
    };
    discoverability: {
        availableForNewStudents: boolean;
        visibleInMarketplace: boolean;
        onlineStatus: 'online' | 'offline' | 'hybrid';
        travelSettings: {
            maxTravelDistance: number;
            preferredTravelModes: string[];
        };
        locationCoverage: {
            state: string;
            city: string;
            areas: string[];
            pincodes: string[];
        };
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
    documents?: Array<{
        _id: mongoose.Types.ObjectId;
        type: 'profile_photo' | 'government_id' | 'aadhaar' | 'pan' | 'driving_license' | 'passport' | 'degree_certificate' | 'teaching_certificate' | 'experience_certificate';
        name: string;
        url: string;
        publicId: string;
        status: 'draft' | 'pending' | 'verified' | 'rejected';
        uploadedAt: Date;
        verifiedAt?: Date;
        rejectionReason?: string;
        fileType: 'jpg' | 'png' | 'pdf';
        fileSize: number;
    }>;
    verificationStatus: 'draft' | 'pending' | 'verified' | 'rejected';
    verificationDate?: Date;
    rejectionReason?: string;
    verificationNotes?: string;
    stats: {
        totalStudents: number;
        activeStudents: number;
        completedClasses: number;
        averageRating: number;
        totalReviews: number;
        ratingBreakdown?: Record<string, number>;
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
    subscription: {
        currentPlan: 'free' | 'starter' | 'professional' | 'premium';
        subscriptionStatus: 'active' | 'cancelled' | 'expired' | 'none';
        subscriptionStartDate?: Date;
        subscriptionEndDate?: Date;
        autoRenew: boolean;
    };
    savedRequirements: mongoose.Types.ObjectId[];
    hiddenRequirements: mongoose.Types.ObjectId[];
    referralCode?: string;
    referralCount: number;
    totalRewardsEarned: number;
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