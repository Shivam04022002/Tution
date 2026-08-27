import { ICourse, ICourseLesson, ILessonVideo } from '../models/Course';
import { validateFile, getMaxCourseVideoBytes } from './fileValidationService';
import {
  buildCourseVideoKey,
  uploadFileToS3,
  deleteObjectFromS3,
  objectExistsInS3,
  createSignedPlaybackUrl,
  removeTempFile,
  isS3Configured,
} from '../config/awsConfig';

export interface LessonVideoResponse {
  storageKey?: never; // never leaked to clients
  originalFileName: string;
  mimeType: string;
  size: number;
  sizeLabel: string;
  duration?: number;
  status: ILessonVideo['status'];
  failureReason?: string;
  uploadedAt: string;
  hasThumbnail: boolean;
}

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

/**
 * Shape a lesson video for API responses.
 * Deliberately omits `storageKey` — clients must never see or supply an S3 key.
 */
export const formatLessonVideo = (video?: ILessonVideo | null): LessonVideoResponse | null => {
  if (!video) return null;

  return {
    originalFileName: video.originalFileName,
    mimeType: video.mimeType,
    size: video.size,
    sizeLabel: formatFileSize(video.size),
    duration: video.duration,
    status: video.status,
    failureReason: video.failureReason,
    uploadedAt: new Date(video.uploadedAt).toISOString(),
    hasThumbnail: Boolean(video.thumbnailKey),
  } as LessonVideoResponse;
};

export interface VideoUploadResult {
  success: boolean;
  statusCode: number;
  message: string;
}

/**
 * Validate + upload a lesson video to S3 and record its metadata on the lesson.
 *
 * The metadata row is written with status `processing` BEFORE the transfer
 * starts, so a crashed or interrupted upload leaves a visible state for the
 * admin instead of silently disappearing. Any previous video for the lesson is
 * removed from S3 only after the replacement has landed.
 */
export const uploadLessonVideo = async (
  course: ICourse,
  lesson: ICourseLesson,
  file: Express.Multer.File
): Promise<VideoUploadResult> => {
  if (!isS3Configured()) {
    removeTempFile(file.path);
    return {
      success: false,
      statusCode: 503,
      message: 'Video storage is not configured. Contact the platform administrator.',
    };
  }

  const validation = validateFile(file, 'course-video');
  if (!validation.isValid) {
    removeTempFile(file.path);
    return { success: false, statusCode: 400, message: validation.error! };
  }

  const previousKey = lesson.video?.storageKey;
  const storageKey = buildCourseVideoKey(
    course._id.toString(),
    lesson._id.toString(),
    file.originalname
  );

  lesson.video = {
    storageKey,
    originalFileName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    duration: undefined,
    status: 'processing',
    failureReason: undefined,
    uploadedAt: new Date(),
  } as ILessonVideo;

  // Mongoose does not always detect mutations nested inside a subdocument
  // array, so flag the path explicitly before every save below.
  course.markModified('lessons');
  await course.save();

  try {
    await uploadFileToS3({
      filePath: file.path,
      key: storageKey,
      contentType: file.mimetype,
      metadata: {
        courseId: course._id.toString(),
        lessonId: lesson._id.toString(),
      },
    });

    lesson.video.status = 'ready';
    lesson.video.failureReason = undefined;
    course.markModified('lessons');
    await course.save();

    // Old object is only discarded once the replacement is safely stored.
    if (previousKey && previousKey !== storageKey) {
      await deleteObjectFromS3(previousKey);
    }

    return { success: true, statusCode: 200, message: 'Lesson video uploaded successfully' };
  } catch (error: any) {
    console.error('[CourseVideo] Upload failed:', error);

    lesson.video.status = 'failed';
    lesson.video.failureReason = error?.message || 'Upload to storage failed';
    course.markModified('lessons');
    await course.save().catch(() => undefined);

    // Remove any partial object left behind by the failed transfer.
    await deleteObjectFromS3(storageKey);

    return {
      success: false,
      statusCode: 502,
      message: 'Failed to upload video to storage. Please try again.',
    };
  } finally {
    removeTempFile(file.path);
  }
};

/** Delete a lesson's video from S3 and clear its metadata. */
export const deleteLessonVideo = async (
  course: ICourse,
  lesson: ICourseLesson
): Promise<void> => {
  const key = lesson.video?.storageKey;
  const thumbnailKey = lesson.video?.thumbnailKey;

  lesson.video = undefined;
  course.markModified('lessons');
  await course.save();

  if (key) await deleteObjectFromS3(key);
  if (thumbnailKey) await deleteObjectFromS3(thumbnailKey);
};

/** Remove every stored object belonging to a course. Used when a course is deleted. */
export const deleteAllCourseVideos = async (course: ICourse): Promise<void> => {
  for (const lesson of course.lessons) {
    if (lesson.video?.storageKey) await deleteObjectFromS3(lesson.video.storageKey);
    if (lesson.video?.thumbnailKey) await deleteObjectFromS3(lesson.video.thumbnailKey);
  }
};

export interface PlaybackUrlResult {
  success: boolean;
  statusCode: number;
  message?: string;
  playbackUrl?: string;
  expiresAt?: string;
  expiresInSeconds?: number;
}

/**
 * Produce a temporary signed playback URL for a lesson that the caller has
 * already been authorized for. Verifies the object still exists so a deleted or
 * broken S3 object surfaces as a clear error rather than a player failure.
 */
export const createLessonPlaybackUrl = async (
  course: ICourse,
  lesson: ICourseLesson
): Promise<PlaybackUrlResult> => {
  const video = lesson.video;

  if (!video || !video.storageKey) {
    return { success: false, statusCode: 404, message: 'This lesson has no video' };
  }

  if (video.status === 'processing') {
    return { success: false, statusCode: 409, message: 'Video is still processing. Please try again shortly.' };
  }

  if (video.status !== 'ready') {
    return { success: false, statusCode: 409, message: 'Video is unavailable for playback' };
  }

  if (!isS3Configured()) {
    return { success: false, statusCode: 503, message: 'Video storage is not configured' };
  }

  try {
    const exists = await objectExistsInS3(video.storageKey);

    if (!exists) {
      console.error(`[CourseVideo] Missing S3 object for lesson ${lesson._id}: ${video.storageKey}`);
      video.status = 'failed';
      video.failureReason = 'Stored video object is missing';
      course.markModified('lessons');
      await course.save().catch(() => undefined);

      return { success: false, statusCode: 404, message: 'Video is currently unavailable' };
    }

    const signed = await createSignedPlaybackUrl({
      key: video.storageKey,
      contentType: video.mimeType,
      fileName: video.originalFileName,
    });

    return {
      success: true,
      statusCode: 200,
      playbackUrl: signed.url,
      expiresAt: signed.expiresAt.toISOString(),
      expiresInSeconds: signed.expiresInSeconds,
    };
  } catch (error: any) {
    console.error('[CourseVideo] Failed to sign playback URL:', error);
    return { success: false, statusCode: 502, message: 'Could not prepare video playback' };
  }
};

export const getVideoUploadLimits = () => ({
  maxSizeBytes: getMaxCourseVideoBytes(),
  maxSizeLabel: formatFileSize(getMaxCourseVideoBytes()),
  allowedMimeTypes: ['video/mp4', 'video/quicktime', 'video/x-m4v'],
  recommended: 'MP4 container, H.264 video, AAC audio',
});
