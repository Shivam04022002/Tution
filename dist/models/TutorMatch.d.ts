import mongoose, { Document } from 'mongoose';
export interface ITutorMatch extends Document {
    requirementId: mongoose.Types.ObjectId;
    teacherId: mongoose.Types.ObjectId;
    teacherProfileId: mongoose.Types.ObjectId;
    parentId: mongoose.Types.ObjectId;
    matchId: string;
    overallScore: number;
    breakdown: {
        subjectScore: number;
        subjectMatchDetails: {
            requirementSubjects: string[];
            teacherSubjects: string[];
            matchedSubjects: string[];
            matchPercentage: number;
        };
        classScore: number;
        classMatchDetails: {
            requirementGrade: string;
            teacherClasses: string[];
            isMatch: boolean;
        };
        boardScore: number;
        boardMatchDetails: {
            requirementBoard: string;
            teacherBoards: string[];
            isMatch: boolean;
        };
        locationScore: number;
        locationMatchDetails: {
            requirementCity: string;
            teacherCity: string;
            requirementPincode: string;
            teacherPincode: string;
            distance: number;
            teachingRadius: number;
            isWithinRadius: boolean;
        };
        budgetScore: number;
        budgetMatchDetails: {
            requirementMinBudget: number;
            requirementMaxBudget: number;
            teacherHourlyRate: number;
            isWithinBudget: boolean;
        };
        modeScore: number;
        modeMatchDetails: {
            requirementMode: string;
            teacherModes: string[];
            isMatch: boolean;
        };
        timingScore: number;
        timingMatchDetails: {
            requirementTimeSlots: string[];
            teacherDays: string[];
            teacherTimeSlots: string[];
            timeOverlap: string[];
            timeScore: number;
        };
        bonusDetails: {
            genderScore: number;
            languageScore: number;
            experienceScore: number;
            totalBonus: number;
        };
    };
    algorithmVersion: string;
    status: 'recommended' | 'viewed' | 'applied' | 'shortlisted' | 'rejected' | 'hired' | 'expired';
    viewedAt?: Date;
    appliedAt?: Date;
    shortlistedAt?: Date;
    rejectedAt?: Date;
    hiredAt?: Date;
    expiryDate: Date;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare const TutorMatch: mongoose.Model<ITutorMatch, {}, {}, {}, mongoose.Document<unknown, {}, ITutorMatch, {}, mongoose.DefaultSchemaOptions> & ITutorMatch & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, ITutorMatch>;
export default TutorMatch;
//# sourceMappingURL=TutorMatch.d.ts.map