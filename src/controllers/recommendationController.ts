import { Request, Response } from 'express';
import { TutorMatch } from '../models/TutorMatch';
import { TeacherProfile } from '../models/TeacherProfile';
import { ParentRequirement } from '../models/ParentRequirement';
import { AuthRequest } from '../middleware/auth';
import mongoose from 'mongoose';

// ─── Match Score Weights (as per Sprint 1.6 spec) ─────────────────────────────
const WEIGHTS = {
  subject: 0.40,     // 40%
  class: 0.20,       // 20%
  location: 0.15,    // 15%
  mode: 0.10,        // 10%
  experience: 0.10,  // 10%
  rating: 0.05,      // 5%
};

// ─── Types ───────────────────────────────────────────────────────────────────
export interface RecommendedTutor {
  _id: string;
  matchId: string;
  matchPercentage: number;
  teacherId: {
    _id: string;
    profile?: {
      teacherName?: string;
    };
  };
  teacherProfileId: {
    _id: string;
    basicDetails: {
      fullName: string;
      profilePhoto?: string;
      gender?: 'male' | 'female' | 'other';
      languages?: string[];
    };
    teachingDetails: {
      subjects: string[];
      classes: string[];
      teachingModes: string[];
      specialization?: string;
    };
    education: {
      highestQualification: string;
      degree: string;
      university: string;
    };
    locationAvailability: {
      city: string;
      address?: string;
      coordinates?: {
        latitude: number;
        longitude: number;
      };
      teachingRadius: number;
    };
    pricingRevenue: {
      hourlyRate: number;
      monthlyRate: number;
      experienceYears: number;
    };
    stats: {
      averageRating: number;
      totalReviews: number;
      totalStudents: number;
      responseRate: number;
    };
    bio?: string;
    verificationStatus: 'pending' | 'verified' | 'rejected';
  };
  breakdown: {
    subjectScore: number;
    classScore: number;
    locationScore: number;
    modeScore: number;
    experienceScore: number;
    ratingScore: number;
  };
  requirementId?: string;
  status: 'recommended' | 'viewed' | 'applied' | 'shortlisted' | 'rejected' | 'hired' | 'expired';
  viewedAt?: Date;
  distanceKm?: number;
}

