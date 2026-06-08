import { ParentRequirement, IParentRequirement } from '../models/ParentRequirement';
import { TeacherProfile, ITeacherProfile } from '../models/TeacherProfile';
import { TutorMatch } from '../models/TutorMatch';
import mongoose from 'mongoose';

// ─── Algorithm version ────────────────────────────────────────────────────────
const ALGORITHM_VERSION = 'v2.0';

// ─── Match Score Weights (must sum to 1.0) ────────────────────────────────────
// Core factors: 90 pts max
// Bonus factors (gender + language + experience): up to 10 pts, capped at 100
const WEIGHTS = {
  subject:  0.30,   // 30%
  class:    0.18,   // 18%
  board:    0.12,   // 12%
  location: 0.15,   // 15%
  budget:   0.10,   // 10%
  mode:     0.10,   // 10%
  timing:   0.05,   // 5%
  // bonus applied after weighted sum, max +10
};

// Distance threshold in kilometers — beyond this location score is minimal
const MAX_DISTANCE_KM = 15;

// ─── Teaching mode mapping ────────────────────────────────────────────────────
// Maps ParentRequirement.tuitionType → TeacherProfile.teachingDetails.teachingModes values
const MODE_MAP: Record<string, string[]> = {
  home:   ['student_home', 'own_home'],
  online: ['online'],
  group:  ['group'],
  crash:  ['online', 'student_home', 'own_home', 'group'], // crash = any mode
};

// ─── Interfaces ───────────────────────────────────────────────────────────────

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

// ─── MatchingService ──────────────────────────────────────────────────────────

export class MatchingService {

  // ── 1. Subject match ────────────────────────────────────────────────────────
  private static calculateSubjectScore(
    requirementSubjects: string[],
    teacherSubjects: string[]
  ): { score: number; details: SubjectMatchDetails } {
    // Guard: no subjects in requirement → score 0
    if (!requirementSubjects || requirementSubjects.length === 0) {
      return {
        score: 0,
        details: { requirementSubjects: [], teacherSubjects, matchedSubjects: [], matchPercentage: 0 },
      };
    }

    const matchedSubjects = requirementSubjects.filter(subject =>
      teacherSubjects.some(teacherSub =>
        teacherSub.toLowerCase().includes(subject.toLowerCase()) ||
        subject.toLowerCase().includes(teacherSub.toLowerCase())
      )
    );

    const matchPercentage = (matchedSubjects.length / requirementSubjects.length) * 100;

    // Bucketed score — 0 when no match at all
    let score = 0;
    if (matchPercentage >= 80) score = 100;
    else if (matchPercentage >= 60) score = 80;
    else if (matchPercentage >= 40) score = 60;
    else if (matchPercentage >= 20) score = 40;
    else if (matchPercentage > 0)  score = 20;
    // matchPercentage === 0 → score stays 0

    return {
      score,
      details: {
        requirementSubjects,
        teacherSubjects,
        matchedSubjects,
        matchPercentage: Math.round(matchPercentage),
      },
    };
  }

  // ── 2. Class/grade match ────────────────────────────────────────────────────
  private static calculateClassScore(
    requirementGrade: string,
    teacherClasses: string[]
  ): { score: number; details: ClassMatchDetails } {
    if (!requirementGrade) {
      return { score: 0, details: { requirementGrade: '', teacherClasses, isMatch: false } };
    }

    // Normalise grade to extract numeric part to avoid "Class 1" matching "Class 10"
    const gradeNum = requirementGrade.replace(/\D/g, '');

    const isMatch = teacherClasses.some(cls => {
      const clsNum = cls.replace(/\D/g, '');
      // Exact numeric match, or one fully contains the other only when grade tokens match
      if (gradeNum && clsNum) return gradeNum === clsNum;
      return (
        cls.toLowerCase().trim() === requirementGrade.toLowerCase().trim()
      );
    });

    return {
      score: isMatch ? 100 : 0,
      details: { requirementGrade, teacherClasses, isMatch },
    };
  }

