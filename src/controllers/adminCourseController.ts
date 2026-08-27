import { Response } from 'express';
import mongoose from 'mongoose';
import { Course, ICourse, ICourseLesson } from '../models/Course';
import { CourseEnrollment } from '../models/CourseEnrollment';
import { AuthRequest } from '../middleware/auth';
import {
  uploadLessonVideo,
  deleteLessonVideo,
  deleteAllCourseVideos,
  formatLessonVideo,
  getVideoUploadLimits,
} from '../services/courseVideoService';
import { createSignedPlaybackUrl, removeTempFile } from '../config/awsConfig';

// Express 5 types route params as `string | string[]`, so narrow before use.
const isValidId = (id?: unknown): id is string =>
  typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);

const formatAdminLesson = (lesson: ICourseLesson) => ({
  _id: lesson._id.toString(),
  title: lesson.title,
  description: lesson.description,
  order: lesson.order,
  isPublished: lesson.isPublished,
  isFreePreview: lesson.isFreePreview,
  hasVideo: Boolean(lesson.video),
  video: formatLessonVideo(lesson.video),
  createdAt: lesson.createdAt?.toISOString(),
  updatedAt: lesson.updatedAt?.toISOString(),
});

const sortLessons = (lessons: ICourseLesson[]) =>
  [...lessons].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));

const formatAdminCourse = (course: ICourse, includeLessons = true) => {
  const lessons = sortLessons(course.lessons as unknown as ICourseLesson[]);
  const readyVideos = lessons.filter((l) => l.video?.status === 'ready');

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
    isPublished: course.isPublished,
    publishedAt: course.publishedAt?.toISOString(),
    isActive: course.isActive,
    enrollmentCount: course.enrollmentCount,
    lessonCount: lessons.length,
    publishedLessonCount: lessons.filter((l) => l.isPublished).length,
    videoCount: readyVideos.length,
    totalDurationSeconds: readyVideos.reduce((sum, l) => sum + (l.video?.duration || 0), 0),
    createdAt: course.createdAt?.toISOString(),
    updatedAt: course.updatedAt?.toISOString(),
    ...(includeLessons ? { lessons: lessons.map(formatAdminLesson) } : {}),
  };
};

/** Locate a course + lesson pair. Returns null after sending the error response. */
const findCourseAndLesson = async (
  req: AuthRequest,
  res: Response
): Promise<{ course: ICourse; lesson: ICourseLesson } | null> => {
  const { courseId, lessonId } = req.params;

  if (!isValidId(courseId) || !isValidId(lessonId)) {
    res.status(400).json({ success: false, message: 'Invalid course or lesson ID' });
    return null;
  }

  const course = await Course.findById(courseId);
  if (!course) {
    res.status(404).json({ success: false, message: 'Course not found' });
    return null;
  }

  const lesson = (course.lessons as any).id(lessonId) as ICourseLesson | null;
  if (!lesson) {
    res.status(404).json({ success: false, message: 'Lesson not found in this course' });
    return null;
  }

  return { course, lesson };
};

/**
 * GET /api/admin/courses
 * List courses for the admin course marketplace dashboard.
 */
export const listCourses = async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
    const { categoryId, status, search } = req.query as Record<string, string | undefined>;

    const filter: Record<string, any> = { isActive: true };
    if (categoryId) filter.categoryId = categoryId;
    if (status === 'published') filter.isPublished = true;
    if (status === 'draft') filter.isPublished = false;
    if (search) filter.title = { $regex: String(search).slice(0, 80), $options: 'i' };

    const [courses, total, published, draft] = await Promise.all([
      Course.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit),
      Course.countDocuments(filter),
      Course.countDocuments({ isActive: true, isPublished: true }),
      Course.countDocuments({ isActive: true, isPublished: false }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        courses: courses.map((c) => formatAdminCourse(c, false)),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        summary: { total, published, draft },
        videoLimits: getVideoUploadLimits(),
      },
    });
  } catch (error: any) {
    console.error('List courses error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load courses',
      error: error.message,
    });
  }
};

