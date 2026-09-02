import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as coursesApi from '../../api/courses';
import { ApiError, type UploadHandle } from '../../api/client';
import { Card, ProgressBar } from '../../components/ui/Primitives';
import { Button, IconButton } from '../../components/ui/Button';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { Checkbox, TextArea, TextInput } from '../../components/ui/Form';
import { ConfirmDialog, Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { EmptyState, ErrorState, InlineLoader } from '../../components/common/States';
import {
  IconArrowDown,
  IconArrowUp,
  IconChevronLeft,
  IconEdit,
  IconEye,
  IconPlus,
  IconTrash,
  IconUpload,
  IconVideo,
} from '../../components/ui/Icons';
import { formatBytes, formatDuration } from '../../utils/format';
import type { AdminLesson, VideoUploadLimits } from '../../types';

/**
 * Lesson and video manager.
 *
 * Ordering is persisted: moving a lesson writes the new `order` values back
 * through `PUT /admin/courses/:id/lessons/:lessonId` for both swapped lessons.
 * The list never shows an order the server has not accepted.
 */
export function CourseContentPage() {
  const { id = '' } = useParams();
  const toast = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['admin', 'course', id],
    queryFn: () => coursesApi.getCourse(id),
    enabled: Boolean(id),
  });

  const [editing, setEditing] = useState<AdminLesson | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<AdminLesson | null>(null);
  const [previewing, setPreviewing] = useState<AdminLesson | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'course', id] });

  const removeLesson = useMutation({
    mutationFn: (lessonId: string) => coursesApi.deleteLesson(id, lessonId),
    onSuccess: (result) => {
      toast.success(result.message || 'Lesson deleted');
      setDeleting(null);
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['admin', 'courses'] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Delete failed'),
  });

  const togglePublished = useMutation({
    mutationFn: ({ lessonId, next }: { lessonId: string; next: boolean }) =>
      coursesApi.updateLesson(id, lessonId, { isPublished: next }),
    onSuccess: (lesson) => {
      toast.success(lesson.isPublished ? 'Lesson published' : 'Lesson unpublished');
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['admin', 'courses'] });
    },
    // A lesson with a processing or failed video is refused with a reason.
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not update'),
  });

  const reorder = useMutation({
    mutationFn: async ({ lesson, direction }: { lesson: AdminLesson; direction: -1 | 1 }) => {
      const lessons = query.data?.course.lessons ?? [];
      const index = lessons.findIndex((entry) => entry._id === lesson._id);
      const swapWith = lessons[index + direction];
      if (!swapWith) return;

      // Both writes must land, otherwise two lessons would share an order.
      await coursesApi.setLessonOrder(id, lesson._id, swapWith.order);
      await coursesApi.setLessonOrder(id, swapWith._id, lesson.order);
    },
    onSuccess: () => invalidate(),
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Could not reorder lessons');
      invalidate();
    },
  });

  if (query.isLoading) {
    return (
      <div className="page">
        <InlineLoader label="Loading course content…" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="page">
        <Card>
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        </Card>
      </div>
    );
  }

  const course = query.data.course;
  const limits = query.data.videoLimits;
  const lessons = course.lessons ?? [];

  return (
    <div className="page">
      <Link
        to={`/marketplace/courses/${id}`}
        className="btn btn-ghost btn-sm"
        style={{ marginBottom: 12 }}
      >
        <IconChevronLeft size={14} /> Back to course
      </Link>

      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <h1 className="page-title">{course.title}</h1>
          <p className="page-sub">
            {lessons.length} lesson{lessons.length === 1 ? '' : 's'} ·{' '}
            {course.publishedLessonCount} published · {course.videoCount} video
            {course.videoCount === 1 ? '' : 's'} ready ·{' '}
            {formatDuration(course.totalDurationSeconds)} total runtime
          </p>
        </div>
        <Button variant="primary" icon={<IconPlus size={15} />} onClick={() => setCreating(true)}>
          Add lesson
        </Button>
      </div>

      <div
        className="card mb-4 text-sm muted"
        style={{ padding: 'var(--s-3) var(--s-4)', lineHeight: 1.6 }}
      >
        Videos upload to the platform's existing storage through{' '}
        <span className="mono">POST /admin/courses/:id/lessons/:lessonId/video</span>. Parents stream
        the same file through the signed playback URL the app already uses — nothing here creates a
        second copy. Accepted: <strong>{limits.allowedMimeTypes.join(', ')}</strong>, up to{' '}
        <strong>{limits.maxSizeLabel}</strong>. Recommended encode: {limits.recommended}.
      </div>

      {lessons.length === 0 ? (
        <Card>
          <EmptyState
            title="No lessons yet"
            message="Add a lesson, upload its video, then publish it. A course needs at least one published lesson before it can go live."
            action={
              <Button variant="primary" onClick={() => setCreating(true)}>
                Add the first lesson
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid" style={{ gap: 'var(--s-3)' }}>
          {lessons.map((lesson, index) => (
            <LessonCard
              key={lesson._id}
              courseId={id}
              lesson={lesson}
              index={index}
              total={lessons.length}
              limits={limits}
              reordering={reorder.isPending}
              publishing={togglePublished.isPending && togglePublished.variables?.lessonId === lesson._id}
              onMove={(direction) => reorder.mutate({ lesson, direction })}
              onEdit={() => setEditing(lesson)}
              onDelete={() => setDeleting(lesson)}
              onPreview={() => setPreviewing(lesson)}
              onTogglePublished={() =>
                togglePublished.mutate({ lessonId: lesson._id, next: !lesson.isPublished })
              }
              onChanged={invalidate}
            />
          ))}
        </div>
      )}

      {(creating || editing) && (
        <LessonFormModal
          courseId={id}
          lesson={editing}
          nextOrder={lessons.reduce((max, lesson) => Math.max(max, lesson.order), -1) + 1}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            invalidate();
            queryClient.invalidateQueries({ queryKey: ['admin', 'courses'] });
          }}
        />
      )}

      {previewing && (
        <VideoPreviewModal
          courseId={id}
          lesson={previewing}
          onClose={() => setPreviewing(null)}
          onDurationRecorded={invalidate}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this lesson?"
        destructive
        confirmLabel="Delete lesson"
        busy={removeLesson.isPending}
        message={
          <>
            <strong>{deleting?.title}</strong>
            {deleting?.hasVideo
              ? ' and its uploaded video will be permanently removed from storage.'
              : ' will be permanently removed.'}{' '}
            This cannot be undone.
          </>
        }
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && removeLesson.mutate(deleting._id)}
      />
    </div>
  );
}

