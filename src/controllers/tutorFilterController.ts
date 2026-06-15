import { Request, Response } from 'express';
import { TeacherProfile } from '../models/TeacherProfile';
import { AuthRequest } from '../middleware/auth';

/**
 * Tutor Filter Controller
 * Sprint 2.3 - Advanced Tutor Filters
 * 
 * Provides multi-criteria filtering for tutor search:
 * - Subject (multi-select)
 * - Class/Grade (multi-select)
 * - Teaching Mode (online/offline/hybrid)
 * - Gender (male/female/any)
 * - Experience (ranges)
 * - Rating (minimum)
 * - Budget Range (min/max)
 * - Language (multi-select)
 * - Availability (weekdays/weekends/time slots)
 * - Location (city, area)
 */

export interface FilterQueryParams {
  // Multi-select filters (comma-separated)
  subjects?: string;
  classes?: string;
  languages?: string;
  
  // Single value filters
  mode?: string;
  gender?: string;
  city?: string;
  area?: string;
  
  // Range filters
  experience?: string; // 0-2, 3-5, 6-10, 10+
  rating?: string; // 4.5, 4.0, 3.5
  minBudget?: string;
  maxBudget?: string;
  
  // Availability filters
  availability?: string; // weekdays, weekends, morning, afternoon, evening
  
  // Pagination
  page?: string;
  limit?: string;
}

/**
 * Parse experience range to years
 */
function parseExperienceRange(experience: string): { min: number; max: number } | null {
  const ranges: Record<string, { min: number; max: number }> = {
    '0-2': { min: 0, max: 2 },
    '3-5': { min: 3, max: 5 },
    '6-10': { min: 6, max: 10 },
    '10+': { min: 10, max: 50 },
  };
  return ranges[experience] || null;
}

/**
 * Build MongoDB filter query from filter parameters
 */
function buildFilterQuery(params: FilterQueryParams): any {
  const query: any = {
    isActive: true,
    isVerified: true,
    isBlocked: false,
  };

  // Subjects (multi-select)
  if (params.subjects) {
    const subjects = params.subjects.split(',').map((s) => s.trim());
    query['teachingDetails.subjects'] = { $in: subjects };
  }

  // Classes (multi-select)
  if (params.classes) {
    const classes = params.classes.split(',').map((c) => c.trim());
    query['teachingDetails.classes'] = { $in: classes };
  }

  // Teaching Mode
  if (params.mode) {
    const modeMap: Record<string, string> = {
      online: 'online',
      offline: 'student_home',
      hybrid: 'group', // Hybrid maps to group or use preferred location
    };
    const modeValue = modeMap[params.mode.toLowerCase()] || params.mode;
    query['teachingDetails.teachingModes'] = { $in: [modeValue, params.mode.toLowerCase()] };
  }

  // Gender
  if (params.gender && params.gender !== 'any') {
    query['basicDetails.gender'] = params.gender.toLowerCase();
  }

  // Experience Range
  if (params.experience) {
    const range = parseExperienceRange(params.experience);
    if (range) {
      query['pricingRevenue.experienceYears'] = {
        $gte: range.min,
        $lte: range.max,
      };
    }
  }

  // Minimum Rating
  if (params.rating) {
    const minRating = parseFloat(params.rating);
    if (!isNaN(minRating)) {
      query['stats.averageRating'] = { $gte: minRating };
    }
  }

  // Budget Range (monthly rate)
  if (params.minBudget || params.maxBudget) {
    query['pricingRevenue.monthlyRate'] = {};
    if (params.minBudget) {
      query['pricingRevenue.monthlyRate'].$gte = parseInt(params.minBudget, 10);
    }
    if (params.maxBudget) {
      query['pricingRevenue.monthlyRate'].$lte = parseInt(params.maxBudget, 10);
    }
  }

  // Languages (multi-select)
  if (params.languages) {
    const languages = params.languages.split(',').map((l) => l.trim());
    query['basicDetails.languages'] = { $in: languages };
  }

  // Availability
  if (params.availability) {
    const availabilities = params.availability.split(',').map((a) => a.trim().toLowerCase());
    
    // Days availability
    const dayAvailabilities = availabilities.filter((a) => 
      ['weekdays', 'weekends'].includes(a)
    );
    if (dayAvailabilities.length > 0) {
      const days: string[] = [];
      if (dayAvailabilities.includes('weekdays')) {
        days.push('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday');
      }
      if (dayAvailabilities.includes('weekends')) {
        days.push('Saturday', 'Sunday');
      }
      if (days.length > 0) {
        query['locationAvailability.availableDays'] = { $in: days };
      }
    }

    // Time slot availability (stored in timeSlots)
    const timeAvailabilities = availabilities.filter((a) =>
      ['morning', 'afternoon', 'evening'].includes(a)
    );
    if (timeAvailabilities.length > 0) {
      // This is a simplified check - actual implementation would need time parsing
      query['locationAvailability.availableTimeSlots'] = { $exists: true, $ne: [] };
    }
  }

  // Location - City
  if (params.city) {
    query['locationAvailability.city'] = { 
      $regex: params.city, 
      $options: 'i' 
    };
  }

  // Location - Area (searches in preferredAreas and address)
  if (params.area) {
    query.$or = query.$or || [];
    query.$or.push(
      { 'locationAvailability.preferredAreas': { $regex: params.area, $options: 'i' } },
      { 'locationAvailability.address': { $regex: params.area, $options: 'i' } }
    );
  }

  return query;
}