/**
 * GET /api/admin/courses/:courseId
 */
export const getCourse = async (req: AuthRequest, res: Response) => {
  try {
    const { courseId } = req.params;

    if (!isValidId(courseId)) {
      return res.status(400).json({ success: false, message: 'Invalid course ID' });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    return res.status(200).json({
      success: true,
      data: { course: formatAdminCourse(course), videoLimits: getVideoUploadLimits() },
    });
  } catch (error: any) {
    console.error('Get course error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load course',
      error: error.message,
    });
  }
};

/**
 * POST /api/admin/courses
 */
export const createCourse = async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, categoryId, level, accessType, price, thumbnailUrl } = req.body;

    if (!title || !description || !categoryId) {
      return res.status(400).json({
        success: false,
        message: 'Title, description and category are required',
      });
    }

    const resolvedAccessType = accessType === 'paid' ? 'paid' : 'free';
    const resolvedPrice = resolvedAccessType === 'paid' ? Number(price) || 0 : 0;

    if (resolvedAccessType === 'paid' && resolvedPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Paid courses require a price greater than zero',
      });
    }

    const course = await Course.create({
      title: String(title).trim(),
      description: String(description).trim(),
      categoryId: String(categoryId).trim(),
      level: ['beginner', 'intermediate', 'advanced'].includes(level) ? level : 'beginner',
      accessType: resolvedAccessType,
      price: resolvedPrice,
      thumbnailUrl,
      createdBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: 'Course created successfully',
      data: { course: formatAdminCourse(course) },
    });
  } catch (error: any) {
    console.error('Create course error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create course',
      error: error.message,
    });
  }
};

/**
 * PUT /api/admin/courses/:courseId
 */
export const updateCourse = async (req: AuthRequest, res: Response) => {
  try {
    const { courseId } = req.params;

    if (!isValidId(courseId)) {
      return res.status(400).json({ success: false, message: 'Invalid course ID' });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    const { title, description, categoryId, level, accessType, price, thumbnailUrl } = req.body;

    if (title !== undefined) course.title = String(title).trim();
    if (description !== undefined) course.description = String(description).trim();
    if (categoryId !== undefined) course.categoryId = String(categoryId).trim();
    if (thumbnailUrl !== undefined) course.thumbnailUrl = thumbnailUrl;
    if (level !== undefined && ['beginner', 'intermediate', 'advanced'].includes(level)) {
      course.level = level;
    }

    if (accessType !== undefined) {
      course.accessType = accessType === 'paid' ? 'paid' : 'free';
      if (course.accessType === 'free') course.price = 0;
    }

    if (price !== undefined && course.accessType === 'paid') {
      course.price = Number(price) || 0;
    }

    if (course.accessType === 'paid' && course.price <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Paid courses require a price greater than zero',
      });
    }

    await course.save();

    return res.status(200).json({
      success: true,
      message: 'Course updated successfully',
      data: { course: formatAdminCourse(course) },
    });
  } catch (error: any) {
    console.error('Update course error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update course',
      error: error.message,
    });
  }
};

/**
 * PATCH /api/admin/courses/:courseId/publish
 */
export const setCoursePublished = async (req: AuthRequest, res: Response) => {
  try {
    const { courseId } = req.params;
    const { isPublished } = req.body;

    if (!isValidId(courseId)) {
      return res.status(400).json({ success: false, message: 'Invalid course ID' });
    }

    if (typeof isPublished !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isPublished must be a boolean' });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    if (isPublished) {
      const publishedLessons = course.lessons.filter((l) => l.isPublished);
      if (publishedLessons.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Publish at least one lesson before publishing the course',
        });
      }
      course.publishedAt = course.publishedAt || new Date();
    }

    course.isPublished = isPublished;
    await course.save();

    return res.status(200).json({
      success: true,
      message: isPublished ? 'Course published' : 'Course unpublished',
      data: { course: formatAdminCourse(course, false) },
    });
  } catch (error: any) {
    console.error('Publish course error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update course publication state',
      error: error.message,
    });
  }
};

