import { Response } from 'express';
import mongoose from 'mongoose';
import { Course, ICourse, ICourseLesson } from '../models/Course';
import { CourseEnrollment } from '../models/CourseEnrollment';
import { AuthRequest } from '../middleware/auth';
import { createLessonPlaybackUrl, formatFileSize } from '../services/courseVideoService';
import { resolveParentCourseAccess, isParentEnrolled } from '../services/courseAccessService';

// Express 5 types route params as `string | string[]`, so narrow before use.
const isValidId = (id?: unknown): id is string =>
  typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);

/** Only published lessons are ever exposed to a parent. */
const visibleLessons = (course: ICourse): ICourseLesson[] =>
  (course.lessons as unknown as ICourseLesson[])
    .filter((lesson) => lesson.isPublished)
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));

/**
 * Lesson shape for parents. Carries no storage key and no playback URL — the
 * URL is issued only by the dedicated playback endpoint after an access check.
 */
const formatPublicLesson = (lesson: ICourseLesson, hasAccess: boolean) => {
  const video = lesson.video;
  const videoReady = video?.status === 'ready';

  return {
    _id: lesson._id.toString(),
    title: lesson.title,
    description: lesson.description,
    order: lesson.order,
    isFreePreview: lesson.isFreePreview,
    hasVideo: Boolean(video),
    videoStatus: video?.status ?? null,
    videoDuration: videoReady ? video?.duration ?? null : null,
    videoSizeLabel: videoReady && video ? formatFileSize(video.size) : null,
    // Whether THIS parent may play it right now.
    isPlayable: Boolean(videoReady && (hasAccess || lesson.isFreePreview)),
    isLocked: Boolean(videoReady && !hasAccess && !lesson.isFreePreview),
  };
};

const formatPublicCourse = (
  course: ICourse,
  options: { isEnrolled: boolean; includeLessons: boolean }
) => {
  const lessons = visibleLessons(course);
  const readyVideos = lessons.filter((l) => l.video?.status === 'ready');
  const hasAccess = options.isEnrolled || course.accessType === 'free';

  return {
    _id: course._id.toString(),
    title: course.title,
    description: course.description,
    categoryId: course.categoryId,
    level: course.level,
    thumbnailUrl: course.thumbnailUrl,
    accessType: course.accessType,
    price: course.price,
    currency: course.currency,
    enrollmentCount: course.enrollmentCount,
    lessonCount: lessons.length,
    videoCount: readyVideos.length,
    totalDurationSeconds: readyVideos.reduce((sum, l) => sum + (l.video?.duration || 0), 0),
    isEnrolled: options.isEnrolled,
    publishedAt: course.publishedAt?.toISOString(),
    ...(options.includeLessons
      ? { lessons: lessons.map((l) => formatPublicLesson(l, hasAccess)) }
      : {}),
  };
};

/**
 * GET /api/courses
 * Published courses for the parent Course Marketplace.
 */
export const listPublishedCourses = async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
    const { categoryId, search } = req.query as Record<string, string | undefined>;

    const filter: Record<string, any> = { isActive: true, isPublished: true };
    if (categoryId) filter.categoryId = categoryId;
    if (search) filter.title = { $regex: String(search).slice(0, 80), $options: 'i' };

    const [courses, total] = await Promise.all([
      Course.find(filter).sort({ publishedAt: -1, updatedAt: -1 }).skip((page - 1) * limit).limit(limit),
      Course.countDocuments(filter),
    ]);

    const enrolledIds = new Set(
      (
        await CourseEnrollment.find({
          parentId: req.user._id,
          status: 'active',
          courseId: { $in: courses.map((c) => c._id) },
        }).select('courseId')
      ).map((e) => e.courseId.toString())
    );

    // Course counts per category so the existing category grid can show real numbers.
    const categoryCounts = await Course.aggregate([
      { $match: { isActive: true, isPublished: true } },
      { $group: { _id: '$categoryId', count: { $sum: 1 } } },
    ]);

    return res.status(200).json({
      success: true,
      data: {
        courses: courses.map((course) =>
          formatPublicCourse(course, {
            isEnrolled: enrolledIds.has(course._id.toString()),
            includeLessons: false,
          })
        ),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        categoryCounts: categoryCounts.reduce<Record<string, number>>((acc, row) => {
          acc[row._id] = row.count;
          return acc;
        }, {}),
      },
    });
  } catch (error: any) {
    console.error('List published courses error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load courses',
      error: error.message,
    });
  }
};

/**
 * GET /api/courses/:courseId
 * Course detail with its published lessons.
 */
export const getPublishedCourse = async (req: AuthRequest, res: Response) => {
  try {
    const { courseId } = req.params;

    if (!isValidId(courseId)) {
      return res.status(400).json({ success: false, message: 'Invalid course ID' });
    }

    const course = await Course.findOne({ _id: courseId, isActive: true, isPublished: true });
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    const enrolled = await isParentEnrolled(course._id, req.user._id);

    return res.status(200).json({
      success: true,
      data: {
        course: formatPublicCourse(course, { isEnrolled: enrolled, includeLessons: true }),
      },
    });
  } catch (error: any) {
    console.error('Get published course error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load course',
      error: error.message,
    });
  }
};

/**
 * GET /api/courses/:courseId/lessons/:lessonId/playback
 *
 * Issues a temporary signed playback URL. Every guard below must pass:
 *   1. parent is authenticated  (route middleware)
 *   2. course exists, is active and is published
 *   3. lesson belongs to that course
 *   4. lesson is published
 *   5. parent is authorized for the course (or the lesson is a free preview)
 *   6. the video exists, is ready, and its stored object is present
 *
 * The S3 key is resolved server-side from the lesson document — a client can
 * never name an object to be signed.
 */
export const getLessonPlayback = async (req: AuthRequest, res: Response) => {
  try {
    const { courseId, lessonId } = req.params;

    if (!isValidId(courseId) || !isValidId(lessonId)) {
      return res.status(400).json({ success: false, message: 'Invalid course or lesson ID' });
    }

    const course = await Course.findOne({ _id: courseId, isActive: true, isPublished: true });
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    const lesson = (course.lessons as any).id(lessonId) as ICourseLesson | null;
    if (!lesson) {
      return res.status(404).json({ success: false, message: 'Lesson not found in this course' });
    }

    if (!lesson.isPublished) {
      return res.status(404).json({ success: false, message: 'This lesson is not available yet' });
    }

    const access = await resolveParentCourseAccess(course, req.user._id, { lesson });
    if (!access.allowed) {
      return res.status(access.statusCode).json({
        success: false,
        message: access.message || 'You do not have access to this course',
      });
    }

    const playback = await createLessonPlaybackUrl(course, lesson);
    if (!playback.success) {
      return res.status(playback.statusCode).json({
        success: false,
        message: playback.message,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        lessonId: lesson._id.toString(),
        courseId: course._id.toString(),
        title: lesson.title,
        description: lesson.description,
        playbackUrl: playback.playbackUrl,
        expiresAt: playback.expiresAt,
        expiresInSeconds: playback.expiresInSeconds,
        duration: lesson.video?.duration ?? null,
        mimeType: lesson.video?.mimeType,
      },
    });
  } catch (error: any) {
    console.error('Lesson playback error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to prepare video playback',
      error: error.message,
    });
  }
};