  // ── 3. Board match ──────────────────────────────────────────────────────────
  private static calculateBoardScore(
    requirementBoard: string,
    teacherBoards: string[]
  ): { score: number; details: BoardMatchDetails } {
    if (!requirementBoard) {
      return { score: 0, details: { requirementBoard: '', teacherBoards, isMatch: false } };
    }

    const isMatch = teacherBoards.some(board =>
      board.toLowerCase().includes(requirementBoard.toLowerCase()) ||
      requirementBoard.toLowerCase().includes(board.toLowerCase())
    );

    return {
      score: isMatch ? 100 : 0,
      details: { requirementBoard, teacherBoards, isMatch },
    };
  }

  // ── 4. Location match ───────────────────────────────────────────────────────
  private static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private static toRadians(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private static calculateLocationScore(
    reqLocation: any,
    teacherLocation: any
  ): { score: number; details: LocationMatchDetails } {
    let distance = 0;
    let isWithinRadius = false;

    const hasGPS =
      reqLocation.coordinates?.latitude &&
      reqLocation.coordinates?.longitude &&
      teacherLocation.coordinates?.latitude &&
      teacherLocation.coordinates?.longitude;

    if (hasGPS) {
      distance = this.calculateDistance(
        reqLocation.coordinates.latitude,
        reqLocation.coordinates.longitude,
        teacherLocation.coordinates.latitude,
        teacherLocation.coordinates.longitude
      );
      // Use the smaller of teacher's radius and parent's requested radius
      const effectiveRadius = Math.min(
        teacherLocation.teachingRadius || 10,
        reqLocation.teachingRadius || 10
      );
      isWithinRadius = distance <= effectiveRadius;
    } else {
      // Fallback: city comparison (case-insensitive)
      isWithinRadius =
        (reqLocation.city || '').toLowerCase() === (teacherLocation.city || '').toLowerCase();
    }

    let score = 0;
    if (isWithinRadius) {
      if (distance <= 2)       score = 100;
      else if (distance <= 5)  score = 90;
      else if (distance <= 10) score = 80;
      else                     score = 70;
    } else if (distance > 0 && distance <= MAX_DISTANCE_KM) {
      score = 50;
    } else if (!hasGPS && isWithinRadius) {
      score = 80; // city-match fallback
    } else {
      score = 20;
    }

    return {
      score,
      details: {
        requirementCity: reqLocation.city || '',
        teacherCity: teacherLocation.city || '',
        requirementPincode: reqLocation.pincode || '',
        teacherPincode: teacherLocation.pincode || '',
        distance: Math.round(distance * 10) / 10,
        teachingRadius: teacherLocation.teachingRadius || 0,
        isWithinRadius,
      },
    };
  }

  // ── 5. Budget match ─────────────────────────────────────────────────────────
  private static calculateBudgetScore(
    reqBudget: { minAmount: number; maxAmount: number; negotiationAllowed?: boolean },
    teacherRate: number,
    teacherNegotiationAllowed?: boolean
  ): { score: number; details: BudgetMatchDetails } {
    const min = reqBudget.minAmount || 0;
    const max = reqBudget.maxAmount || 0;

    // Guard: zero-range budget → neutral score
    if (max === 0) {
      return {
        score: 50,
        details: { requirementMinBudget: min, requirementMaxBudget: max, teacherHourlyRate: teacherRate, isWithinBudget: true },
      };
    }

    const isWithinBudget = teacherRate >= min && teacherRate <= max;

    let score = 0;
    if (isWithinBudget) {
      const midPoint = (min + max) / 2;
      const range = max - min || 1;
      const deviation = Math.abs(teacherRate - midPoint) / range; // 0..0.5
      score = Math.round(100 - deviation * 20); // 90..100
    } else if (teacherRate < max * 1.2) {
      // Slightly over budget — bump if negotiation allowed on either side
      const negotiable = reqBudget.negotiationAllowed || teacherNegotiationAllowed;
      score = negotiable ? 70 : 55;
    } else {
      score = 30;
    }

    return {
      score,
      details: { requirementMinBudget: min, requirementMaxBudget: max, teacherHourlyRate: teacherRate, isWithinBudget },
    };
  }

  // ── 6. Teaching mode match ──────────────────────────────────────────────────
  private static calculateModeScore(
    reqMode: string,
    teacherModes: string[]
  ): { score: number; details: ModeMatchDetails } {
    const acceptableModes = MODE_MAP[reqMode] || [];
    const isMatch = teacherModes.some(mode =>
      acceptableModes.includes(mode.toLowerCase())
    );

    return {
      score: isMatch ? 100 : 0,
      details: { requirementMode: reqMode, teacherModes, isMatch },
    };
  }

  // ── 7. Timing match (fixed: time slots vs days are separate fields) ─────────
  private static calculateTimingScore(
    reqSchedule: any,
    teacherAvailability: any
  ): { score: number; details: TimingMatchDetails } {
    // preferredTimings = time-of-day strings like "Morning", "Evening"
    const reqTimeSlots: string[] = reqSchedule.preferredTimings || [];
    const teacherTimeSlots: string[] = teacherAvailability.availableTimeSlots || [];

    // availableDays available from teacher but requirement has no days[] array — score only timeslots
    const timeOverlap = reqTimeSlots.filter(slot =>
      teacherTimeSlots.some(teacherSlot =>
        teacherSlot.toLowerCase().includes(slot.toLowerCase()) ||
        slot.toLowerCase().includes(teacherSlot.toLowerCase())
      )
    );

    const timeScore = reqTimeSlots.length > 0
      ? (timeOverlap.length / reqTimeSlots.length) * 100
      : 50; // no preference stated → neutral 50

    const score = Math.round(timeScore);

    return {
      score,
      details: {
        requirementTimeSlots: reqTimeSlots,
        teacherDays: teacherAvailability.availableDays || [],
        teacherTimeSlots,
        timeOverlap,
        timeScore: Math.round(timeScore),
      },
    };
  }

  // ── 8. Bonus scoring: gender + language + experience ───────────────────────
  private static calculateBonusScore(
    requirement: IParentRequirement,
    teacher: ITeacherProfile
  ): { bonus: number; details: BonusDetails } {
    // Gender preference (max 4 pts)
    let genderScore = 0;
    const genderPref = requirement.studentDetails?.genderPreference || 'any';
    if (genderPref === 'any') {
      genderScore = 4; // full points when no preference
    } else if (teacher.basicDetails?.gender === genderPref) {
      genderScore = 4;
    } else {
      genderScore = 0;
    }

    // Language preference (max 3 pts)
    let languageScore = 0;
    const reqLangs: string[] = requirement.languagePreference || [];
    const teacherLangs: string[] = teacher.basicDetails?.languages || [];
    if (reqLangs.length === 0) {
      languageScore = 3;
    } else {
      const matched = reqLangs.filter(lang =>
        teacherLangs.some(tl => tl.toLowerCase().includes(lang.toLowerCase()))
      );
      languageScore = Math.round((matched.length / reqLangs.length) * 3);
    }

    // Experience bonus (max 3 pts)
    const expYears = teacher.pricingRevenue?.experienceYears || 0;
    let experienceScore = 0;
    if (expYears >= 10)      experienceScore = 3;
    else if (expYears >= 5)  experienceScore = 2;
    else if (expYears >= 2)  experienceScore = 1;

    const totalBonus = genderScore + languageScore + experienceScore;

    return {
      bonus: totalBonus,
      details: { genderScore, languageScore, experienceScore, totalBonus },
    };
  }

  // ── 9. Generate matches for a single requirement ────────────────────────────
  public static async generateMatchesForRequirement(
    requirement: IParentRequirement,
    limit: number = 20
  ): Promise<MatchResult[]> {

    // DB pre-filter: only teachers who teach at least one required subject
    // and are in the same city (soft — city is indexed).
    // This avoids loading unrelated teachers up to a hard cap.
    const subjectFilter = requirement.subjects?.length
      ? { 'teachingDetails.subjects': { $in: requirement.subjects } }
      : {};

    const cityFilter = requirement.location?.city
      ? { 'locationAvailability.city': { $regex: new RegExp(requirement.location.city, 'i') } }
      : {};

    const teachers = await TeacherProfile.find({
      isVerified: true,
      isActive: true,
      isBlocked: false,
      'locationAvailability.vacationMode': false,  // FIX: correct field path
      ...subjectFilter,
      ...cityFilter,
    });

    // Bulk-fetch existing matches for this requirement to avoid per-teacher queries
    const existingMatches = await TutorMatch.find(
      { requirementId: requirement._id },
      { teacherId: 1 }
    ).lean();
    const existingTeacherIds = new Set(
      existingMatches.map(m => m.teacherId.toString())
    );

    const matches: MatchResult[] = [];

    for (const teacher of teachers) {
      // Skip if already matched (in-memory set, no extra DB round-trip)
      if (existingTeacherIds.has(teacher.userId.toString())) continue;

      const subjectResult  = this.calculateSubjectScore(requirement.subjects, teacher.teachingDetails.subjects);
      const classResult    = this.calculateClassScore(requirement.studentDetails.grade, teacher.teachingDetails.classes);
      const boardResult    = this.calculateBoardScore(requirement.studentDetails.board, teacher.teachingDetails.boards);
      const locationResult = this.calculateLocationScore(requirement.location, teacher.locationAvailability);
      const budgetResult   = this.calculateBudgetScore(
        requirement.budget,
        teacher.pricingRevenue.hourlyRate,
        teacher.pricingRevenue.negotiationAllowed
      );
      const modeResult     = this.calculateModeScore(requirement.tuitionType, teacher.teachingDetails.teachingModes);
      const timingResult   = this.calculateTimingScore(requirement.schedule, teacher.locationAvailability);
      const bonusResult    = this.calculateBonusScore(requirement, teacher);

      // Weighted core score (sums to 100 max)
      const coreScore =
        subjectResult.score  * WEIGHTS.subject  +
        classResult.score    * WEIGHTS.class    +
        boardResult.score    * WEIGHTS.board    +
        locationResult.score * WEIGHTS.location +
        budgetResult.score   * WEIGHTS.budget   +
        modeResult.score     * WEIGHTS.mode     +
        timingResult.score   * WEIGHTS.timing;

      // Add bonus points, cap at 100
      const overallScore = Math.min(100, Math.round(coreScore + bonusResult.bonus));

      if (overallScore >= 30) {
        matches.push({
          requirementId: requirement._id as mongoose.Types.ObjectId,
          teacherId: teacher.userId as mongoose.Types.ObjectId,
          teacherProfileId: teacher._id as mongoose.Types.ObjectId,
          parentId: requirement.parentId as mongoose.Types.ObjectId,
          overallScore,
          breakdown: {
            subjectScore: subjectResult.score,
            subjectMatchDetails: subjectResult.details,
            classScore: classResult.score,
            classMatchDetails: classResult.details,
            boardScore: boardResult.score,
            boardMatchDetails: boardResult.details,
            locationScore: locationResult.score,
            locationMatchDetails: locationResult.details,
            budgetScore: budgetResult.score,
            budgetMatchDetails: budgetResult.details,
            modeScore: modeResult.score,
            modeMatchDetails: modeResult.details,
            timingScore: timingResult.score,
            timingMatchDetails: timingResult.details,
            bonusDetails: bonusResult.details,
          },
          algorithmVersion: ALGORITHM_VERSION,
          status: 'recommended',
        });
      }
    }

    matches.sort((a, b) => b.overallScore - a.overallScore);
    return matches.slice(0, limit);
  }

  // ── 10. Save matches to DB ──────────────────────────────────────────────────
  public static async saveMatches(matches: MatchResult[]): Promise<void> {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7);

    for (const match of matches) {
      try {
        await TutorMatch.create({
          requirementId: match.requirementId,
          teacherId: match.teacherId,
          teacherProfileId: match.teacherProfileId,
          parentId: match.parentId,
          overallScore: match.overallScore,
          breakdown: match.breakdown as any,
          algorithmVersion: ALGORITHM_VERSION,
          status: 'recommended',
          expiryDate,
        } as any);
      } catch (error: any) {
        if (error.code !== 11000) {
          console.error('Error saving match:', error);
        }
      }
    }
  }

