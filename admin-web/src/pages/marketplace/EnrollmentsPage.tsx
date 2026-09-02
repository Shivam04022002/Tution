import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import * as coursesApi from '../../api/courses';
import { Card, CardHeader, Kpi, ProgressBar } from '../../components/ui/Primitives';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { PageHeader } from '../../components/common/ListToolbar';
import { EmptyState, ErrorState, InlineLoader } from '../../components/common/States';
import { TableWrap } from '../../components/ui/Table';
import { IconAlert } from '../../components/ui/Icons';
import { categoryName } from '../../utils/constants';
import { formatCurrency, formatNumber } from '../../utils/format';

/**
 * Course enrollments.
 *
 * The `CourseEnrollment` collection exists (courseId, parentId, status, source)
 * but no admin endpoint reads it — `/api/admin/courses` exposes only the
 * denormalised `enrollmentCount` per course. This page reports every figure the
 * API actually provides and states plainly what is missing, rather than
 * fabricating a roster.
 */
export function EnrollmentsPage() {
  const query = useQuery({
    queryKey: ['admin', 'courses', 'enrollments'],
    queryFn: () => coursesApi.listCourses({ page: 1, limit: 50 }),
  });

  const courses = [...(query.data?.courses ?? [])].sort(
    (a, b) => b.enrollmentCount - a.enrollmentCount
  );

  const totalEnrollments = courses.reduce((sum, course) => sum + course.enrollmentCount, 0);
  const enrolledCourses = courses.filter((course) => course.enrollmentCount > 0).length;
  const topCount = courses[0]?.enrollmentCount ?? 0;
  const paidEnrollments = courses
    .filter((course) => course.accessType === 'paid')
    .reduce((sum, course) => sum + course.enrollmentCount, 0);

  return (
    <div className="page">
      <PageHeader
        title="Enrollments"
        subtitle="Course enrollment volume across the marketplace."
      />

      <div
        className="card mb-4"
        style={{ padding: 'var(--s-3) var(--s-4)', display: 'flex', gap: 12, alignItems: 'flex-start' }}
      >
        <span style={{ color: 'var(--c-warning)', flex: 'none', marginTop: 1 }}>
          <IconAlert size={16} />
        </span>
        <p className="text-sm muted" style={{ lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--c-text)' }}>Backend gap.</strong> Per-enrollment records
          (which parent, when, payment status, progress) are stored in the{' '}
          <span className="mono">CourseEnrollment</span> collection but no admin API returns them —
          the course endpoints expose only the aggregate{' '}
          <span className="mono">enrollmentCount</span>. A searchable enrollment roster needs a new
          endpoint such as <span className="mono">GET /api/admin/enrollments</span> (filterable by
          course, parent and status). Everything shown below is real data from the existing API.
        </p>
      </div>

      <div className="grid grid-kpi">
        <Kpi
          label="Total enrollments"
          value={formatNumber(totalEnrollments)}
          foot="Across listed courses"
          accent="#2D0A7D"
          loading={query.isLoading}
        />
        <Kpi
          label="Courses with enrollments"
          value={formatNumber(enrolledCourses)}
          foot={`of ${courses.length} courses`}
          accent="#5B21B6"
          loading={query.isLoading}
        />
        <Kpi
          label="On paid courses"
          value={formatNumber(paidEnrollments)}
          foot="Enrollments on priced courses"
          accent="#F59E0B"
          loading={query.isLoading}
        />
        <Kpi
          label="Best performing"
          value={formatNumber(topCount)}
          foot={courses[0]?.title ?? '—'}
          accent="#10B981"
          loading={query.isLoading}
        />
      </div>

      <Card padded={false} className="mt-6">
        <CardHeader
          title="Enrollments by course"
          subtitle="Ordered by enrollment volume"
        />

        {query.isLoading && <InlineLoader />}
        {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}

        {query.isSuccess && courses.length === 0 && (
          <EmptyState
            title="No courses yet"
            message="Enrollment figures appear once courses exist and parents enrol."
          />
        )}

        {query.isSuccess && courses.length > 0 && (
          <TableWrap>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Category</th>
                  <th>Access</th>
                  <th className="num">Enrollments</th>
                  <th style={{ width: 180 }}>Share</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {courses.map((course) => (
                  <tr key={course._id}>
                    <td>
                      <Link
                        to={`/marketplace/courses/${course._id}`}
                        className="cell-primary truncate"
                        style={{ display: 'block', maxWidth: 300 }}
                      >
                        {course.title}
                      </Link>
                      <div className="cell-sub">
                        {course.lessonCount} lesson{course.lessonCount === 1 ? '' : 's'}
                      </div>
                    </td>
                    <td className="muted">{categoryName(course.categoryId)}</td>
                    <td>
                      {course.accessType === 'paid' ? (
                        <Badge tone="brand">{formatCurrency(course.price)}</Badge>
                      ) : (
                        <Badge tone="neutral">Free</Badge>
                      )}
                    </td>
                    <td className="num strong">{formatNumber(course.enrollmentCount)}</td>
                    <td>
                      <ProgressBar
                        percent={topCount > 0 ? (course.enrollmentCount / topCount) * 100 : 0}
                      />
                    </td>
                    <td>
                      <StatusBadge status={course.isPublished ? 'published' : 'draft'} />
                    </td>
                    <td className="actions">
                      <Link
                        to={`/marketplace/courses/${course._id}`}
                        className="btn btn-ghost btn-sm"
                      >
                        View
                      </Link>
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