/**
 * GET /api/tutors/filter
 * Filter tutors by multiple criteria with pagination
 */
export const filterTutors = async (req: AuthRequest, res: Response) => {
  try {
    const params: FilterQueryParams = req.query as FilterQueryParams;
    
    const pageNum = Math.max(1, parseInt(params.page || '1', 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(params.limit || '20', 10)));
    const skip = (pageNum - 1) * limitNum;

    const query = buildFilterQuery(params);

    // Execute filter with pagination
    const [tutors, total] = await Promise.all([
      TeacherProfile.find(query)
        .select('-verificationDocuments.aadhaarCard -verificationDocuments.panCard')
        .skip(skip)
        .limit(limitNum)
        .sort({ 'stats.averageRating': -1, createdAt: -1 })
        .lean(),
      TeacherProfile.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    // Build applied filters summary
    const appliedFilters: Record<string, any> = {};
    if (params.subjects) appliedFilters.subjects = params.subjects.split(',');
    if (params.classes) appliedFilters.classes = params.classes.split(',');
    if (params.mode) appliedFilters.mode = params.mode;
    if (params.gender && params.gender !== 'any') appliedFilters.gender = params.gender;
    if (params.experience) appliedFilters.experience = params.experience;
    if (params.rating) appliedFilters.rating = params.rating;
    if (params.minBudget || params.maxBudget) {
      appliedFilters.budget = {
        min: params.minBudget ? parseInt(params.minBudget, 10) : undefined,
        max: params.maxBudget ? parseInt(params.maxBudget, 10) : undefined,
      };
    }
    if (params.languages) appliedFilters.languages = params.languages.split(',');
    if (params.availability) appliedFilters.availability = params.availability.split(',');
    if (params.city) appliedFilters.city = params.city;
    if (params.area) appliedFilters.area = params.area;

    return res.status(200).json({
      success: true,
      data: {
        tutors,
        total,
        page: pageNum,
        totalPages,
        limit: limitNum,
        appliedFilters,
      },
    });
  } catch (error: any) {
    console.error('Tutor filter error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to filter tutors',
      error: error.message,
    });
  }
};

/**
 * GET /api/tutors/filter/options
 * Get available filter options (subjects, classes, cities, etc.)
 */
export const getFilterOptions = async (_req: Request, res: Response) => {
  try {
    const [subjects, classes, cities, languages, teachingModes] = await Promise.all([
      // Get unique subjects
      TeacherProfile.distinct('teachingDetails.subjects', {
        isActive: true,
        isVerified: true,
        isBlocked: false,
      }),
      // Get unique classes
      TeacherProfile.distinct('teachingDetails.classes', {
        isActive: true,
        isVerified: true,
        isBlocked: false,
      }),
      // Get unique cities
      TeacherProfile.distinct('locationAvailability.city', {
        isActive: true,
        isVerified: true,
        isBlocked: false,
      }),
      // Get unique languages
      TeacherProfile.distinct('basicDetails.languages', {
        isActive: true,
        isVerified: true,
        isBlocked: false,
      }),
      // Get unique teaching modes
      TeacherProfile.distinct('teachingDetails.teachingModes', {
        isActive: true,
        isVerified: true,
        isBlocked: false,
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        subjects: subjects.sort(),
        classes: classes.sort(),
        cities: cities.sort(),
        languages: languages.sort(),
        teachingModes: teachingModes.sort(),
        experienceRanges: [
          { value: '0-2', label: '0–2 Years', min: 0, max: 2 },
          { value: '3-5', label: '3–5 Years', min: 3, max: 5 },
          { value: '6-10', label: '6–10 Years', min: 6, max: 10 },
          { value: '10+', label: '10+ Years', min: 10, max: 50 },
        ],
        ratingOptions: [
          { value: '4.5', label: '4.5+ Stars', min: 4.5 },
          { value: '4.0', label: '4.0+ Stars', min: 4.0 },
          { value: '3.5', label: '3.5+ Stars', min: 3.5 },
        ],
        availabilityOptions: [
          { value: 'weekdays', label: 'Weekdays' },
          { value: 'weekends', label: 'Weekends' },
          { value: 'morning', label: 'Morning' },
          { value: 'afternoon', label: 'Afternoon' },
          { value: 'evening', label: 'Evening' },
        ],
        genderOptions: [
          { value: 'any', label: 'Any' },
          { value: 'male', label: 'Male' },
          { value: 'female', label: 'Female' },
        ],
      },
    });
  } catch (error: any) {
    console.error('Get filter options error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get filter options',
      error: error.message,
    });
  }
};

export default {
  filterTutors,
  getFilterOptions,
};