// ── Lesson card ────────────────────────────────────────────────────────────

function LessonCard({
  courseId,
  lesson,
  index,
  total,
  limits,
  reordering,
  publishing,
  onMove,
  onEdit,
  onDelete,
  onPreview,
  onTogglePublished,
  onChanged,
}: {
  courseId: string;
  lesson: AdminLesson;
  index: number;
  total: number;
  limits: VideoUploadLimits;
  reordering: boolean;
  publishing: boolean;
  onMove: (direction: -1 | 1) => void;
  onEdit: () => void;
  onDelete: () => void;
  onPreview: () => void;
  onTogglePublished: () => void;
  onChanged: () => void;
}) {
  return (
    <Card padded={false}>
      <div className="card-head" style={{ alignItems: 'flex-start' }}>
        <div className="row gap-3" style={{ alignItems: 'flex-start', minWidth: 0 }}>
          <div className="row" style={{ flexDirection: 'column', gap: 2 }}>
            <IconButton
              label="Move lesson up"
              onClick={() => onMove(-1)}
              disabled={index === 0 || reordering}
            >
              <IconArrowUp size={13} />
            </IconButton>
            <span className="dim text-xs center" style={{ width: 30 }}>
              {index + 1}
            </span>
            <IconButton
              label="Move lesson down"
              onClick={() => onMove(1)}
              disabled={index === total - 1 || reordering}
            >
              <IconArrowDown size={13} />
            </IconButton>
          </div>

          <div style={{ minWidth: 0 }}>
            <div className="row gap-2 wrap">
              <span className="strong">{lesson.title}</span>
              <StatusBadge status={lesson.isPublished ? 'published' : 'draft'} />
              {lesson.isFreePreview && <Badge tone="info">Free preview</Badge>}
            </div>
            {lesson.description && (
              <p className="muted text-sm" style={{ marginTop: 4, maxWidth: 640 }}>
                {lesson.description}
              </p>
            )}
          </div>
        </div>

        <div className="row gap-1" style={{ flex: 'none' }}>
          <Button size="sm" variant="ghost" loading={publishing} onClick={onTogglePublished}>
            {lesson.isPublished ? 'Unpublish' : 'Publish'}
          </Button>
          <IconButton label="Edit lesson" onClick={onEdit}>
            <IconEdit size={15} />
          </IconButton>
          <IconButton label="Delete lesson" onClick={onDelete}>
            <IconTrash size={15} />
          </IconButton>
        </div>
      </div>

      <div className="card-body">
        <VideoPanel
          courseId={courseId}
          lesson={lesson}
          limits={limits}
          onPreview={onPreview}
          onChanged={onChanged}
        />
      </div>
    </Card>
  );
}