  // ── 11. Auto-generate and save for a newly created requirement ──────────────
  public static async generateAndSaveForRequirement(
    requirement: IParentRequirement
  ): Promise<number> {
    const matches = await this.generateMatchesForRequirement(requirement, 20);
    await this.saveMatches(matches);
    return matches.length;
  }

  // ── 12. Expire competing matches when a requirement is fulfilled ─────────────
  public static async expireCompetingMatches(
    requirementId: mongoose.Types.ObjectId,
    winnerTeacherId: mongoose.Types.ObjectId
  ): Promise<void> {
    await TutorMatch.updateMany(
      {
        requirementId,
        teacherId: { $ne: winnerTeacherId },
        status: { $in: ['recommended', 'viewed', 'applied'] },
      },
      {
        status: 'expired',
        isActive: false,
      }
    );
  }

  // ── 13. Reset match to recommended when teacher withdraws application ────────
  public static async resetMatchOnWithdrawal(
    requirementId: mongoose.Types.ObjectId,
    teacherId: mongoose.Types.ObjectId
  ): Promise<void> {
    await TutorMatch.findOneAndUpdate(
      { requirementId, teacherId },
      { status: 'recommended' }
    );
  }

  // ── 14. Cleanup expired matches ─────────────────────────────────────────────
  public static async cleanupExpiredMatches(): Promise<number> {
    const result = await TutorMatch.updateMany(
      {
        expiryDate: { $lt: new Date() },
        isActive: true,
        status: { $nin: ['hired', 'expired'] },
      },
      { status: 'expired', isActive: false }
    );
    return result.modifiedCount;
  }

