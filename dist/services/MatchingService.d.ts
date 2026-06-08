import { IParentRequirement } from '../models/ParentRequirement';
import mongoose from 'mongoose';
export interface SubjectMatchDetails {
    matchedSubjects: string[];
    requirementSubjects: string[];
    teacherSubjects: string[];
    matchPercentage: number;
}
export interface ClassMatchDetails {
    requirementGrade: string;
    teacherClasses: string[];
    isMatch: boolean;
}
export interface BoardMatchDetails {
    requirementBoard: string;
    teacherBoards: string[];
    isMatch: boolean;
}
export interface LocationMatchDetails {
    requirementCity: string;
    teacherCity: string;
    requirementPincode: string;
    teacherPincode: string;
    distance: number;
    teachingRadius: number;
    isWithinRadius: boolean;
}
export interface BudgetMatchDetails {
    requirementMinBudget: number;
    requirementMaxBudget: number;
    teacherHourlyRate: number;
    isWithinBudget: boolean;
}
export interface ModeMatchDetails {
    requirementMode: string;
    teacherModes: string[];
    isMatch: boolean;
}
export interface TimingMatchDetails {
    requirementTimeSlots: string[];
    teacherDays: string[];
    teacherTimeSlots: string[];
    timeOverlap: string[];
    timeScore: number;
}
export interface BonusDetails {
    genderScore: number;
    languageScore: number;
    experienceScore: number;
    totalBonus: number;
}
export interface MatchBreakdown {
    subjectScore: number;
    subjectMatchDetails: SubjectMatchDetails;
    classScore: number;
    classMatchDetails: ClassMatchDetails;
    boardScore: number;
    boardMatchDetails: BoardMatchDetails;
    locationScore: number;
    locationMatchDetails: LocationMatchDetails;
    budgetScore: number;
    budgetMatchDetails: BudgetMatchDetails;
    modeScore: number;
    modeMatchDetails: ModeMatchDetails;
    timingScore: number;
    timingMatchDetails: TimingMatchDetails;
    bonusDetails: BonusDetails;
}
export interface MatchResult {
    requirementId: mongoose.Types.ObjectId;
    teacherId: mongoose.Types.ObjectId;
    teacherProfileId: mongoose.Types.ObjectId;
    parentId: mongoose.Types.ObjectId;
    overallScore: number;
    breakdown: MatchBreakdown;
    algorithmVersion: string;
    status: string;
}
export declare class MatchingService {
    private static calculateSubjectScore;
    private static calculateClassScore;
    private static calculateBoardScore;
    private static calculateDistance;
    private static toRadians;
    private static calculateLocationScore;
    private static calculateBudgetScore;
    private static calculateModeScore;
    private static calculateTimingScore;
    private static calculateBonusScore;
    static generateMatchesForRequirement(requirement: IParentRequirement, limit?: number): Promise<MatchResult[]>;
    static saveMatches(matches: MatchResult[]): Promise<void>;
    static generateAndSaveForRequirement(requirement: IParentRequirement): Promise<number>;
    static expireCompetingMatches(requirementId: mongoose.Types.ObjectId, winnerTeacherId: mongoose.Types.ObjectId): Promise<void>;
    static resetMatchOnWithdrawal(requirementId: mongoose.Types.ObjectId, teacherId: mongoose.Types.ObjectId): Promise<void>;
    static cleanupExpiredMatches(): Promise<number>;
    static getMatchesForTeacher(teacherId: mongoose.Types.ObjectId, status?: string): Promise<any[]>;
    static getMatchesForRequirement(requirementId: mongoose.Types.ObjectId, status?: string): Promise<any[]>;
    static updateMatchStatus(matchId: string, status: string, updateFields?: any): Promise<void>;
    static runMatchingEngine(): Promise<{
        processed: number;
        totalMatches: number;
    }>;
}
export default MatchingService;
//# sourceMappingURL=MatchingService.d.ts.map