import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import * as coursesApi from '../../api/courses';
import { Card, Kpi } from '../../components/ui/Primitives';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { FilterSelect } from '../../components/ui/Form';
import { PageHeader, SearchInput, Toolbar } from '../../components/common/ListToolbar';
import { EmptyState, ErrorState, InlineLoader } from '../../components/common/States';
import { TableWrap } from '../../components/ui/Table';
import { useDebounced } from '../../hooks';
import { formatBytes, formatDate, formatDuration, formatNumber } from '../../utils/format';
import type { LessonVideoStatus } from '../../types';

interface VideoRow {
  courseId: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;
  lessonPublished: boolean;
  fileName: string;
  sizeLabel: string;
  size: number;
  mimeType: string;
  duration?: number;
  status: LessonVideoStatus;
  failureReason?: string;
  uploadedAt: string;
}

/**
 * Cross-course view of every uploaded lesson video.
 *
 * The list endpoint omits lessons, so the page loads the first page of courses
 * and then fetches each course's detail. Those detail responses are the same
 * cache entries the course pages use, so navigating between them costs nothing
 * extra. It covers the 50 most recently updated courses — the server's page cap.
 */
export function VideoLibraryPage() {
  const [searchText, setSearchText] = useState('');
  const search = useDebounced(searchText).toLowerCase();
  const [status, setStatus] = useState('');

  const courseList = useQuery({
    queryKey: ['admin', 'courses', 'video-library'],
    queryFn: () => coursesApi.listCourses({ page: 1, limit: 50 }),
  });

  // Only courses that actually have lessons are worth fetching in full.
  const candidates = (courseList.data?.courses ?? []).filter((course) => course.lessonCount > 0);

  const details = useQueries({
    queries: candidates.map((course) => ({
      queryKey: ['admin', 'course', course._id],
      queryFn: () => coursesApi.getCourse(course._id),
      staleTime: 60_000,
    })),
  });

  const stillLoading = details.some((detail) => detail.isLoading);

  const rows: VideoRow[] = [];
  for (const detail of details) {
    const course = detail.data?.course;
    if (!course) continue;
    for (const lesson of course.lessons ?? []) {
      if (!lesson.video) continue;
      rows.push({
        courseId: course._id,
        courseTitle: course.title,
        lessonId: lesson._id,
        lessonTitle: lesson.title,
        lessonPublished: lesson.isPublished,
        fileName: lesson.video.originalFileName,
        sizeLabel: lesson.video.sizeLabel,
        size: lesson.video.size,
        mimeType: lesson.video.mimeType,
        duration: lesson.video.duration,
        status: lesson.video.status,
        failureReason: lesson.video.failureReason,
        uploadedAt: lesson.video.uploadedAt,
      });
    }
  }

  rows.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

  const filtered = rows.filter((row) => {
    if (status && row.status !== status) return false;
    if (!search) return true;
    return (
      row.courseTitle.toLowerCase().includes(search) ||
      row.lessonTitle.toLowerCase().includes(search) ||
      row.fileName.toLowerCase().includes(search)
    );
  });

  const readyCount = rows.filter((row) => row.status === 'ready').length;
  const failedCount = rows.filter((row) => row.status === 'failed').length;
  const totalBytes = rows.reduce((sum, row) => sum + (row.size || 0), 0);
  const totalSeconds = rows.reduce((sum, row) => sum + (row.duration || 0), 0);

  return (
    <div className="page">
      <PageHeader
        title="Video library"
        subtitle="Every lesson video across the marketplace, newest upload first."
      />

      <div className="grid grid-kpi mb-4">
        <Kpi
          label="Videos"
          value={formatNumber(rows.length)}
          accent="#2D0A7D"
          loading={courseList.isLoading || stillLoading}
        />
        <Kpi
          label="Ready"
          value={formatNumber(readyCount)}
          foot="Playable by parents"
          accent="#10B981"
          loading={stillLoading}
        />
        <Kpi
          label="Failed"
          value={formatNumber(failedCount)}
          foot={failedCount > 0 ? 'Need re-upload' : 'None'}
          accent="#EF4444"
          loading={stillLoading}
        />
        <Kpi
          label="Total runtime"
          value={formatDuration(totalSeconds)}
          accent="#EC4899"
          loading={stillLoading}
        />
        <Kpi
          label="Storage used"
          value={formatBytes(totalBytes)}
          accent="#5B21B6"
          loading={stillLoading}
        />
      </div>

      <Card padded={false}>
        <Toolbar>
          <SearchInput
            value={searchText}
            onChange={setSearchText}
            placeholder="Search course, lesson or file name…"
            ariaLabel="Search videos"
          />
          <FilterSelect
            value={status}
            onChange={setStatus}
            options={[
              { value: 'ready', label: 'Ready' },
              { value: 'processing', label: 'Processing' },
              { value: 'failed', label: 'Failed' },
            ]}
            placeholder="All statuses"
            ariaLabel="Filter by video status"
          />
          {stillLoading && (
            <span className="dim text-xs row gap-2">
              <span className="spinner" style={{ width: 12, height: 12 }} /> Loading courses…
            </span>
          )}
        </Toolbar>

        {courseList.isLoading && <InlineLoader />}

        {courseList.isError && (
          <ErrorState error={courseList.error} onRetry={() => courseList.refetch()} />
        )}

        {courseList.isSuccess && !stillLoading && filtered.length === 0 && (
          <EmptyState
            title={rows.length === 0 ? 'No videos uploaded yet' : 'No videos match your filters'}
            message={
              rows.length === 0
                ? 'Upload a video from a course’s lessons screen to see it here.'
                : 'Try changing the status filter or clearing the search.'
            }
            action={
              rows.length === 0 ? (
                <Link to="/marketplace/courses" className="btn btn-primary btn-sm">
                  Go to courses
                </Link>
              ) : undefined
            }
          />
        )}

        {filtered.length > 0 && (
          <TableWrap>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Lesson</th>
                  <th>Course</th>
                  <th>File</th>
                  <th className="num">Size</th>
                  <th className="num">Duration</th>
                  <th>Uploaded</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={`${row.courseId}-${row.lessonId}`}>
                    <td>
                      <div className="cell-primary">{row.lessonTitle}</div>
                      <div className="cell-sub">
                        {row.lessonPublished ? 'Published lesson' : 'Draft lesson'}
                      </div>
                    </td>
                    <td>
                      <Link
                        to={`/marketplace/courses/${row.courseId}`}
                        className="truncate"
                        style={{ display: 'block', maxWidth: 220, color: 'var(--c-primary)' }}
                      >
                        {row.courseTitle}
                      </Link>
                    </td>
                    <td>
                      <div className="truncate" style={{ maxWidth: 220 }}>
                        {row.fileName}
                      </div>
                      <div className="cell-sub">{row.mimeType}</div>
                    </td>
                    <td className="num muted nowrap">{row.sizeLabel || formatBytes(row.size)}</td>
                    <td className="num muted nowrap">{formatDuration(row.duration)}</td>
                    <td className="muted nowrap">{formatDate(row.uploadedAt)}</td>
                    <td>
                      <div className="row gap-1 wrap">
                        <StatusBadge status={row.status} />
                        {row.status === 'failed' && row.failureReason && (
                          <Badge tone="error">{row.failureReason}</Badge>
                        )}
                      </div>
                    </td>
                    <td className="actions">
                      <Link
                        to={`/marketplace/courses/${row.courseId}/content`}
                        className="btn btn-ghost btn-sm"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}

        {filtered.length > 0 && (
          <div className="card-foot">
            <span className="pager-info">
              Showing <strong>{filtered.length}</strong> of <strong>{rows.length}</strong> videos
              across the {candidates.length} most recently updated courses.
            </span>
          </div>
        )}
      </Card>
    </div>
  );
}
