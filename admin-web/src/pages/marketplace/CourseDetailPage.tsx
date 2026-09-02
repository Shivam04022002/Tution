import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as coursesApi from '../../api/courses';
import { Card, CardHeader, DefinitionList, Kpi } from '../../components/ui/Primitives';
import { Button } from '../../components/ui/Button';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';
import { ErrorState, InlineLoader } from '../../components/common/States';
import { TableWrap } from '../../components/ui/Table';
import { IconChevronLeft, IconEdit, IconLayers } from '../../components/ui/Icons';
import { categoryEmoji, categoryName } from '../../utils/constants';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatDuration,
  formatNumber,
} from '../../utils/format';

export function CourseDetailPage() {
  const { id = '' } = useParams();
  const toast = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['admin', 'course', id],
    queryFn: () => coursesApi.getCourse(id),
    enabled: Boolean(id),
  });

  const publish = useMutation({
    mutationFn: (next: boolean) => coursesApi.setCoursePublished(id, next),
    onSuccess: (result) => {
      toast.success(result.message);
      queryClient.invalidateQueries({ queryKey: ['admin', 'course', id] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'courses'] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not update'),
  });

  if (query.isLoading) {
    return (
      <div className="page">
        <InlineLoader label="Loading course…" />
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
  const lessons = course.lessons ?? [];

  return (
    <div className="page">
      <Link to="/marketplace/courses" className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }}>
        <IconChevronLeft size={14} /> All courses
      </Link>

      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <div className="row gap-2 wrap" style={{ marginBottom: 6 }}>
            <StatusBadge status={course.isPublished ? 'published' : 'draft'} />
            <Badge tone="neutral">
              {categoryEmoji(course.categoryId)} {categoryName(course.categoryId)}
            </Badge>
            <Badge tone="neutral">{course.level}</Badge>
            {course.accessType === 'paid' ? (
              <Badge tone="brand">{formatCurrency(course.price)}</Badge>
            ) : (
              <Badge tone="success">Free</Badge>
            )}
          </div>
          <h1 className="page-title">{course.title}</h1>
        </div>

        <div className="row gap-2 wrap">
          <Link to={`/marketplace/courses/${id}/edit`} className="btn btn-secondary">
            <IconEdit size={14} /> Edit details
          </Link>
          <Link to={`/marketplace/courses/${id}/content`} className="btn btn-secondary">
            <IconLayers size={14} /> Lessons & videos
          </Link>
          <Button
            variant={course.isPublished ? 'ghost' : 'primary'}
            loading={publish.isPending}
            onClick={() => publish.mutate(!course.isPublished)}
          >
            {course.isPublished ? 'Unpublish' : 'Publish course'}
          </Button>
        </div>
      </div>

      {!course.isPublished && course.publishedLessonCount === 0 && (
        <div
          className="card mb-4 text-sm"
          style={{
            padding: 'var(--s-3) var(--s-4)',
            borderLeft: '3px solid var(--c-warning)',
            lineHeight: 1.55,
          }}
        >
          This course cannot be published yet — the backend requires at least one{' '}
          <strong>published lesson</strong>. Add a lesson, attach its video and publish the lesson
          first.
        </div>
      )}

      <div className="grid grid-kpi">
        <Kpi label="Lessons" value={formatNumber(course.lessonCount)} accent="#2D0A7D" />
        <Kpi
          label="Published lessons"
          value={formatNumber(course.publishedLessonCount)}
          foot="Visible to enrolled parents"
          accent="#10B981"
        />
        <Kpi label="Videos ready" value={formatNumber(course.videoCount)} accent="#5B21B6" />
        <Kpi
          label="Total runtime"
          value={formatDuration(course.totalDurationSeconds)}
          accent="#EC4899"
        />
        <Kpi
          label="Enrollments"
          value={formatNumber(course.enrollmentCount)}
          foot="Parents enrolled"
          accent="#F59E0B"
        />
      </div>

      <div className="grid grid-3 mt-6">
        <Card>
          <CardHeader title="Details" />
          <div style={{ paddingTop: 'var(--s-4)' }}>
            <DefinitionList
              items={[
                ['Category', categoryName(course.categoryId)],
                ['Level', course.level],
                ['Access', course.accessType === 'paid' ? 'Paid' : 'Free'],
                [
                  'Price',
                  course.accessType === 'paid'
                    ? `${formatCurrency(course.price)} ${course.currency}`
                    : '—',
                ],
                ['Created', formatDate(course.createdAt)],
                ['Last updated', formatDateTime(course.updatedAt)],
                ['Published at', course.publishedAt ? formatDateTime(course.publishedAt) : '—'],
              ]}
            />
          </div>
        </Card>

        <div style={{ gridColumn: 'span 2', minWidth: 0 }}>
          <Card>
            <CardHeader title="Description" subtitle="Shown to parents on the course page" />
            <p
              className="text-sm mt-4"
              style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65, color: 'var(--c-text-2)' }}
            >
              {course.description}
            </p>
          </Card>
        </div>
      </div>

      <Card padded={false} className="mt-6">
        <CardHeader
          title="Curriculum"
          subtitle={`${lessons.length} lesson${lessons.length === 1 ? '' : 's'}, in playback order`}
          action={
            <Link to={`/marketplace/courses/${id}/content`} className="btn btn-secondary btn-sm">
              Manage content
            </Link>
          }
        />
        {lessons.length === 0 ? (
          <div className="state">
            <p className="state-title">No lessons yet</p>
            <p className="state-msg">
              A course needs at least one published lesson before it can go live.
            </p>
            <div className="mt-2">
              <Link to={`/marketplace/courses/${id}/content`} className="btn btn-primary btn-sm">
                Add the first lesson
              </Link>
            </div>
          </div>
        ) : (
          <TableWrap>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 56 }}>#</th>
                  <th>Lesson</th>
                  <th>Video</th>
                  <th className="num">Duration</th>
                  <th>Preview</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {lessons.map((lesson, index) => (
                  <tr key={lesson._id}>
                    <td className="dim num">{index + 1}</td>
                    <td>
                      <div className="cell-primary">{lesson.title}</div>
                      {lesson.description && (
                        <div className="cell-sub truncate" style={{ maxWidth: 380 }}>
                          {lesson.description}
                        </div>
                      )}
                    </td>
                    <td>
                      {lesson.video ? (
                        <StatusBadge status={lesson.video.status} />
                      ) : (
                        <span className="dim">No video</span>
                      )}
                    </td>
                    <td className="num muted">{formatDuration(lesson.video?.duration)}</td>
                    <td>
                      {lesson.isFreePreview ? (
                        <Badge tone="info">Free preview</Badge>
                      ) : (
                        <span className="dim">—</span>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={lesson.isPublished ? 'published' : 'draft'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