// ─── Get Recommendations for Parent ───────────────────────────────────────────
export const getRecommendedTutors = async (req: AuthRequest, res: Response) => {
  try {
    const parentId = req.user?._id;
    if (!parentId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Parse query params
    const {
      requirementId,
      subject,
      class: classFilter,
      gender,
      minExperience,
      minRating,
      mode,
      city,
      sortBy = 'match',
      page = 1,
      limit = 20,
    } = req.query;

    const skip = (Math.max(1, parseInt(page as string)) - 1) * Math.min(50, parseInt(limit as string) || 20);
    const pageLimit = Math.min(50, Math.max(1, parseInt(limit as string) || 20));

    // Build base query
    const matchQuery: any = {
      parentId,
      isActive: true,
      expiryDate: { $gte: new Date() },
      status: { $in: ['recommended', 'viewed', 'shortlisted'] },
    };

    // Filter by specific requirement
    if (requirementId) {
      matchQuery.requirementId = new mongoose.Types.ObjectId(requirementId as string);
    }

    // Get matches with populated data
    let matches = await TutorMatch.find(matchQuery)
      .populate({
        path: 'teacherId',
        select: 'profile.teacherName',
      })
      .populate({
        path: 'teacherProfileId',
        select: 'basicDetails teachingDetails education locationAvailability pricingRevenue stats bio verificationStatus',
      })
      .populate({
        path: 'requirementId',
        select: 'requirementId studentDetails subjects tuitionType',
      })
      .sort({ overallScore: -1 })
      .lean();

    // Apply filters
    matches = matches.filter((match: any) => {
      const teacher = match.teacherProfileId;
      if (!teacher) return false;

      // Subject filter
      if (subject) {
        const subjects = teacher.teachingDetails?.subjects || [];
        if (!subjects.some((s: string) => s.toLowerCase().includes((subject as string).toLowerCase()))) {
          return false;
        }
      }

      // Class filter
      if (classFilter) {
        const classes = teacher.teachingDetails?.classes || [];
        if (!classes.includes(classFilter as string)) {
          return false;
        }
      }

      // Gender filter
      if (gender && teacher.basicDetails?.gender !== gender) {
        return false;
      }

      // Experience filter
      if (minExperience) {
        const exp = teacher.pricingRevenue?.experienceYears || 0;
        if (exp < parseInt(minExperience as string)) {
          return false;
        }
      }

      // Rating filter
      if (minRating) {
        const rating = teacher.stats?.averageRating || 0;
        if (rating < parseFloat(minRating as string)) {
          return false;
        }
      }

      // Mode filter
      if (mode) {
        const modes = teacher.teachingDetails?.teachingModes || [];
        const modeMap: Record<string, string[]> = {
          online: ['online'],
          offline: ['student_home', 'own_home'],
          hybrid: ['online', 'student_home', 'own_home'],
        };
        const allowedModes = modeMap[mode as string] || [mode as string];
        if (!modes.some((m: string) => allowedModes.includes(m))) {
          return false;
        }
      }

      // City filter
      if (city) {
        const teacherCity = teacher.locationAvailability?.city || '';
        if (!teacherCity.toLowerCase().includes((city as string).toLowerCase())) {
          return false;
        }
      }

      return true;
    });

    // Calculate total for pagination
    const total = matches.length;

    // Apply sorting (if not match score)
    if (sortBy !== 'match') {
      matches.sort((a: any, b: any) => {
        const teacherA = a.teacherProfileId;
        const teacherB = b.teacherProfileId;

        switch (sortBy) {
          case 'rating':
            return (teacherB?.stats?.averageRating || 0) - (teacherA?.stats?.averageRating || 0);
          case 'experience':
            return (teacherB?.pricingRevenue?.experienceYears || 0) - (teacherA?.pricingRevenue?.experienceYears || 0);
          case 'nearest':
            const distA = a.breakdown?.locationMatchDetails?.distance || 999;
            const distB = b.breakdown?.locationMatchDetails?.distance || 999;
            return distA - distB;
          case 'newest':
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          default:
            return (b.overallScore || 0) - (a.overallScore || 0);
        }
      });
    }

    // Apply pagination
    const paginatedMatches = matches.slice(skip, skip + pageLimit);

    // Transform to response format
    const recommendedTutors: RecommendedTutor[] = paginatedMatches.map((match: any) => ({
      _id: match._id.toString(),
      matchId: match.matchId,
      matchPercentage: Math.round(match.overallScore || 0),
      teacherId: match.teacherId,
      teacherProfileId: match.teacherProfileId,
      breakdown: {
        subjectScore: Math.round((match.breakdown?.subjectScore || 0) * WEIGHTS.subject),
        classScore: Math.round((match.breakdown?.classScore || 0) * WEIGHTS.class),
        locationScore: Math.round((match.breakdown?.locationScore || 0) * WEIGHTS.location),
        modeScore: Math.round((match.breakdown?.modeScore || 0) * WEIGHTS.mode),
        experienceScore: Math.round((match.breakdown?.bonusDetails?.experienceScore || 0) * WEIGHTS.experience),
        ratingScore: Math.round((match.teacherProfileId?.stats?.averageRating || 0) * 20 * WEIGHTS.rating),
      },
      requirementId: match.requirementId?.requirementId || match.requirementId?._id?.toString(),
      status: match.status,
      viewedAt: match.viewedAt,
      distanceKm: match.breakdown?.locationMatchDetails?.distance,
    }));

    return res.status(200).json({
      success: true,
      data: {
        tutors: recommendedTutors,
        pagination: {
          page: parseInt(page as string) || 1,
          limit: pageLimit,
          total,
          pages: Math.ceil(total / pageLimit),
        },
        filters: {
          sortBy,
          applied: {
            subject,
            class: classFilter,
            gender,
            minExperience,
            minRating,
            mode,
            city,
            requirementId,
          },
        },
      },
    });
  } catch (error) {
    console.error('Get recommended tutors error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch recommended tutors',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─── Get Single Recommendation Detail ─────────────────────────────────────────
export const getRecommendationById = async (req: AuthRequest, res: Response) => {
  try {
    const parentId = req.user?._id;
    const { id } = req.params;

    if (!parentId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const match = await TutorMatch.findOne({
      _id: id,
      parentId,
    })
      .populate({
        path: 'teacherId',
        select: 'profile.teacherName email',
      })
      .populate({
        path: 'teacherProfileId',
        select: 'basicDetails teachingDetails education locationAvailability pricingRevenue stats bio verificationDocuments verificationStatus',
      })
      .populate({
        path: 'requirementId',
        select: 'requirementId studentDetails subjects tuitionType budget location schedule',
      })
      .lean();

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Recommendation not found',
      });
    }

    // Mark as viewed if not already
    if (match.status === 'recommended') {
      await TutorMatch.findByIdAndUpdate(id, {
        status: 'viewed',
        viewedAt: new Date(),
      });
    }

    // Calculate detailed match breakdown
    const breakdown = match.breakdown;
    const teacher = match.teacherProfileId as any;

    const recommendation: RecommendedTutor & {
      requirement?: any;
      fullMatchAnalysis: {
        subject: {
          requirementSubjects: string[];
          teacherSubjects: string[];
          matchedSubjects: string[];
          score: number;
          weight: number;
        };
        class: {
          requirementClass: string;
          teacherClasses: string[];
          isMatch: boolean;
          score: number;
          weight: number;
        };
        location: {
          distance: number;
          isWithinRadius: boolean;
          score: number;
          weight: number;
        };
        mode: {
          requirementMode: string;
          teacherModes: string[];
          isMatch: boolean;
          score: number;
          weight: number;
        };
        experience: {
          years: number;
          score: number;
          weight: number;
        };
        rating: {
          value: number;
          totalReviews: number;
          score: number;
          weight: number;
        };
      };
    } = {
      _id: match._id.toString(),
      matchId: match.matchId,
      matchPercentage: Math.round(match.overallScore || 0),
      teacherId: match.teacherId as any,
      teacherProfileId: teacher,
      breakdown: {
        subjectScore: Math.round((breakdown?.subjectScore || 0) * WEIGHTS.subject),
        classScore: Math.round((breakdown?.classScore || 0) * WEIGHTS.class),
        locationScore: Math.round((breakdown?.locationMatchDetails?.isWithinRadius ? breakdown?.locationScore : 0) * WEIGHTS.location),
        modeScore: Math.round((breakdown?.modeScore || 0) * WEIGHTS.mode),
        experienceScore: Math.round((breakdown?.bonusDetails?.experienceScore || 0) * WEIGHTS.experience),
        ratingScore: Math.round((teacher?.stats?.averageRating || 0) * 20 * WEIGHTS.rating),
      },
      requirementId: (match.requirementId as any)?.requirementId,
      status: match.status === 'recommended' ? 'viewed' : match.status,
      viewedAt: match.viewedAt || new Date(),
      distanceKm: breakdown?.locationMatchDetails?.distance,
      requirement: match.requirementId,
      fullMatchAnalysis: {
        subject: {
          requirementSubjects: breakdown?.subjectMatchDetails?.requirementSubjects || [],
          teacherSubjects: breakdown?.subjectMatchDetails?.teacherSubjects || [],
          matchedSubjects: breakdown?.subjectMatchDetails?.matchedSubjects || [],
          score: breakdown?.subjectScore || 0,
          weight: WEIGHTS.subject,
        },
        class: {
          requirementClass: breakdown?.classMatchDetails?.requirementGrade || '',
          teacherClasses: breakdown?.classMatchDetails?.teacherClasses || [],
          isMatch: breakdown?.classMatchDetails?.isMatch || false,
          score: breakdown?.classScore || 0,
          weight: WEIGHTS.class,
        },
        location: {
          distance: breakdown?.locationMatchDetails?.distance || 0,
          isWithinRadius: breakdown?.locationMatchDetails?.isWithinRadius || false,
          score: breakdown?.locationScore || 0,
          weight: WEIGHTS.location,
        },
        mode: {
          requirementMode: breakdown?.modeMatchDetails?.requirementMode || '',
          teacherModes: breakdown?.modeMatchDetails?.teacherModes || [],
          isMatch: breakdown?.modeMatchDetails?.isMatch || false,
          score: breakdown?.modeScore || 0,
          weight: WEIGHTS.mode,
        },
        experience: {
          years: teacher?.pricingRevenue?.experienceYears || 0,
          score: breakdown?.bonusDetails?.experienceScore || 0,
          weight: WEIGHTS.experience,
        },
        rating: {
          value: teacher?.stats?.averageRating || 0,
          totalReviews: teacher?.stats?.totalReviews || 0,
          score: (teacher?.stats?.averageRating || 0) * 20,
          weight: WEIGHTS.rating,
        },
      },
    };

    return res.status(200).json({
      success: true,
      data: { recommendation },
    });
  } catch (error) {
    console.error('Get recommendation by ID error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch recommendation details',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─── Get Recommendations for Specific Requirement ────────────────────────────
export const getRecommendationsByRequirement = async (req: AuthRequest, res: Response) => {
  try {
    const parentId = req.user?._id;
    const { requirementId } = req.params;

    if (!parentId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // First get the requirement ObjectId
    const requirement = await ParentRequirement.findOne({
      requirementId,
      parentId,
    });

    if (!requirement) {
      return res.status(404).json({
        success: false,
        message: 'Requirement not found',
      });
    }

    const {
      subject,
      class: classFilter,
      gender,
      minExperience,
      minRating,
      mode,
      sortBy = 'match',
    } = req.query;

    // Get matches for this requirement
    let matches = await TutorMatch.find({
      requirementId: requirement._id,
      parentId,
      isActive: true,
      expiryDate: { $gte: new Date() },
    })
      .populate({
        path: 'teacherId',
        select: 'profile.teacherName',
      })
      .populate({
        path: 'teacherProfileId',
        select: 'basicDetails teachingDetails education locationAvailability pricingRevenue stats bio verificationStatus',
      })
      .sort({ overallScore: -1 })
      .lean();

    // Apply filters
    matches = matches.filter((match: any) => {
      const teacher = match.teacherProfileId;
      if (!teacher) return false;

      if (subject) {
        const subjects = teacher.teachingDetails?.subjects || [];
        if (!subjects.some((s: string) => s.toLowerCase().includes((subject as string).toLowerCase()))) {
          return false;
        }
      }
      if (classFilter) {
        const classes = teacher.teachingDetails?.classes || [];
        if (!classes.includes(classFilter as string)) return false;
      }
      if (gender && teacher.basicDetails?.gender !== gender) return false;
      if (minExperience) {
        const exp = teacher.pricingRevenue?.experienceYears || 0;
        if (exp < parseInt(minExperience as string)) return false;
      }
      if (minRating) {
        const rating = teacher.stats?.averageRating || 0;
        if (rating < parseFloat(minRating as string)) return false;
      }
      if (mode) {
        const modes = teacher.teachingDetails?.teachingModes || [];
        const modeMap: Record<string, string[]> = {
          online: ['online'],
          offline: ['student_home', 'own_home'],
          hybrid: ['online', 'student_home', 'own_home'],
        };
        const allowedModes = modeMap[mode as string] || [mode as string];
        if (!modes.some((m: string) => allowedModes.includes(m))) return false;
      }
      return true;
    });

    // Apply sorting
    if (sortBy !== 'match') {
      matches.sort((a: any, b: any) => {
        const teacherA = a.teacherProfileId;
        const teacherB = b.teacherProfileId;
        switch (sortBy) {
          case 'rating':
            return (teacherB?.stats?.averageRating || 0) - (teacherA?.stats?.averageRating || 0);
          case 'experience':
            return (teacherB?.pricingRevenue?.experienceYears || 0) - (teacherA?.pricingRevenue?.experienceYears || 0);
          case 'nearest':
            return (a.breakdown?.locationMatchDetails?.distance || 999) - (b.breakdown?.locationMatchDetails?.distance || 999);
          case 'newest':
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          default:
            return (b.overallScore || 0) - (a.overallScore || 0);
        }
      });
    }

    const recommendedTutors: RecommendedTutor[] = matches.map((match: any) => ({
      _id: match._id.toString(),
      matchId: match.matchId,
      matchPercentage: Math.round(match.overallScore || 0),
      teacherId: match.teacherId,
      teacherProfileId: match.teacherProfileId,
      breakdown: {
        subjectScore: Math.round((match.breakdown?.subjectScore || 0) * WEIGHTS.subject),
        classScore: Math.round((match.breakdown?.classScore || 0) * WEIGHTS.class),
        locationScore: Math.round((match.breakdown?.locationScore || 0) * WEIGHTS.location),
        modeScore: Math.round((match.breakdown?.modeScore || 0) * WEIGHTS.mode),
        experienceScore: Math.round((match.breakdown?.bonusDetails?.experienceScore || 0) * WEIGHTS.experience),
        ratingScore: Math.round((match.teacherProfileId?.stats?.averageRating || 0) * 20 * WEIGHTS.rating),
      },
      requirementId: requirement.requirementId,
      status: match.status,
      viewedAt: match.viewedAt,
      distanceKm: match.breakdown?.locationMatchDetails?.distance,
    }));

    return res.status(200).json({
      success: true,
      data: {
        tutors: recommendedTutors,
        requirement: {
          _id: requirement._id,
          requirementId: requirement.requirementId,
          studentDetails: requirement.studentDetails,
          subjects: requirement.subjects,
          tuitionType: requirement.tuitionType,
          location: requirement.location,
        },
        total: recommendedTutors.length,
      },
    });
  } catch (error) {
    console.error('Get recommendations by requirement error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch recommendations',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─── Track Tutor Interaction (Analytics) ──────────────────────────────────────
export const trackTutorInteraction = async (req: AuthRequest, res: Response) => {
  try {
    const parentId = req.user?._id;
    const { matchId } = req.params;
    const { action } = req.body; // 'viewed', 'contacted', 'shortlisted', 'demo_requested'

    if (!parentId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const validActions = ['viewed', 'contacted', 'shortlisted', 'demo_requested'];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        message: `Invalid action. Valid actions: ${validActions.join(', ')}`,
      });
    }

    const match = await TutorMatch.findOne({
      matchId,
      parentId,
    });

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found',
      });
    }

    // Update status based on action
    if (action === 'shortlisted') {
      (match as any).status = 'shortlisted';
      match.shortlistedAt = new Date();
    }

    await match.save();

    return res.status(200).json({
      success: true,
      message: `Tutor ${action} tracked successfully`,
      data: { matchId, action },
    });
  } catch (error) {
    console.error('Track tutor interaction error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to track interaction',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