/**
 * DELETE /api/admin/courses/:courseId
 * Removes the course, its enrollments and every stored video object.
 */
export const deleteCourse = async (req: AuthRequest, res: Response) => {
  try {
    const { courseId } = req.params;

    if (!isValidId(courseId)) {
      return res.status(400).json({ success: false, message: 'Invalid course ID' });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    if (course.isPublished) {
      return res.status(400).json({
        success: false,
        message: 'Unpublish the course before deleting it',
      });
    }

    await deleteAllCourseVideos(course);
    await CourseEnrollment.deleteMany({ courseId: course._id });
    await course.deleteOne();

    return res.status(200).json({ success: true, message: 'Course deleted successfully' });
  } catch (error: any) {
    console.error('Delete course error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete course',
      error: error.message,
    });
  }
};

/**
 * POST /api/admin/courses/:courseId/lessons
 */
export const createLesson = async (req: AuthRequest, res: Response) => {
  try {
    const { courseId } = req.params;
    const { title, description, order, isFreePreview } = req.body;

    if (!isValidId(courseId)) {
      return res.status(400).json({ success: false, message: 'Invalid course ID' });
    }

    if (!title) {
      return res.status(400).json({ success: false, message: 'Lesson title is required' });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    const nextOrder =
      order !== undefined && Number.isFinite(Number(order))
        ? Number(order)
        : course.lessons.reduce((max, l) => Math.max(max, l.order), -1) + 1;

    course.lessons.push({
      title: String(title).trim(),
      description: description ? String(description).trim() : undefined,
      order: nextOrder,
      isPublished: false,
      isFreePreview: Boolean(isFreePreview),
    } as any);

    await course.save();

    const created = course.lessons[course.lessons.length - 1] as unknown as ICourseLesson;

    return res.status(201).json({
      success: true,
      message: 'Lesson created successfully',
      data: { lesson: formatAdminLesson(created) },
    });
  } catch (error: any) {
    console.error('Create lesson error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create lesson',
      error: error.message,
    });
  }
};

/**
 * PUT /api/admin/courses/:courseId/lessons/:lessonId
 */
export const updateLesson = async (req: AuthRequest, res: Response) => {
  try {
    const found = await findCourseAndLesson(req, res);
    if (!found) return undefined;

    const { course, lesson } = found;
    const { title, description, order, isPublished, isFreePreview } = req.body;

    if (title !== undefined) lesson.title = String(title).trim();
    if (description !== undefined) lesson.description = String(description).trim();
    if (order !== undefined && Number.isFinite(Number(order))) lesson.order = Number(order);
    if (isFreePreview !== undefined) lesson.isFreePreview = Boolean(isFreePreview);

    if (isPublished !== undefined) {
      // A lesson carrying a broken or in-flight video must not reach parents.
      if (isPublished && lesson.video && lesson.video.status !== 'ready') {
        const reason =
          lesson.video.status === 'processing'
            ? 'Wait for the video upload to finish before publishing this lesson'
            : 'The video for this lesson failed to upload. Re-upload it before publishing.';
        return res.status(400).json({ success: false, message: reason });
      }
      lesson.isPublished = Boolean(isPublished);
    }

    await course.save();

    return res.status(200).json({
      success: true,
      message: 'Lesson updated successfully',
      data: { lesson: formatAdminLesson(lesson) },
    });
  } catch (error: any) {
    console.error('Update lesson error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update lesson',
      error: error.message,
    });
  }
};

/**
 * DELETE /api/admin/courses/:courseId/lessons/:lessonId
 */
export const deleteLesson = async (req: AuthRequest, res: Response) => {
  try {
    const found = await findCourseAndLesson(req, res);
    if (!found) return undefined;

    const { course, lesson } = found;

    // Drop the stored video first so removing the lesson cannot orphan an object.
    if (lesson.video) {
      await deleteLessonVideo(course, lesson);
    }

    (course.lessons as any).pull({ _id: lesson._id });
    await course.save();

    return res.status(200).json({ success: true, message: 'Lesson deleted successfully' });
  } catch (error: any) {
    console.error('Delete lesson error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete lesson',
      error: error.message,
    });
  }
};

