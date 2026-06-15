import { Request, Response } from 'express';
import { TeacherProfile } from '../models/TeacherProfile';
import { AuthRequest } from '../middleware/auth';

/**
 * Tutor Search Controller
 * Sprint 2.2 - Tutor Search System
 * 
 * Provides text-based search across tutor profiles including:
 * - Tutor Name
 * - Subject
 * - City
 * - Area/Locality
 * - Qualification
 * - Language
 * - Teaching Mode
 */

export interface SearchQueryParams {
  q?: string;
  page?: string;
  limit?: string;
}

/**
 * Build search query for MongoDB
 * Searches across multiple fields with case-insensitive matching
 */
function buildSearchQuery(searchTerm: string): any {
  const trimmedTerm = searchTerm.trim();
  
  if (!trimmedTerm) {
    return { isActive: true, isVerified: true, isBlocked: false };
  }

  const regex = new RegExp(trimmedTerm, 'i');

  return {
    isActive: true,
    isVerified: true,
    isBlocked: false,
    $or: [
      // Tutor Name
      { 'basicDetails.fullName': regex },
      // Subject
      { 'teachingDetails.subjects': regex },
      { 'teachingDetails.specialization': regex },
      // City
      { 'locationAvailability.city': regex },
      // Area/Locality
      { 'locationAvailability.address': regex },
      { 'locationAvailability.preferredAreas': regex },
      { 'locationAvailability.preferredLocations.area': regex },
      // Qualification
      { 'education.highestQualification': regex },
      { 'education.degree': regex },
      { 'education.university': regex },
      // Language
      { 'basicDetails.languages': regex },
      // Teaching Mode
      { 'teachingDetails.teachingModes': regex },
      // Bio
      { 'bio': regex },
    ],
  };
}

/**
 * GET /api/tutors/search
 * Search tutors by text query with pagination
 */
export const searchTutors = async (req: AuthRequest, res: Response) => {
  try {
    const { q = '', page = '1', limit = '20' } = req.query as SearchQueryParams;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10))); // Cap at 50 per page
    const skip = (pageNum - 1) * limitNum;

    const query = buildSearchQuery(q);

    // Execute search with pagination
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

    return res.status(200).json({
      success: true,
      data: {
        tutors,
        total,
        page: pageNum,
        totalPages,
        limit: limitNum,
        query: q.trim(),
      },
    });
  } catch (error: any) {
    console.error('Tutor search error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to search tutors',
      error: error.message,
    });
  }
};

/**
 * GET /api/tutors/search/suggestions
 * Get search suggestions as user types (lightweight endpoint)
 */
export const getSearchSuggestions = async (req: AuthRequest, res: Response) => {
  try {
    const { q = '' } = req.query as { q?: string };

    if (!q.trim() || q.trim().length < 2) {
      return res.status(200).json({
        success: true,
        data: {
          suggestions: [],
        },
      });
    }

    const regex = new RegExp(q.trim(), 'i');
    const query = {
      isActive: true,
      isVerified: true,
      isBlocked: false,
      $or: [
        { 'basicDetails.fullName': regex },
        { 'teachingDetails.subjects': regex },
        { 'locationAvailability.city': regex },
      ],
    };

    // Get distinct values for suggestions
    const tutors = await TeacherProfile.find(query)
      .select('basicDetails.fullName teachingDetails.subjects locationAvailability.city')
      .limit(10)
      .lean();

    const suggestions = new Set<string>();
    
    tutors.forEach((tutor) => {
      if (tutor.basicDetails?.fullName?.toLowerCase().includes(q.trim().toLowerCase())) {
        suggestions.add(tutor.basicDetails.fullName);
      }
      tutor.teachingDetails?.subjects?.forEach((subject: string) => {
        if (subject.toLowerCase().includes(q.trim().toLowerCase())) {
          suggestions.add(subject);
        }
      });
      if (tutor.locationAvailability?.city?.toLowerCase().includes(q.trim().toLowerCase())) {
        suggestions.add(tutor.locationAvailability.city);
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        suggestions: Array.from(suggestions).slice(0, 8),
      },
    });
  } catch (error: any) {
    console.error('Search suggestions error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get suggestions',
      error: error.message,
    });
  }
};

/**
 * GET /api/tutors/search/popular
 * Get popular search terms (based on most common subjects, cities, qualifications)
 */
export const getPopularSearches = async (_req: Request, res: Response) => {
  try {
    // Aggregate to find popular subjects, cities, and qualifications
    const [subjects, cities, qualifications] = await Promise.all([
      TeacherProfile.aggregate([
        { $match: { isActive: true, isVerified: true, isBlocked: false } },
        { $unwind: '$teachingDetails.subjects' },
        { $group: { _id: '$teachingDetails.subjects', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
      TeacherProfile.aggregate([
        { $match: { isActive: true, isVerified: true, isBlocked: false } },
        { $group: { _id: '$locationAvailability.city', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
      TeacherProfile.aggregate([
        { $match: { isActive: true, isVerified: true, isBlocked: false } },
        { $group: { _id: '$education.highestQualification', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
    ]);

    const popularSearches = [
      ...subjects.map((s) => ({ term: s._id, type: 'subject', count: s.count })),
      ...cities.map((c) => ({ term: c._id, type: 'city', count: c.count })),
      ...qualifications.map((q) => ({ term: q._id, type: 'qualification', count: q.count })),
    ].sort((a, b) => b.count - a.count);

    return res.status(200).json({
      success: true,
      data: {
        popularSearches: popularSearches.slice(0, 12),
      },
    });
  } catch (error: any) {
    console.error('Popular searches error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get popular searches',
      error: error.message,
    });
  }
};

export default {
  searchTutors,
  getSearchSuggestions,
  getPopularSearches,
};
