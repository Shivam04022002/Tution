import { Link } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import * as usersApi from '../api/users';
import * as financeApi from '../api/finance';
import * as coursesApi from '../api/courses';
import * as operationsApi from '../api/operations';
import { Card, CardHeader, Kpi } from '../components/ui/Primitives';
import { StatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState, InlineLoader } from '../components/common/States';
import { TableWrap } from '../components/ui/Table';
import { IconChevronRight, IconRefresh } from '../components/ui/Icons';
import {
  formatCurrencyCompact,
  formatDate,
  formatNumber,
  formatRelative,
  fullName,
  humanize,
} from '../utils/format';
import { categoryName } from '../utils/constants';

/**
 * Every figure below comes from a live admin endpoint. Where the backend has no
 * API for something (course enrollment rosters, for instance) the tile is simply
 * absent rather than filled with a placeholder.
 */
export function DashboardPage() {
  const stats = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: usersApi.getPlatformStats,
  });

  const revenue = useQuery({
    queryKey: ['admin', 'revenue', 'overview', '30d'],
    queryFn: () => financeApi.getRevenueOverview({ range: '30d' }),
  });

  const [courses, kyc, activity, recentParents, tickets] = useQueries({
    queries: [
      {
        queryKey: ['admin', 'courses', 'dashboard'],
        queryFn: () => coursesApi.listCourses({ page: 1, limit: 5 }),
      },
      {
        queryKey: ['admin', 'kyc', 'dashboard'],
        queryFn: () => operationsApi.getKycQueue({ status: 'submitted', page: 1, limit: 5 }),
      },
      {
        queryKey: ['admin', 'activity', 'dashboard'],
        queryFn: () => usersApi.getActivityLog({ page: 1, limit: 6 }),
      },
      {
        queryKey: ['admin', 'parents', 'dashboard'],
        queryFn: () => usersApi.getParents({ page: 1, limit: 6 }),
      },
      {
        queryKey: ['admin', 'tickets', 'stats'],
        queryFn: operationsApi.getTicketStats,
      },
    ],
  });

  const anyLoading = stats.isLoading || revenue.isLoading;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">Platform activity across parents, tutors, courses and revenue.</p>
        </div>
        <Button
          variant="secondary"
          icon={<IconRefresh size={14} />}
          onClick={() => {
            stats.refetch();
            revenue.refetch();
            courses.refetch();
            kyc.refetch();
            activity.refetch();
            recentParents.refetch();
            tickets.refetch();
          }}
        >
          Refresh
        </Button>
      </div>

      {stats.isError && !stats.data && (
        <Card>
          <ErrorState error={stats.error} onRetry={() => stats.refetch()} />
        </Card>
      )}

      <div className="grid grid-kpi">
        <Kpi
          label="Parents"
          value={formatNumber(stats.data?.totalParents)}
          foot="Active accounts"
          accent="#2D0A7D"
          loading={anyLoading}
        />
        <Kpi
          label="Tutors"
          value={formatNumber(stats.data?.totalTeachers)}
          foot={`${formatNumber(stats.data?.pendingTeachers)} awaiting approval`}
          accent="#5B21B6"
          loading={anyLoading}
        />
        <Kpi
          label="Active requirements"
          value={formatNumber(stats.data?.activeRequirements)}
          foot="Open parent requirements"
          accent="#EC4899"
          loading={anyLoading}
        />
        <Kpi
          label="Applications"
          value={formatNumber(stats.data?.totalApplications)}
          foot="Tutor applications"
          accent="#F59E0B"
          loading={anyLoading}
        />
        <Kpi
          label="Demo classes"
          value={formatNumber(stats.data?.totalDemoClasses)}
          foot="Scheduled demos"
          accent="#10B981"
          loading={anyLoading}
        />
        <Kpi
          label="Revenue · 30 days"
          value={formatCurrencyCompact(revenue.data?.revenue.total)}
          foot={
            revenue.data ? (
              <>
                <span
                  className={revenue.data.revenue.growth >= 0 ? 'delta-up' : 'delta-down'}
                >
                  {revenue.data.revenue.growth >= 0 ? '▲' : '▼'}{' '}
                  {Math.abs(revenue.data.revenue.growth).toFixed(1)}%
                </span>{' '}
                vs previous period
              </>
            ) : undefined
          }
          accent="#3B82F6"
          loading={revenue.isLoading}
        />
      </div>

      {/* ── Pending actions ─────────────────────────────────────────────── */}
      <div className="grid grid-3 mt-6">
        <PendingCard
          title="KYC submissions"
          value={kyc.data?.counts.submitted}
          loading={kyc.isLoading}
          error={kyc.isError}
          to="/verification"
          caption="Awaiting review"
        />
        <PendingCard
          title="Open tickets"
          value={tickets.data?.open}
          loading={tickets.isLoading}
          error={tickets.isError}
          to="/support/tickets"
          caption={tickets.data ? `${formatNumber(tickets.data.urgent)} urgent` : 'Support queue'}
        />
        <PendingCard
          title="Draft courses"
          value={courses.data?.summary.draft}
          loading={courses.isLoading}
          error={courses.isError}
          to="/marketplace/courses?status=draft"
          caption={courses.data ? `${formatNumber(courses.data.summary.published)} published` : 'Marketplace'}
        />
      </div>

      <div className="grid grid-2 mt-6">
        {/* ── Recent courses ────────────────────────────────────────────── */}
        <Card padded={false}>
          <CardHeader
            title="Recently updated courses"
            subtitle="Course marketplace catalogue"
            action={
              <Link to="/marketplace/courses" className="btn btn-ghost btn-sm">
                View all <IconChevronRight size={13} />
              </Link>
            }
          />
          {courses.isLoading && <InlineLoader />}
          {courses.isError && <ErrorState error={courses.error} onRetry={() => courses.refetch()} />}
          {courses.isSuccess &&
            (courses.data.courses.length === 0 ? (
              <EmptyState
                title="No courses yet"
                message="Create the first course to start building the marketplace."
                action={
                  <Link to="/marketplace/courses/new" className="btn btn-primary btn-sm">
                    New course
                  </Link>
                }
              />
            ) : (
              <TableWrap>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Course</th>
                      <th>Category</th>
                      <th className="num">Lessons</th>
                      <th className="num">Enrolled</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courses.data.courses.map((course) => (
                      <tr key={course._id}>
                        <td>
                          <Link to={`/marketplace/courses/${course._id}`} className="cell-primary">
                            {course.title}
                          </Link>
                          <div className="cell-sub">{formatDate(course.updatedAt)}</div>
                        </td>
                        <td className="muted">{categoryName(course.categoryId)}</td>
                        <td className="num">{formatNumber(course.lessonCount)}</td>
                        <td className="num">{formatNumber(course.enrollmentCount)}</td>
                        <td>
                          <StatusBadge status={course.isPublished ? 'published' : 'draft'} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            ))}
        </Card>

        {/* ── Recent parents ────────────────────────────────────────────── */}
        <Card padded={false}>
          <CardHeader
            title="Newest parents"
            subtitle="Most recent registrations"
            action={
              <Link to="/users/parents" className="btn btn-ghost btn-sm">
                View all <IconChevronRight size={13} />
              </Link>
            }
          />
          {recentParents.isLoading && <InlineLoader />}
          {recentParents.isError && (
            <ErrorState error={recentParents.error} onRetry={() => recentParents.refetch()} />
          )}
          {recentParents.isSuccess &&
            (recentParents.data.data.length === 0 ? (
              <EmptyState title="No parent accounts yet" />
            ) : (
              <TableWrap>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Parent</th>
                      <th className="num">Requirements</th>
                      <th>Joined</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentParents.data.data.map((parent) => (
                      <tr key={parent._id}>
                        <td>
                          <Link to={`/users/parents/${parent._id}`} className="cell-primary">
                            {fullName(parent.profile)}
                          </Link>
                          <div className="cell-sub truncate">{parent.email}</div>
                        </td>
                        <td className="num">{formatNumber(parent.requirementsCount)}</td>
                        <td className="muted nowrap">{formatDate(parent.createdAt)}</td>
                        <td>
                          <StatusBadge status={parent.isActive ? 'active' : 'inactive'} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            ))}
        </Card>
      </div>

      {/* ── Admin activity ──────────────────────────────────────────────── */}
      <Card padded={false} className="mt-6">
        <CardHeader
          title="Recent admin activity"
          subtitle="From the platform audit log"
          action={
            <Link to="/settings/activity" className="btn btn-ghost btn-sm">
              View log <IconChevronRight size={13} />
            </Link>
          }
        />
        {activity.isLoading && <InlineLoader />}
        {activity.isError && <ErrorState error={activity.error} onRetry={() => activity.refetch()} />}
        {activity.isSuccess &&
          (activity.data.data.length === 0 ? (
            <EmptyState title="No recorded activity yet" />
          ) : (
            <TableWrap>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Administrator</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.data.data.map((entry) => (
                    <tr key={entry._id}>
                      <td className="cell-primary">{humanize(entry.action)}</td>
                      <td className="muted">{humanize(entry.entityType)}</td>
                      <td className="muted">
                        {typeof entry.adminId === 'object' && entry.adminId
                          ? fullName(entry.adminId.profile) || entry.adminId.email
                          : '—'}
                      </td>
                      <td className="muted nowrap">{formatRelative(entry.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          ))}
      </Card>
    </div>
  );
}

function PendingCard({
  title,
  value,
  caption,
  to,
  loading,
  error,
}: {
  title: string;
  value: number | undefined;
  caption: string;
  to: string;
  loading: boolean;
  error: boolean;
}) {
  return (
    <Link to={to} className="card" style={{ display: 'block' }}>
      <div className="kpi">
        <span className="kpi-label">{title}</span>
        {loading ? (
          <div className="skel" style={{ height: 26, width: '40%', margin: '2px 0' }} />
        ) : (
          <span className="kpi-value" style={{ color: error ? 'var(--c-text-3)' : undefined }}>
            {error ? '—' : formatNumber(value ?? 0)}
          </span>
        )}
        <span className="kpi-foot">{error ? 'Could not load' : caption}</span>
      </div>
    </Link>
  );
}