/**
 * POST /api/admin/courses/:courseId/lessons/:lessonId/video
 * Uploads a lesson video, replacing any existing one.
 */
export const uploadVideo = async (req: AuthRequest, res: Response) => {
  const file = req.file;

  try {
    const found = await findCourseAndLesson(req, res);
    if (!found) {
      removeTempFile(file?.path);
      return undefined;
    }

    if (!file) {
      return res.status(400).json({ success: false, message: 'No video file uploaded' });
    }

    const { course, lesson } = found;
    const result = await uploadLessonVideo(course, lesson, file);

    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      data: { lesson: formatAdminLesson(lesson) },
    });
  } catch (error: any) {
    console.error('Upload lesson video error:', error);
    removeTempFile(file?.path);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload lesson video',
      error: error.message,
    });
  }
};

/**
 * DELETE /api/admin/courses/:courseId/lessons/:lessonId/video
 */
export const removeVideo = async (req: AuthRequest, res: Response) => {
  try {
    const found = await findCourseAndLesson(req, res);
    if (!found) return undefined;

    const { course, lesson } = found;

    if (!lesson.video) {
      return res.status(404).json({ success: false, message: 'This lesson has no video' });
    }

    // Removing the media would otherwise leave a published lesson with a dead player.
    if (lesson.isPublished) {
      lesson.isPublished = false;
    }

    await deleteLessonVideo(course, lesson);

    return res.status(200).json({
      success: true,
      message: 'Lesson video removed',
      data: { lesson: formatAdminLesson(lesson) },
    });
  } catch (error: any) {
    console.error('Remove lesson video error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove lesson video',
      error: error.message,
    });
  }
};

/**
 * GET /api/admin/courses/:courseId/lessons/:lessonId/video
 * Video metadata plus a short-lived preview URL for the admin player.
 */
export const getVideoDetails = async (req: AuthRequest, res: Response) => {
  try {
    const found = await findCourseAndLesson(req, res);
    if (!found) return undefined;

    const { lesson } = found;

    if (!lesson.video) {
      return res.status(404).json({ success: false, message: 'This lesson has no video' });
    }

    let previewUrl: string | undefined;
    let expiresAt: string | undefined;

    if (lesson.video.status === 'ready') {
      const signed = await createSignedPlaybackUrl({
        key: lesson.video.storageKey,
        expiresInSeconds: 30 * 60,
        contentType: lesson.video.mimeType,
        fileName: lesson.video.originalFileName,
      });
      previewUrl = signed.url;
      expiresAt = signed.expiresAt.toISOString();
    }

    return res.status(200).json({
      success: true,
      data: {
        video: formatLessonVideo(lesson.video),
        previewUrl,
        expiresAt,
      },
    });
  } catch (error: any) {
    console.error('Get lesson video error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load lesson video',
      error: error.message,
    });
  }
};

/**
 * PATCH /api/admin/courses/:courseId/lessons/:lessonId/video/metadata
 * Records the duration the player detected while previewing the upload.
 */
export const updateVideoMetadata = async (req: AuthRequest, res: Response) => {
  try {
    const found = await findCourseAndLesson(req, res);
    if (!found) return undefined;

    const { course, lesson } = found;
    const { durationSeconds } = req.body;

    if (!lesson.video) {
      return res.status(404).json({ success: false, message: 'This lesson has no video' });
    }

    const duration = Number(durationSeconds);
    if (!Number.isFinite(duration) || duration <= 0 || duration > 24 * 60 * 60) {
      return res.status(400).json({ success: false, message: 'Invalid video duration' });
    }

    lesson.video.duration = Math.round(duration);
    course.markModified('lessons');
    await course.save();

    return res.status(200).json({
      success: true,
      message: 'Video metadata updated',
      data: { video: formatLessonVideo(lesson.video) },
    });
  } catch (error: any) {
    console.error('Update video metadata error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update video metadata',
      error: error.message,
    });
  }
};