// ── Video panel ────────────────────────────────────────────────────────────

type UploadState =
  | { phase: 'idle' }
  | { phase: 'uploading'; percent: number; fileName: string }
  | { phase: 'error'; message: string; file: File };

function VideoPanel({
  courseId,
  lesson,
  limits,
  onPreview,
  onChanged,
}: {
  courseId: string;
  lesson: AdminLesson;
  limits: VideoUploadLimits;
  onPreview: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const handleRef = useRef<UploadHandle<any> | null>(null);
  const [state, setState] = useState<UploadState>({ phase: 'idle' });
  const [confirmRemove, setConfirmRemove] = useState(false);

  const removeVideo = useMutation({
    mutationFn: () => coursesApi.deleteLessonVideo(courseId, lesson._id),
    onSuccess: (result) => {
      toast.success(result.message || 'Video removed');
      setConfirmRemove(false);
      onChanged();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not remove'),
  });

  async function startUpload(file: File) {
    // Client-side checks mirror the server's; the server re-validates regardless.
    if (!limits.allowedMimeTypes.includes(file.type)) {
      setState({
        phase: 'error',
        message: `${file.type || 'That file type'} is not accepted. Allowed: ${limits.allowedMimeTypes.join(', ')}.`,
        file,
      });
      return;
    }

    if (file.size > limits.maxSizeBytes) {
      setState({
        phase: 'error',
        message: `${formatBytes(file.size)} exceeds the ${limits.maxSizeLabel} limit. Compress the video and try again.`,
        file,
      });
      return;
    }

    setState({ phase: 'uploading', percent: 0, fileName: file.name });

    const handle = coursesApi.uploadLessonVideo(courseId, lesson._id, file, (percent) =>
      setState((current) =>
        current.phase === 'uploading' ? { ...current, percent } : current
      )
    );
    handleRef.current = handle;

    try {
      const result = await handle.promise;
      setState({ phase: 'idle' });
      toast.success(result.message || 'Video uploaded');
      onChanged();
    } catch (error) {
      const message =
        error instanceof ApiError
          ? uploadErrorMessage(error, limits)
          : 'The upload failed. Please try again.';
      setState({ phase: 'error', message, file });
    } finally {
      handleRef.current = null;
    }
  }

  const video = lesson.video;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={limits.allowedMimeTypes.join(',')}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) startUpload(file);
        }}
      />

      {state.phase === 'uploading' && (
        <div>
          <div className="row-between mb-4">
            <span className="text-sm">
              Uploading <strong>{state.fileName}</strong>
            </span>
            <span className="row gap-3">
              <span className="mono text-sm">{state.percent}%</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  handleRef.current?.abort();
                  setState({ phase: 'idle' });
                }}
              >
                Cancel
              </Button>
            </span>
          </div>
          <ProgressBar percent={state.percent} />
          <p className="field-hint mt-2">
            Keep this tab open until the upload finishes. Large files can take several minutes.
          </p>
        </div>
      )}

      {state.phase === 'error' && (
        <div
          style={{
            padding: 'var(--s-3) var(--s-4)',
            background: 'var(--c-error-bg)',
            borderRadius: 'var(--r-md)',
          }}
        >
          <p className="text-sm strong" style={{ color: '#B91C1C' }}>
            Upload failed
          </p>
          <p className="text-sm" style={{ color: '#B91C1C', marginTop: 4, lineHeight: 1.5 }}>
            {state.message}
          </p>
          <div className="row gap-2 mt-4">
            <Button size="sm" variant="primary" onClick={() => startUpload(state.file)}>
              Retry upload
            </Button>
            <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()}>
              Choose a different file
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setState({ phase: 'idle' })}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {state.phase === 'idle' && !video && (
        <div className="row gap-4 wrap" style={{ alignItems: 'center' }}>
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: 'var(--r-md)',
              background: 'var(--c-bg-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--c-text-3)',
              flex: 'none',
            }}
          >
            <IconVideo size={18} />
          </span>
          <div className="grow" style={{ minWidth: 180 }}>
            <p className="text-sm strong">No video attached</p>
            <p className="field-hint">
              A lesson can be published without a video, but parents will have nothing to play.
            </p>
          </div>
          <Button
            variant="secondary"
            icon={<IconUpload size={14} />}
            onClick={() => inputRef.current?.click()}
          >
            Upload video
          </Button>
        </div>
      )}

      {state.phase === 'idle' && video && (
        <div className="row gap-4 wrap" style={{ alignItems: 'center' }}>
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: 'var(--r-md)',
              background: video.status === 'ready' ? '#EDE9FE' : 'var(--c-bg-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: video.status === 'ready' ? 'var(--c-primary)' : 'var(--c-text-3)',
              flex: 'none',
            }}
          >
            <IconVideo size={18} />
          </span>

          <div className="grow" style={{ minWidth: 220 }}>
            <div className="row gap-2 wrap">
              <span className="text-sm strong truncate" style={{ maxWidth: 280 }}>
                {video.originalFileName}
              </span>
              <StatusBadge status={video.status} />
            </div>
            <p className="field-hint" style={{ marginTop: 2 }}>
              {video.sizeLabel || formatBytes(video.size)} · {video.mimeType}
              {video.duration ? ` · ${formatDuration(video.duration)}` : ''}
            </p>
            {video.status === 'failed' && video.failureReason && (
              <p className="field-error" style={{ marginTop: 4 }}>
                {video.failureReason}
              </p>
            )}
          </div>

          <div className="row gap-2 wrap">
            {video.status === 'ready' && (
              <Button size="sm" variant="secondary" icon={<IconEye size={14} />} onClick={onPreview}>
                Preview
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              icon={<IconUpload size={14} />}
              onClick={() => inputRef.current?.click()}
            >
              Replace
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(true)}>
              Remove
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmRemove}
        title="Remove this video?"
        destructive
        confirmLabel="Remove video"
        busy={removeVideo.isPending}
        message={
          <>
            The video file is deleted from storage and cannot be recovered.
            {lesson.isPublished && (
              <>
                {' '}
                This lesson is currently published — removing the video also{' '}
                <strong>unpublishes the lesson</strong> so parents never see an empty player.
              </>
            )}
          </>
        }
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => removeVideo.mutate()}
      />
    </>
  );
}

