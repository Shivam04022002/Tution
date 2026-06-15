import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Review } from '../models/Review';
import { TeacherProfile } from '../models/TeacherProfile';
import { DemoClass } from '../models/DemoClass';
import { TutorApplication } from '../models/TutorApplication';

// ── Helper: recalculate and persist tutor stats ───────────────────────────────
async function syncTutorRatingStats(tutorId: mongoose.Types.ObjectId | string) {
  const agg = await Review.aggregate([
    { $match: { tutorId: new mongoose.Types.ObjectId(tutorId as string), isActive: true } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
        r1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
        r2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
        r3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
        r4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
        r5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
      },
    },
  ]);

  const stats =
    agg.length > 0
      ? {
          averageRating: Math.round(agg[0].averageRating * 10) / 10,
          totalReviews: agg[0].totalReviews,
          ratingBreakdown: {
            1: agg[0].r1,
            2: agg[0].r2,
            3: agg[0].r3,
            4: agg[0].r4,
            5: agg[0].r5,
          },
        }
      : { averageRating: 0, totalReviews: 0, ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };

  await TeacherProfile.findByIdAndUpdate(tutorId, {
    $set: {
      'stats.averageRating': stats.averageRating,
      'stats.totalReviews': stats.totalReviews,
      'stats.ratingBreakdown': stats.ratingBreakdown,
    },
  });

  return stats;
}

