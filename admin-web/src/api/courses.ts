import { request, requestData, upload, type UploadHandle } from './client';
import type {
  AdminCourse,
  AdminLesson,
  CourseInput,
  CourseListResult,
  LessonInput,
  LessonVideo,
  VideoUploadLimits,
} from '../types';

/**
 * Course marketplace admin API — `/api/admin/courses`.
 *
 * The same `Course` documents this writes are what parents read through
 * `/api/courses`, and lesson videos land in the platform's existing S3 bucket
 * via `courseVideoService`. There is no separate storage path for the console.
 */

export interface CourseListParams {
  status?: 'published' | 'draft';
  categoryId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export function listCourses(params: CourseListParams) {
  return requestData<CourseListResult>('/admin/courses', { query: { ...params } });
}

export function getCourse(courseId: string) {
  return requestData<{ course: AdminCourse; videoLimits: VideoUploadLimits }>(
    `/admin/courses/${courseId}`
  );
}

export async function createCourse(input: CourseInput): Promise<AdminCourse> {
  const body = await request<{ data: { course: AdminCourse } }>('/admin/courses', {
    method: 'POST',
    body: input,
  });
  return body.data.course;
}

export async function updateCourse(
  courseId: string,
  input: Partial<CourseInput>
): Promise<AdminCourse> {
  const body = await request<{ data: { course: AdminCourse } }>(`/admin/courses/${courseId}`, {
    method: 'PUT',
    body: input,
  });
  return body.data.course;
}

/**
 * The backend refuses to publish a course with zero published lessons and
 * returns 400 with the reason — surfaced to the user rather than pre-empted.
 */
export function setCoursePublished(courseId: string, isPublished: boolean) {
  return request<{ success: boolean; message: string; data: { course: AdminCourse } }>(
    `/admin/courses/${courseId}/publish`,
    { method: 'PATCH', body: { isPublished } }
  );
}

/** Soft rule: the backend rejects deleting a published course. */
export function deleteCourse(courseId: string) {
  return request<{ success: boolean; message: string }>(`/admin/courses/${courseId}`, {
    method: 'DELETE',
  });
}

// ── Lessons ────────────────────────────────────────────────────────────────

export async function createLesson(courseId: string, input: LessonInput): Promise<AdminLesson> {
  const body = await request<{ data: { lesson: AdminLesson } }>(
    `/admin/courses/${courseId}/lessons`,
    { method: 'POST', body: input }
  );
  return body.data.lesson;
}

export async function updateLesson(
  courseId: string,
  lessonId: string,
  input: Partial<LessonInput>
): Promise<AdminLesson> {
  const body = await request<{ data: { lesson: AdminLesson } }>(
    `/admin/courses/${courseId}/lessons/${lessonId}`,
    { method: 'PUT', body: input }
  );
  return body.data.lesson;
}

export function deleteLesson(courseId: string, lessonId: string) {
  return request<{ success: boolean; message: string }>(
    `/admin/courses/${courseId}/lessons/${lessonId}`,
    { method: 'DELETE' }
  );
}

/**
 * Ordering is persisted through the same `order` field the parent app sorts by,
 * one PUT per moved lesson — there is no bulk reorder endpoint, so the console
 * never shows an order it has not written back.
 */
export function setLessonOrder(courseId: string, lessonId: string, order: number) {
  return updateLesson(courseId, lessonId, { order });
}

// ── Lesson video ───────────────────────────────────────────────────────────

export function getLessonVideo(courseId: string, lessonId: string) {
  return requestData<{ video: LessonVideo; previewUrl?: string; expiresAt?: string }>(
    `/admin/courses/${courseId}/lessons/${lessonId}/video`
  );
}

/**
 * Multipart upload to the existing endpoint. Field name `video` is what the
 * route's multer instance expects; anything else is rejected with 400.
 */
export function uploadLessonVideo(
  courseId: string,
  lessonId: string,
  file: File,
  onProgress?: (percent: number) => void
): UploadHandle<{ success: boolean; message: string; data: { lesson: AdminLesson } }> {
  return upload(`/admin/courses/${courseId}/lessons/${lessonId}/video`, {
    fieldName: 'video',
    file,
    onProgress,
  });
}

export function deleteLessonVideo(courseId: string, lessonId: string) {
  return request<{ success: boolean; message: string; data: { lesson: AdminLesson } }>(
    `/admin/courses/${courseId}/lessons/${lessonId}/video`,
    { method: 'DELETE' }
  );
}

/** Records the duration the preview player detected, as the mobile admin does. */
export function updateVideoDuration(courseId: string, lessonId: string, durationSeconds: number) {
  return request<{ success: boolean; message: string }>(
    `/admin/courses/${courseId}/lessons/${lessonId}/video/metadata`,
    { method: 'PATCH', body: { durationSeconds } }
  );
}
