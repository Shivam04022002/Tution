import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import * as usersApi from '../../api/users';
import { Avatar, Card, CardHeader, DefinitionList } from '../../components/ui/Primitives';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { ErrorState, InlineLoader } from '../../components/common/States';
import { IconChevronLeft } from '../../components/ui/Icons';
import { formatCurrency, formatDate } from '../../utils/format';

export function TutorDetailPage() {
  const { id = '' } = useParams();

  const query = useQuery({
    queryKey: ['admin', 'teacher', id],
    queryFn: () => usersApi.getTeacher(id),
    enabled: Boolean(id),
  });

  if (query.isLoading) {
    return (
      <div className="page">
        <InlineLoader label="Loading tutor…" />
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

  const tutor = query.data;
  const linkedUser = typeof tutor.userId === 'object' && tutor.userId ? tutor.userId : null;

  return (
    <div className="page">
      <Link to="/users/tutors" className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }}>
        <IconChevronLeft size={14} /> All tutors
      </Link>

      <Card>
        <div className="row gap-4 wrap">
          <Avatar name={tutor.basicDetails?.fullName} src={tutor.basicDetails?.profilePhoto} large />
          <div className="grow" style={{ minWidth: 200 }}>
            <h1 className="page-title">{tutor.basicDetails?.fullName || 'Unnamed tutor'}</h1>
            <p className="page-sub">{tutor.basicDetails?.email}</p>
          </div>
          <div className="row gap-2 wrap">
            <StatusBadge status={tutor.verificationStatus} />
            <StatusBadge status={tutor.isActive ? 'active' : 'inactive'} />
            {tutor.isBlocked && <Badge tone="error">Blocked</Badge>}
          </div>
        </div>

        {tutor.isBlocked && tutor.blockReason && (
          <div
            className="mt-4 text-sm"
            style={{
              background: 'var(--c-error-bg)',
              color: '#B91C1C',
              padding: 'var(--s-3)',
              borderRadius: 'var(--r-md)',
            }}
          >
            <strong>Block reason:</strong> {tutor.blockReason}
          </div>
        )}
      </Card>

      <div className="grid grid-2 mt-6">
        <Card>
          <CardHeader title="Profile" />
          <div style={{ paddingTop: 'var(--s-4)' }}>
            <DefinitionList
              items={[
                ['Email', tutor.basicDetails?.email || '—'],
                ['Mobile', <span className="mono">{tutor.basicDetails?.mobileNumber || '—'}</span>],
                ['City', tutor.locationAvailability?.city || '—'],
                ['Hourly rate', formatCurrency(tutor.pricingRevenue?.hourlyRate)],
                [
                  'Average rating',
                  tutor.stats?.averageRating ? tutor.stats.averageRating.toFixed(2) : 'Not rated yet',
                ],
                ['Registered', formatDate(tutor.createdAt)],
                ['Linked account', linkedUser?.email ?? '—'],
              ]}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Teaching" subtitle="Subjects and classes on the tutor profile" />
          <div style={{ paddingTop: 'var(--s-4)' }}>
            <p className="label">Subjects</p>
            <div className="row gap-2 wrap mt-2">
              {tutor.teachingDetails?.subjects?.length ? (
                tutor.teachingDetails.subjects.map((subject) => (
                  <Badge key={subject} tone="brand">
                    {subject}
                  </Badge>
                ))
              ) : (
                <span className="muted text-sm">No subjects listed</span>
              )}
            </div>

            <p className="label mt-6">Classes</p>
            <div className="row gap-2 wrap mt-2">
              {tutor.teachingDetails?.classes?.length ? (
                tutor.teachingDetails.classes.map((klass) => (
                  <Badge key={klass} tone="neutral">
                    {klass}
                  </Badge>
                ))
              ) : (
                <span className="muted text-sm">No classes listed</span>
              )}
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Assignments" />
        <p className="muted text-sm" style={{ paddingTop: 'var(--s-4)', lineHeight: 1.6 }}>
          Tutor-to-course and tutor-to-student assignment is not part of the current backend. Courses
          in the marketplace are authored by administrators (<span className="mono">createdBy</span>{' '}
          on the course), and tutors reach parents through requirements, applications and matching
          rather than a direct assignment. This section will show assignments once an API for them
          exists.
        </p>
      </Card>
    </div>
  );
}
