import mongoose from 'mongoose';
import { ICourse, ICourseLesson } from '../models/Course';
import { CourseEnrollment, ICourseEnrollment } from '../models/CourseEnrollment';

export interface CourseAccessResult {
  allowed: boolean;
  statusCode: number;
  message?: string;
  enrollment?: ICourseEnrollment | null;
  isFreePreview?: boolean;
}

/**
 * Decide whether a parent may consume a published course.
 *
 * - Free courses auto-enroll the parent on first access.
 * - Paid courses require a pre-existing active enrollment.
 * - Lessons flagged `isFreePreview` are playable without any enrollment.
 *
 * Callers must have already verified that the course is published and active.
 */
export const resolveParentCourseAccess = async (
  course: ICourse,
  parentId: mongoose.Types.ObjectId,
  options: { lesson?: ICourseLesson } = {}
): Promise<CourseAccessResult> => {
  const existing = await CourseEnrollment.findOne({
    courseId: course._id,
    parentId,
    status: 'active',
  });

  if (existing) {
    existing.lastAccessedAt = new Date();
    await existing.save().catch(() => undefined);
    return { allowed: true, statusCode: 200, enrollment: existing };
  }

  if (options.lesson?.isFreePreview) {
    return { allowed: true, statusCode: 200, enrollment: null, isFreePreview: true };
  }

  if (course.accessType === 'free') {
    const enrollment = await enrollParentInCourse(course, parentId, 'free');
    return { allowed: true, statusCode: 200, enrollment };
  }

  return {
    allowed: false,
    statusCode: 403,
    message: 'You are not enrolled in this course',
    enrollment: null,
  };
};

/**
 * Create an enrollment, tolerating the race where two concurrent requests both
 * try to auto-enroll the same parent (the unique index rejects the loser).
 */
export const enrollParentInCourse = async (
  course: ICourse,
  parentId: mongoose.Types.ObjectId,
  source: ICourseEnrollment['source']
): Promise<ICourseEnrollment> => {
  try {
    const enrollment = await CourseEnrollment.create({
      courseId: course._id,
      parentId,
      status: 'active',
      source,
      enrolledAt: new Date(),
      lastAccessedAt: new Date(),
    });

    course.enrollmentCount = (course.enrollmentCount || 0) + 1;
    await course.save().catch(() => undefined);

    return enrollment;
  } catch (error: any) {
    if (error?.code === 11000) {
      const existing = await CourseEnrollment.findOne({ courseId: course._id, parentId });
      if (existing) {
        if (existing.status !== 'active') {
          existing.status = 'active';
        }
        existing.lastAccessedAt = new Date();
        await existing.save().catch(() => undefined);
        return existing;
      }
    }
    throw error;
  }
};

export const isParentEnrolled = async (
  courseId: mongoose.Types.ObjectId,
  parentId: mongoose.Types.ObjectId
): Promise<boolean> => {
  const count = await CourseEnrollment.countDocuments({
    courseId,
    parentId,
    status: 'active',
  });
  return count > 0;
};
