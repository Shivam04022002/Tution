import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as coursesApi from '../../api/courses';
import { Card, Kpi } from '../../components/ui/Primitives';
import { Button, IconButton } from '../../components/ui/Button';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { FilterSelect } from '../../components/ui/Form';
import { ConfirmDialog } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { PageHeader, SearchInput, Toolbar } from '../../components/common/ListToolbar';
import { EmptyState, ErrorState, TableSkeleton } from '../../components/common/States';
import { Pagination, TableHead, TableMessageRow, TableWrap } from '../../components/ui/Table';
import { IconEdit, IconLayers, IconPlus, IconTrash } from '../../components/ui/Icons';
import { useDebounced, useListParams } from '../../hooks';
import { categoryEmoji, categoryName, COURSE_CATEGORIES } from '../../utils/constants';
import { formatCurrency, formatDate, formatDuration, formatNumber } from '../../utils/format';
import type { AdminCourse } from '../../types';

const COLUMNS = [
  { key: 'course', label: 'Course' },
  { key: 'category', label: 'Category' },
  { key: 'access', label: 'Access' },
  { key: 'lessons', label: 'Lessons', align: 'right' as const },
  { key: 'videos', label: 'Videos', align: 'right' as const },
  { key: 'runtime', label: 'Runtime', align: 'right' as const },
  { key: 'enrolled', label: 'Enrolled', align: 'right' as const },
  { key: 'updated', label: 'Updated' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: '', align: 'right' as const },
];

