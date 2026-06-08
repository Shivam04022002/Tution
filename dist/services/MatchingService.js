"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchingService = void 0;
const ParentRequirement_1 = require("../models/ParentRequirement");
const TeacherProfile_1 = require("../models/TeacherProfile");
const TutorMatch_1 = require("../models/TutorMatch");
const ALGORITHM_VERSION = 'v2.0';
const WEIGHTS = {
    subject: 0.30,
    class: 0.18,
    board: 0.12,
    location: 0.15,
    budget: 0.10,
    mode: 0.10,
    timing: 0.05,
};
const MAX_DISTANCE_KM = 15;
const MODE_MAP = {
    home: ['student_home', 'own_home'],
    online: ['online'],
    group: ['group'],
    crash: ['online', 'student_home', 'own_home', 'group'],
};
class MatchingService {
    static calculateSubjectScore(requirementSubjects, teacherSubjects) {
        if (!requirementSubjects || requirementSubjects.length === 0) {
            return {
                score: 0,
                details: { requirementSubjects: [], teacherSubjects, matchedSubjects: [], matchPercentage: 0 },
            };
        }
        const matchedSubjects = requirementSubjects.filter(subject => teacherSubjects.some(teacherSub => teacherSub.toLowerCase().includes(subject.toLowerCase()) ||
            subject.toLowerCase().includes(teacherSub.toLowerCase())));
        const matchPercentage = (matchedSubjects.length / requirementSubjects.length) * 100;
        let score = 0;
        if (matchPercentage >= 80)
            score = 100;
        else if (matchPercentage >= 60)
            score = 80;
        else if (matchPercentage >= 40)
            score = 60;
        else if (matchPercentage >= 20)
            score = 40;
        else if (matchPercentage > 0)
            score = 20;
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
    static calculateClassScore(requirementGrade, teacherClasses) {
        if (!requirementGrade) {
            return { score: 0, details: { requirementGrade: '', teacherClasses, isMatch: false } };
        }
        const gradeNum = requirementGrade.replace(/\D/g, '');
        const isMatch = teacherClasses.some(cls => {
            const clsNum = cls.replace(/\D/g, '');
            if (gradeNum && clsNum)
                return gradeNum === clsNum;
            return (cls.toLowerCase().trim() === requirementGrade.toLowerCase().trim());
        });
        return {
            score: isMatch ? 100 : 0,
            details: { requirementGrade, teacherClasses, isMatch },
        };
    }
    static calculateBoardScore(requirementBoard, teacherBoards) {
        if (!requirementBoard) {
            return { score: 0, details: { requirementBoard: '', teacherBoards, isMatch: false } };
        }
        const isMatch = teacherBoards.some(board => board.toLowerCase().includes(requirementBoard.toLowerCase()) ||
            requirementBoard.toLowerCase().includes(board.toLowerCase()));
        return {
            score: isMatch ? 100 : 0,
            details: { requirementBoard, teacherBoards, isMatch },
        };
    }
    static calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = this.toRadians(lat2 - lat1);
        const dLon = this.toRadians(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRadians(lat1)) *
                Math.cos(this.toRadians(lat2)) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    static toRadians(deg) {
        return deg * (Math.PI / 180);
    }
    static calculateLocationScore(reqLocation, teacherLocation) {
        let distance = 0;
        let isWithinRadius = false;
        const hasGPS = reqLocation.coordinates?.latitude &&
            reqLocation.coordinates?.longitude &&
            teacherLocation.coordinates?.latitude &&
            teacherLocation.coordinates?.longitude;
        if (hasGPS) {
            distance = this.calculateDistance(reqLocation.coordinates.latitude, reqLocation.coordinates.longitude, teacherLocation.coordinates.latitude, teacherLocation.coordinates.longitude);
            const effectiveRadius = Math.min(teacherLocation.teachingRadius || 10, reqLocation.teachingRadius || 10);
            isWithinRadius = distance <= effectiveRadius;
        }
        else {
            isWithinRadius =
                (reqLocation.city || '').toLowerCase() === (teacherLocation.city || '').toLowerCase();
        }
        let score = 0;
        if (isWithinRadius) {
            if (distance <= 2)
                score = 100;
            else if (distance <= 5)
                score = 90;
            else if (distance <= 10)
                score = 80;
            else
                score = 70;
        }
        else if (distance > 0 && distance <= MAX_DISTANCE_KM) {
            score = 50;
        }
        else if (!hasGPS && isWithinRadius) {
            score = 80;
        }
        else {
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
    static calculateBudgetScore(reqBudget, teacherRate, teacherNegotiationAllowed) {
        const min = reqBudget.minAmount || 0;
        const max = reqBudget.maxAmount || 0;
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
            const deviation = Math.abs(teacherRate - midPoint) / range;
            score = Math.round(100 - deviation * 20);
        }
        else if (teacherRate < max * 1.2) {
            const negotiable = reqBudget.negotiationAllowed || teacherNegotiationAllowed;
            score = negotiable ? 70 : 55;
        }
        else {
            score = 30;
        }
        return {
            score,
            details: { requirementMinBudget: min, requirementMaxBudget: max, teacherHourlyRate: teacherRate, isWithinBudget },
        };
    }
    static calculateModeScore(reqMode, teacherModes) {
        const acceptableModes = MODE_MAP[reqMode] || [];
        const isMatch = teacherModes.some(mode => acceptableModes.includes(mode.toLowerCase()));
        return {
            score: isMatch ? 100 : 0,
            details: { requirementMode: reqMode, teacherModes, isMatch },
        };
    }
    static calculateTimingScore(reqSchedule, teacherAvailability) {
        const reqTimeSlots = reqSchedule.preferredTimings || [];
        const teacherTimeSlots = teacherAvailability.availableTimeSlots || [];
        const timeOverlap = reqTimeSlots.filter(slot => teacherTimeSlots.some(teacherSlot => teacherSlot.toLowerCase().includes(slot.toLowerCase()) ||
            slot.toLowerCase().includes(teacherSlot.toLowerCase())));
        const timeScore = reqTimeSlots.length > 0
            ? (timeOverlap.length / reqTimeSlots.length) * 100
            : 50;
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
    static calculateBonusScore(requirement, teacher) {
        let genderScore = 0;
        const genderPref = requirement.studentDetails?.genderPreference || 'any';
        if (genderPref === 'any') {
            genderScore = 4;
        }
        else if (teacher.basicDetails?.gender === genderPref) {
            genderScore = 4;
        }
        else {
            genderScore = 0;
        }
        let languageScore = 0;
        const reqLangs = requirement.languagePreference || [];
        const teacherLangs = teacher.basicDetails?.languages || [];
        if (reqLangs.length === 0) {
            languageScore = 3;
        }
        else {
            const matched = reqLangs.filter(lang => teacherLangs.some(tl => tl.toLowerCase().includes(lang.toLowerCase())));
            languageScore = Math.round((matched.length / reqLangs.length) * 3);
        }
        const expYears = teacher.pricingRevenue?.experienceYears || 0;
        let experienceScore = 0;
        if (expYears >= 10)
            experienceScore = 3;
        else if (expYears >= 5)
            experienceScore = 2;
        else if (expYears >= 2)
            experienceScore = 1;
        const totalBonus = genderScore + languageScore + experienceScore;
        return {
            bonus: totalBonus,
            details: { genderScore, languageScore, experienceScore, totalBonus },
        };
    }
    static async generateMatchesForRequirement(requirement, limit = 20) {
        const subjectFilter = requirement.subjects?.length
            ? { 'teachingDetails.subjects': { $in: requirement.subjects } }
            : {};
        const cityFilter = requirement.location?.city
            ? { 'locationAvailability.city': { $regex: new RegExp(requirement.location.city, 'i') } }
            : {};
        const teachers = await TeacherProfile_1.TeacherProfile.find({
            isVerified: true,
            isActive: true,
            isBlocked: false,
            'locationAvailability.vacationMode': false,
            ...subjectFilter,
            ...cityFilter,
        });
        const existingMatches = await TutorMatch_1.TutorMatch.find({ requirementId: requirement._id }, { teacherId: 1 }).lean();
        const existingTeacherIds = new Set(existingMatches.map(m => m.teacherId.toString()));
        const matches = [];
        for (const teacher of teachers) {
            if (existingTeacherIds.has(teacher.userId.toString()))
                continue;
            const subjectResult = this.calculateSubjectScore(requirement.subjects, teacher.teachingDetails.subjects);
            const classResult = this.calculateClassScore(requirement.studentDetails.grade, teacher.teachingDetails.classes);
            const boardResult = this.calculateBoardScore(requirement.studentDetails.board, teacher.teachingDetails.boards);
            const locationResult = this.calculateLocationScore(requirement.location, teacher.locationAvailability);
            const budgetResult = this.calculateBudgetScore(requirement.budget, teacher.pricingRevenue.hourlyRate, teacher.pricingRevenue.negotiationAllowed);
            const modeResult = this.calculateModeScore(requirement.tuitionType, teacher.teachingDetails.teachingModes);
            const timingResult = this.calculateTimingScore(requirement.schedule, teacher.locationAvailability);
            const bonusResult = this.calculateBonusScore(requirement, teacher);
            const coreScore = subjectResult.score * WEIGHTS.subject +
                classResult.score * WEIGHTS.class +
                boardResult.score * WEIGHTS.board +
                locationResult.score * WEIGHTS.location +
                budgetResult.score * WEIGHTS.budget +
                modeResult.score * WEIGHTS.mode +
                timingResult.score * WEIGHTS.timing;
            const overallScore = Math.min(100, Math.round(coreScore + bonusResult.bonus));
            if (overallScore >= 30) {
                matches.push({
                    requirementId: requirement._id,
                    teacherId: teacher.userId,
                    teacherProfileId: teacher._id,
                    parentId: requirement.parentId,
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
    static async saveMatches(matches) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 7);
        for (const match of matches) {
            try {
                await TutorMatch_1.TutorMatch.create({
                    requirementId: match.requirementId,
                    teacherId: match.teacherId,
                    teacherProfileId: match.teacherProfileId,
                    parentId: match.parentId,
                    overallScore: match.overallScore,
                    breakdown: match.breakdown,
                    algorithmVersion: ALGORITHM_VERSION,
                    status: 'recommended',
                    expiryDate,
                });
            }
            catch (error) {
                if (error.code !== 11000) {
                    console.error('Error saving match:', error);
                }
            }
        }
    }
    static async generateAndSaveForRequirement(requirement) {
        const matches = await this.generateMatchesForRequirement(requirement, 20);
        await this.saveMatches(matches);
        return matches.length;
    }
    static async expireCompetingMatches(requirementId, winnerTeacherId) {
        await TutorMatch_1.TutorMatch.updateMany({
            requirementId,
            teacherId: { $ne: winnerTeacherId },
            status: { $in: ['recommended', 'viewed', 'applied'] },
        }, {
            status: 'expired',
            isActive: false,
        });
    }
    static async resetMatchOnWithdrawal(requirementId, teacherId) {
        await TutorMatch_1.TutorMatch.findOneAndUpdate({ requirementId, teacherId }, { status: 'recommended' });
    }
    static async cleanupExpiredMatches() {
        const result = await TutorMatch_1.TutorMatch.updateMany({
            expiryDate: { $lt: new Date() },
            isActive: true,
            status: { $nin: ['hired', 'expired'] },
        }, { status: 'expired', isActive: false });
        return result.modifiedCount;
    }
    static async getMatchesForTeacher(teacherId, status) {
        const query = {
            teacherId,
            isActive: true,
            expiryDate: { $gte: new Date() },
        };
        if (status)
            query.status = status;
        return TutorMatch_1.TutorMatch.find(query)
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
    static async getMatchesForRequirement(requirementId, status) {
        const query = { requirementId, isActive: true };
        if (status)
            query.status = status;
        return TutorMatch_1.TutorMatch.find(query)
            .populate({
            path: 'teacherProfileId',
            select: 'basicDetails.fullName basicDetails.profilePhoto teachingDetails.subjects teachingDetails.classes pricingRevenue.hourlyRate stats.averageRating',
        })
            .sort({ overallScore: -1 });
    }
    static async updateMatchStatus(matchId, status, updateFields) {
        const update = { status, ...updateFields };
        switch (status) {
            case 'viewed':
                update.viewedAt = new Date();
                break;
            case 'applied':
                update.appliedAt = new Date();
                break;
            case 'shortlisted':
                update.shortlistedAt = new Date();
                break;
            case 'rejected':
                update.rejectedAt = new Date();
                break;
            case 'hired':
                update.hiredAt = new Date();
                break;
        }
        await TutorMatch_1.TutorMatch.findOneAndUpdate({ matchId }, update);
    }
    static async runMatchingEngine() {
        console.log('[MatchingEngine] Starting batch run...');
        const cleaned = await this.cleanupExpiredMatches();
        console.log(`[MatchingEngine] Cleaned ${cleaned} expired matches`);
        const requirements = await ParentRequirement_1.ParentRequirement.find({
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
            }
            catch (error) {
                console.error(`[MatchingEngine] Error for req ${requirement.requirementId}:`, error);
            }
        }
        console.log(`[MatchingEngine] Complete — processed ${processed}, total new matches ${totalMatches}`);
        return { processed, totalMatches };
    }
}
exports.MatchingService = MatchingService;
exports.default = MatchingService;
//# sourceMappingURL=MatchingService.js.map