function uploadErrorMessage(error: ApiError, limits: VideoUploadLimits): string {
  if (error.status === 413) {
    return `The file is larger than the server accepts (limit ${limits.maxSizeLabel}). Compress it and try again.`;
  }
  if (error.isNetworkError) {
    return 'The connection dropped during the upload. Check your network and retry — nothing was saved.';
  }
  return error.message;
}

// ── Preview ────────────────────────────────────────────────────────────────

function VideoPreviewModal({
  courseId,
  lesson,
  onClose,
  onDurationRecorded,
}: {
  courseId: string;
  lesson: AdminLesson;
  onClose: () => void;
  onDurationRecorded: () => void;
}) {
  const query = useQuery({
    queryKey: ['admin', 'course', courseId, 'lesson', lesson._id, 'video'],
    queryFn: () => coursesApi.getLessonVideo(courseId, lesson._id),
  });

  // The backend stores the duration the player reports, exactly as the mobile
  // admin does — the upload pipeline itself does not probe the file.
  const recordDuration = useMutation({
    mutationFn: (seconds: number) => coursesApi.updateVideoDuration(courseId, lesson._id, seconds),
    onSuccess: onDurationRecorded,
  });

  return (
    <Modal
      open
      size="lg"
      title="Video preview"
      description={lesson.title}
      onClose={onClose}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {query.isLoading && <InlineLoader label="Generating a secure playback link…" />}

      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}

      {query.isSuccess &&
        (query.data.previewUrl ? (
          <>
            <video
              src={query.data.previewUrl}
              controls
              style={{
                width: '100%',
                borderRadius: 'var(--r-md)',
                background: '#000',
                maxHeight: '60vh',
              }}
              onLoadedMetadata={(event) => {
                const seconds = (event.target as HTMLVideoElement).duration;
                if (
                  Number.isFinite(seconds) &&
                  seconds > 0 &&
                  Math.round(seconds) !== query.data.video.duration
                ) {
                  recordDuration.mutate(seconds);
                }
              }}
            />
            <p className="field-hint mt-4">
              This link is signed and short-lived. It is generated per request and is never stored in
              the page — the same mechanism the parent app uses for playback.
            </p>
          </>
        ) : (
          <EmptyState
            title="Not ready to play"
            message={`The video status is "${query.data.video.status}". Only a ready video can be previewed.`}
          />
        ))}
    </Modal>
  );
}