export function CoursesPage() {
  const { get, set, page, setPage } = useListParams();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [searchText, setSearchText] = useState(get('search'));
  const search = useDebounced(searchText);
  const status = get('status');
  const categoryId = get('categoryId');

  const [deleting, setDeleting] = useState<AdminCourse | null>(null);

  const query = useQuery({
    queryKey: ['admin', 'courses', { search, status, categoryId, page }],
    queryFn: () =>
      coursesApi.listCourses({
        search,
        status: status === 'published' || status === 'draft' ? status : undefined,
        categoryId,
        page,
        limit: 20,
      }),
    placeholderData: keepPreviousData,
  });

  const publish = useMutation({
    mutationFn: ({ id, next }: { id: string; next: boolean }) =>
      coursesApi.setCoursePublished(id, next),
    onSuccess: (result) => {
      toast.success(result.message);
      queryClient.invalidateQueries({ queryKey: ['admin', 'courses'] });
    },
    // The backend refuses to publish a course with no published lessons and
    // explains why — surface that message rather than a generic failure.
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not update'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => coursesApi.deleteCourse(id),
    onSuccess: (result) => {
      toast.success(result.message || 'Course deleted');
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'courses'] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Delete failed'),
  });

  const courses = query.data?.courses ?? [];
  const summary = query.data?.summary;
  const hasFilters = Boolean(search || status || categoryId);

  return (
    <div className="page">
      <PageHeader
        title="Courses"
        subtitle="The course marketplace parents browse in the app. Publishing here makes a course visible to them."
        actions={
          <Button
            variant="primary"
            icon={<IconPlus size={15} />}
            onClick={() => navigate('/marketplace/courses/new')}
          >
            New course
          </Button>
        }
      />

      <div className="grid grid-kpi mb-4">
        <Kpi
          label="Total courses"
          value={formatNumber(summary?.total)}
          accent="#2D0A7D"
          loading={query.isLoading}
        />
        <Kpi
          label="Published"
          value={formatNumber(summary?.published)}
          foot="Visible to parents"
          accent="#10B981"
          loading={query.isLoading}
        />
        <Kpi
          label="Drafts"
          value={formatNumber(summary?.draft)}
          foot="Not yet visible"
          accent="#F59E0B"
          loading={query.isLoading}
        />
      </div>

      <Card padded={false}>
        <Toolbar>
          <SearchInput
            value={searchText}
            onChange={(value) => {
              setSearchText(value);
              set({ search: value });
            }}
            placeholder="Search course titles…"
            ariaLabel="Search courses"
          />
          <FilterSelect
            value={status}
            onChange={(value) => set({ status: value })}
            options={[
              { value: 'published', label: 'Published' },
              { value: 'draft', label: 'Draft' },
            ]}
            placeholder="All statuses"
            ariaLabel="Filter by publication status"
          />
          <FilterSelect
            value={categoryId}
            onChange={(value) => set({ categoryId: value })}
            options={COURSE_CATEGORIES.map((category) => ({
              value: category.id,
              label: category.name,
            }))}
            placeholder="All categories"
            ariaLabel="Filter by category"
          />
        </Toolbar>

        <TableWrap>
          <table className="tbl">
            <TableHead columns={COLUMNS} />

            {query.isLoading && <TableSkeleton cols={COLUMNS.length} />}

            {query.isError && (
              <TableMessageRow colSpan={COLUMNS.length}>
                <ErrorState error={query.error} onRetry={() => query.refetch()} />
              </TableMessageRow>
            )}

            {query.isSuccess && courses.length === 0 && (
              <TableMessageRow colSpan={COLUMNS.length}>
                <EmptyState
                  title="No courses found"
                  message={
                    hasFilters
                      ? 'Try changing your filters or create a new course.'
                      : 'Create your first course to start building the marketplace.'
                  }
                  action={
                    hasFilters ? (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setSearchText('');
                          set({ search: '', status: '', categoryId: '' });
                        }}
                      >
                        Clear filters
                      </Button>
                    ) : (
                      <Link to="/marketplace/courses/new" className="btn btn-primary">
                        New course
                      </Link>
                    )
                  }
                />
              </TableMessageRow>
            )}

            {query.isSuccess && courses.length > 0 && (
              <tbody>
                {courses.map((course) => (
                  <tr key={course._id}>
                    <td>
                      <div className="row gap-3">
                        <CourseThumb course={course} />
                        <div style={{ minWidth: 0 }}>
                          <Link
                            to={`/marketplace/courses/${course._id}`}
                            className="cell-primary truncate"
                            style={{ display: 'block', maxWidth: 260 }}
                          >
                            {course.title}
                          </Link>
                          <div className="cell-sub">{course.level}</div>
                        </div>
                      </div>
                    </td>
                    <td className="muted nowrap">
                      {categoryEmoji(course.categoryId)} {categoryName(course.categoryId)}
                    </td>
                    <td>
                      {course.accessType === 'paid' ? (
                        <Badge tone="brand">{formatCurrency(course.price)}</Badge>
                      ) : (
                        <Badge tone="neutral">Free</Badge>
                      )}
                    </td>
                    <td className="num">
                      {formatNumber(course.publishedLessonCount)}
                      <span className="dim"> / {course.lessonCount}</span>
                    </td>
                    <td className="num">{formatNumber(course.videoCount)}</td>
                    <td className="num muted nowrap">
                      {formatDuration(course.totalDurationSeconds)}
                    </td>
                    <td className="num">{formatNumber(course.enrollmentCount)}</td>
                    <td className="muted nowrap">{formatDate(course.updatedAt)}</td>
                    <td>
                      <StatusBadge status={course.isPublished ? 'published' : 'draft'} />
                    </td>
                    <td className="actions">
                      <div className="row gap-1" style={{ justifyContent: 'flex-end' }}>
                        <Button
                          size="sm"
                          variant={course.isPublished ? 'ghost' : 'primary'}
                          loading={publish.isPending && publish.variables?.id === course._id}
                          onClick={() =>
                            publish.mutate({ id: course._id, next: !course.isPublished })
                          }
                        >
                          {course.isPublished ? 'Unpublish' : 'Publish'}
                        </Button>
                        <Link
                          to={`/marketplace/courses/${course._id}/content`}
                          className="btn btn-ghost btn-icon"
                          aria-label="Manage content"
                          title="Lessons & videos"
                        >
                          <IconLayers size={15} />
                        </Link>
                        <Link
                          to={`/marketplace/courses/${course._id}/edit`}
                          className="btn btn-ghost btn-icon"
                          aria-label="Edit course"
                          title="Edit"
                        >
                          <IconEdit size={15} />
                        </Link>
                        <IconButton
                          label="Delete course"
                          onClick={() => setDeleting(course)}
                          disabled={course.isPublished}
                          title={
                            course.isPublished
                              ? 'Unpublish the course before deleting it'
                              : 'Delete course'
                          }
                        >
                          <IconTrash size={15} />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </TableWrap>

        {query.isSuccess && courses.length > 0 && (
          <div className="card-foot">
            <Pagination pagination={query.data.pagination} onChange={setPage} itemLabel="courses" />
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this course?"
        destructive
        confirmLabel="Delete course"
        busy={remove.isPending}
        message={
          <>
            <strong>{deleting?.title}</strong> will be removed along with its{' '}
            {deleting?.lessonCount ?? 0} lesson(s), every uploaded video and all{' '}
            {deleting?.enrollmentCount ?? 0} enrollment record(s). This cannot be undone.
          </>
        }
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting._id)}
      />
    </div>
  );
}

export function CourseThumb({ course }: { course: { thumbnailUrl?: string; categoryId: string } }) {
  if (course.thumbnailUrl) {
    return (
      <img
        src={course.thumbnailUrl}
        alt=""
        loading="lazy"
        style={{
          width: 44,
          height: 30,
          objectFit: 'cover',
          borderRadius: 'var(--r-sm)',
          flex: 'none',
          background: 'var(--c-bg-3)',
        }}
      />
    );
  }

  return (
    <span
      style={{
        width: 44,
        height: 30,
        borderRadius: 'var(--r-sm)',
        flex: 'none',
        background: 'var(--c-bg-2)',
        border: '1px solid var(--c-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 14,
      }}
      aria-hidden="true"
    >
      {categoryEmoji(course.categoryId)}
    </span>
  );
}