  // ── 15. Get matches for a teacher ───────────────────────────────────────────
  public static async getMatchesForTeacher(
    teacherId: mongoose.Types.ObjectId,
    status?: string
  ): Promise<any[]> {
    const query: any = {
      teacherId,
      isActive: true,
      expiryDate: { $gte: new Date() },
    };
    if (status) query.status = status;

    return TutorMatch.find(query)
      .populate({
        path: 'requirementId',
        select: 'requirementId studentDetails subjects budget location schedule tuitionType status',
      })
      .populate({
        path: 'parentId',
        select: 'profile.parentName profile.mobileNumber',
      })
      .sort({ overallScore: -1 });
  }

  // ── 16. Get matches for a parent requirement ────────────────────────────────
  public static async getMatchesForRequirement(
    requirementId: mongoose.Types.ObjectId,
    status?: string
  ): Promise<any[]> {
    const query: any = { requirementId, isActive: true };
    if (status) query.status = status;

    return TutorMatch.find(query)
      .populate({
        path: 'teacherProfileId',
        select: 'basicDetails.fullName basicDetails.profilePhoto teachingDetails.subjects teachingDetails.classes pricingRevenue.hourlyRate stats.averageRating',
      })
      .sort({ overallScore: -1 });
  }

  // ── 17. Update match status ─────────────────────────────────────────────────
  public static async updateMatchStatus(
    matchId: string,
    status: string,
    updateFields?: any
  ): Promise<void> {
    const update: any = { status, ...updateFields };

    switch (status) {
      case 'viewed':      update.viewedAt      = new Date(); break;
      case 'applied':     update.appliedAt     = new Date(); break;
      case 'shortlisted': update.shortlistedAt = new Date(); break;
      case 'rejected':    update.rejectedAt    = new Date(); break;
      case 'hired':       update.hiredAt       = new Date(); break;
    }

    await TutorMatch.findOneAndUpdate({ matchId }, update);
  }

  // ── 18. Run matching engine for all active requirements (batch) ─────────────
  public static async runMatchingEngine(): Promise<{ processed: number; totalMatches: number }> {
    console.log('[MatchingEngine] Starting batch run...');

    // First clean up expired matches
    const cleaned = await this.cleanupExpiredMatches();
    console.log(`[MatchingEngine] Cleaned ${cleaned} expired matches`);

    const requirements = await ParentRequirement.find({
      status: 'active',
      isActive: true,
      expiresAt: { $gte: new Date() },
    });

    console.log(`[MatchingEngine] Found ${requirements.length} active requirements`);

    let processed = 0;
    let totalMatches = 0;

    for (const requirement of requirements) {
      try {
        const count = await this.generateAndSaveForRequirement(requirement);
        totalMatches += count;
        processed++;
        console.log(`[MatchingEngine] req ${requirement.requirementId} → ${count} new matches`);
      } catch (error) {
        console.error(`[MatchingEngine] Error for req ${requirement.requirementId}:`, error);
      }
    }

    console.log(`[MatchingEngine] Complete — processed ${processed}, total new matches ${totalMatches}`);
    return { processed, totalMatches };
  }
}

export default MatchingService;