// ── Lesson form ────────────────────────────────────────────────────────────

function LessonFormModal({
  courseId,
  lesson,
  nextOrder,
  onClose,
  onSaved,
}: {
  courseId: string;
  lesson: AdminLesson | null;
  nextOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const isEdit = Boolean(lesson);

  const [title, setTitle] = useState(lesson?.title ?? '');
  const [description, setDescription] = useState(lesson?.description ?? '');
  const [isFreePreview, setIsFreePreview] = useState(lesson?.isFreePreview ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        isFreePreview,
      };
      if (isEdit && lesson) return coursesApi.updateLesson(courseId, lesson._id, payload);
      return coursesApi.createLesson(courseId, { ...payload, order: nextOrder });
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Lesson updated' : 'Lesson added');
      onSaved();
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        setErrors(
          Object.fromEntries(error.fieldErrors.map((fieldError) => [fieldError.field, fieldError.message]))
        );
        toast.error(error.message);
      } else {
        toast.error('Could not save the lesson.');
      }
    },
  });

  function submit() {
    const nextErrors: Record<string, string> = {};
    if (!title.trim()) nextErrors.title = 'Lesson title is required';
    else if (title.trim().length > 160) nextErrors.title = 'Title must be 160 characters or fewer';
    if (description.trim().length > 2000)
      nextErrors.description = 'Description must be 2000 characters or fewer';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    save.mutate();
  }

  return (
    <Modal
      open
      title={isEdit ? 'Edit lesson' : 'Add lesson'}
      busy={save.isPending}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button variant="primary" loading={save.isPending} onClick={submit}>
            {isEdit ? 'Save lesson' : 'Add lesson'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 'var(--s-4)' }}>
        <TextInput
          label="Lesson title"
          required
          maxLength={160}
          value={title}
          error={errors.title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <TextArea
          label="Description"
          rows={4}
          maxLength={2000}
          value={description}
          error={errors.description}
          hint="Optional. Shown under the lesson title in the app."
          onChange={(event) => setDescription(event.target.value)}
        />
        <Checkbox
          checked={isFreePreview}
          label={
            <span>
              Free preview
              <span className="field-hint" style={{ display: 'block' }}>
                Playable on a published course without enrolling — useful as a sample lesson.
              </span>
            </span>
          }
          onChange={(event) => setIsFreePreview(event.target.checked)}
        />
      </div>

      {!isEdit && (
        <p className="field-hint mt-4">
          New lessons start unpublished. Upload the video first, then publish the lesson.
        </p>
      )}
    </Modal>
  );
}