// ── Helper: verify parent eligibility ────────────────────────────────────────
async function isParentEligible(
  parentId: mongoose.Types.ObjectId | string,
  tutorId: mongoose.Types.ObjectId | string
): Promise<{ eligible: boolean; source: 'demo_completed' | 'active_relationship' | null }> {
  const completedDemo = await DemoClass.findOne({
    parentId: new mongoose.Types.ObjectId(parentId as string),
    teacherProfileId: new mongoose.Types.ObjectId(tutorId as string),
    status: 'completed',
    isActive: true,
  });

  if (completedDemo) return { eligible: true, source: 'demo_completed' };

  const activeRelationship = await TutorApplication.findOne({
    parentId: new mongoose.Types.ObjectId(parentId as string),
    teacherProfileId: new mongoose.Types.ObjectId(tutorId as string),
    status: 'accepted' as any,
    isActive: true,
  });

  if (activeRelationship) return { eligible: true, source: 'active_relationship' };

  return { eligible: false, source: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/tutors/:id/reviews
// ─────────────────────────────────────────────────────────────────────────────
export const getTutorReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const tutorId = req.params.id as string;
    const {
      page = '1',
      limit = '10',
      sort = 'newest',
      rating: ratingFilter,
    } = req.query;

    if (!mongoose.Types.ObjectId.isValid(tutorId)) {
      res.status(400).json({ success: false, message: 'Invalid tutor id' });
      return;
    }

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const matchStage: any = {
      tutorId: new mongoose.Types.ObjectId(String(tutorId)),
      isActive: true,
    };

    if (ratingFilter) {
      const ratingNum = parseInt(ratingFilter as string, 10);
      if (![1, 2, 3, 4, 5].includes(ratingNum)) {
        res.status(400).json({ success: false, message: 'Rating filter must be 1-5' });
        return;
      }
      matchStage.rating = ratingNum;
    }

    const sortStage: any =
      sort === 'highest'
        ? { rating: -1, createdAt: -1 }
        : sort === 'lowest'
        ? { rating: 1, createdAt: -1 }
        : sort === 'helpful'
        ? { helpfulVotes: -1, createdAt: -1 }
        : { createdAt: -1 };

    const [reviews, total] = await Promise.all([
      Review.find(matchStage)
        .sort(sortStage)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Review.countDocuments(matchStage),
    ]);

    res.status(200).json({
      success: true,
      data: {
        reviews,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
          hasMore: pageNum * limitNum < total,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch reviews' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/tutors/:id/ratings
// ─────────────────────────────────────────────────────────────────────────────
export const getTutorRatings = async (req: Request, res: Response): Promise<void> => {
  try {
    const tutorId = String(req.params.id);

    if (!mongoose.Types.ObjectId.isValid(tutorId)) {
      res.status(400).json({ success: false, message: 'Invalid tutor id' });
      return;
    }

    const freshStats = await syncTutorRatingStats(tutorId);
    const tutor = await TeacherProfile.findById(tutorId)
      .select('stats.averageRating stats.totalReviews stats.ratingBreakdown basicDetails.fullName')
      .lean();

    if (!tutor) {
      res.status(404).json({ success: false, message: 'Tutor not found' });
      return;
    }

    const stats = (tutor as any).stats || freshStats;
    const rawBreakdown = stats.ratingBreakdown || freshStats.ratingBreakdown;
    const breakdown: Record<string, number> = rawBreakdown instanceof Map ? Object.fromEntries(rawBreakdown) : rawBreakdown || {
      1: 0, 2: 0, 3: 0, 4: 0, 5: 0,
    };
    const total: number = stats.totalReviews || freshStats.totalReviews || 0;

    const breakdownWithPercent = Object.entries(breakdown).reduce(
      (acc, [star, count]) => {
        acc[star] = {
          count: count as number,
          percentage: total > 0 ? Math.round(((count as number) / total) * 100) : 0,
        };
        return acc;
      },
      {} as Record<string, { count: number; percentage: number }>
    );

    res.status(200).json({
      success: true,
      data: {
        averageRating: stats.averageRating || freshStats.averageRating || 0,
        totalReviews: total,
        breakdown: breakdownWithPercent,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch ratings' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tutors/:id/reviews
// ─────────────────────────────────────────────────────────────────────────────
export const createReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const tutorId = String(req.params.id);
    const parentId = (req as any).user._id;
    const parentName = (req as any).user.name || (req as any).user.fullName || 'Parent';

    if (!mongoose.Types.ObjectId.isValid(tutorId)) {
      res.status(400).json({ success: false, message: 'Invalid tutor id' });
      return;
    }

    const { rating, reviewText, subject, studentClass } = req.body;

    if (!rating || !reviewText || !subject || !studentClass) {
      res.status(400).json({ success: false, message: 'rating, reviewText, subject and studentClass are required' });
      return;
    }

    const ratingNum = parseInt(rating, 10);
    if (![1, 2, 3, 4, 5].includes(ratingNum)) {
      res.status(400).json({ success: false, message: 'Rating must be 1-5' });
      return;
    }

    if (reviewText.trim().length < 10 || reviewText.trim().length > 1000) {
      res.status(400).json({ success: false, message: 'Review text must be at least 10 characters' });
      return;
    }
    if (subject.trim().length < 2 || studentClass.trim().length < 1) {
      res.status(400).json({ success: false, message: 'Subject and class are required' });
      return;
    }

    const tutor = await TeacherProfile.findById(tutorId);
    if (!tutor) {
      res.status(404).json({ success: false, message: 'Tutor not found' });
      return;
    }

    const existing = await Review.findOne({
      tutorId: new mongoose.Types.ObjectId(String(tutorId)),
      parentId: new mongoose.Types.ObjectId(String(parentId)),
      isActive: true,
    });
    if (existing) {
      res.status(409).json({ success: false, message: 'You have already reviewed this tutor. Please edit your existing review.' });
      return;
    }

    const eligibility = await isParentEligible(String(parentId), String(tutorId));
    if (!eligibility.eligible) {
      res.status(403).json({
        success: false,
        message: 'You can only review tutors you have had a completed demo class or active tutor relationship with.',
      });
      return;
    }

    const review = new Review({
      tutorId: new mongoose.Types.ObjectId(String(tutorId)),
      parentId: new mongoose.Types.ObjectId(String(parentId)),
      rating: ratingNum,
      reviewText: reviewText.trim(),
      subject: subject.trim(),
      studentClass: studentClass.trim(),
      parentName,
      isVerified: true,
      verificationSource: eligibility.source!,
    });

    await review.save();
    await syncTutorRatingStats(tutorId);

    res.status(201).json({ success: true, message: 'Review submitted successfully', data: review });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(409).json({ success: false, message: 'You have already reviewed this tutor.' });
      return;
    }
    res.status(500).json({ success: false, message: error.message || 'Failed to create review' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/reviews/:id
// ─────────────────────────────────────────────────────────────────────────────
export const updateReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const reviewId = req.params.id as string;
    const parentId = (req as any).user._id;
    const { rating, reviewText, subject, studentClass } = req.body;

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      res.status(400).json({ success: false, message: 'Invalid review id' });
      return;
    }

    const review = await Review.findOne({
      _id: reviewId,
      parentId: new mongoose.Types.ObjectId(parentId),
      isActive: true,
    });

    if (!review) {
      res.status(404).json({ success: false, message: 'Review not found or you do not have permission to edit it.' });
      return;
    }

    if (rating !== undefined) {
      const ratingNum = parseInt(rating, 10);
      if (![1, 2, 3, 4, 5].includes(ratingNum)) {
        res.status(400).json({ success: false, message: 'Rating must be 1-5' });
        return;
      }
      review.rating = ratingNum as 1 | 2 | 3 | 4 | 5;
    }

    if (reviewText !== undefined) {
      if (reviewText.trim().length < 10 || reviewText.trim().length > 1000) {
        res.status(400).json({ success: false, message: 'Review text must be 10-1000 characters' });
        return;
      }
      review.reviewText = reviewText.trim();
    }

    if (subject !== undefined && subject.trim().length >= 2) review.subject = subject.trim();
    if (studentClass !== undefined && studentClass.trim().length >= 1) review.studentClass = studentClass.trim();

    await review.save();
    await syncTutorRatingStats(review.tutorId);

    res.status(200).json({ success: true, message: 'Review updated successfully', data: review });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to update review' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/reviews/:id
// ─────────────────────────────────────────────────────────────────────────────
export const deleteReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const reviewId = req.params.id as string;
    const parentId = (req as any).user._id;
    const userRole = (req as any).user.role;

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      res.status(400).json({ success: false, message: 'Invalid review id' });
      return;
    }

    const query: any = { _id: reviewId, isActive: true };
    if (userRole !== 'admin') {
      query.parentId = new mongoose.Types.ObjectId(parentId);
    }

    const review = await Review.findOne(query);
    if (!review) {
      res.status(404).json({ success: false, message: 'Review not found or you do not have permission to delete it.' });
      return;
    }

    review.isActive = false;
    await review.save();
    await syncTutorRatingStats(review.tutorId);

    res.status(200).json({ success: true, message: 'Review deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to delete review' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/reviews/:id/respond  (tutor response)
// ─────────────────────────────────────────────────────────────────────────────
export const addTutorResponse = async (req: Request, res: Response): Promise<void> => {
  try {
    const reviewId = req.params.id as string;
    const userId = (req as any).user._id;
    const { text } = req.body;

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      res.status(400).json({ success: false, message: 'Invalid review id' });
      return;
    }

    if (!text || text.trim().length < 5 || text.trim().length > 500) {
      res.status(400).json({ success: false, message: 'Response text must be 5-500 characters' });
      return;
    }

    const review = await Review.findOne({ _id: reviewId, isActive: true });
    if (!review) {
      res.status(404).json({ success: false, message: 'Review not found' });
      return;
    }

    const tutor = await TeacherProfile.findOne({ userId: new mongoose.Types.ObjectId(userId) });
    if (!tutor || tutor._id.toString() !== review.tutorId.toString()) {
      res.status(403).json({ success: false, message: 'Only the reviewed tutor can respond to this review.' });
      return;
    }

    review.tutorResponse = { text: text.trim(), respondedAt: new Date() };
    await review.save();

    res.status(200).json({ success: true, message: 'Response added successfully', data: review });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to add response' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/reviews/:id/helpful
// ─────────────────────────────────────────────────────────────────────────────
export const markReviewHelpful = async (req: Request, res: Response): Promise<void> => {
  try {
    const reviewId = req.params.id as string;
    const userId = (req as any).user?._id;

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      res.status(400).json({ success: false, message: 'Invalid review id' });
      return;
    }

    const review = await Review.findOneAndUpdate(
      {
        _id: reviewId,
        isActive: true,
        ...(userId ? { helpfulVoterIds: { $ne: new mongoose.Types.ObjectId(userId) } } : {}),
      },
      {
        $inc: { helpfulVotes: 1 },
        ...(userId ? { $addToSet: { helpfulVoterIds: new mongoose.Types.ObjectId(userId) } } : {}),
      },
      { new: true }
    );

    if (!review) {
      res.status(404).json({ success: false, message: 'Review not found' });
      return;
    }

    res.status(200).json({ success: true, data: { helpfulVotes: review.helpfulVotes } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to mark helpful' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/reviews/my  — parent's own reviews
// ─────────────────────────────────────────────────────────────────────────────
export const getMyReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const parentId = (req as any).user._id;

    const reviews = await Review.find({
      parentId: new mongoose.Types.ObjectId(parentId),
      isActive: true,
    })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ success: true, data: { reviews } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch reviews' });
  }
};
