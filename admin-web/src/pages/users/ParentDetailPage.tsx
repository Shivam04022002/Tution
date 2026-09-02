import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import * as usersApi from '../../api/users';
import { Avatar, Card, CardHeader, DefinitionList } from '../../components/ui/Primitives';
import { StatusBadge } from '../../components/ui/Badge';
import { ErrorState, EmptyState, InlineLoader } from '../../components/common/States';
import { TableWrap } from '../../components/ui/Table';
import { IconChevronLeft } from '../../components/ui/Icons';
import { formatDate, fullName, userPhone, userVerified } from '../../utils/format';

export function ParentDetailPage() {
  const { id = '' } = useParams();

  const query = useQuery({
    queryKey: ['admin', 'parent', id],
    queryFn: () => usersApi.getParent(id),
    enabled: Boolean(id),
  });

  if (query.isLoading) {
    return (
      <div className="page">
        <InlineLoader label="Loading parent…" />
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

  const parent = query.data;

  return (
    <div className="page">
      <Link to="/users/parents" className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }}>
        <IconChevronLeft size={14} /> All parents
      </Link>

      <Card>
        <div className="row gap-4 wrap">
          <Avatar name={fullName(parent.profile)} src={parent.profile?.profileImage} large />
          <div className="grow" style={{ minWidth: 200 }}>
            <h1 className="page-title">{fullName(parent.profile)}</h1>
            <p className="page-sub">{parent.email}</p>
          </div>
          <div className="row gap-2">
            <StatusBadge status={parent.isActive ? 'active' : 'inactive'} />
            {userVerified(parent) && <StatusBadge status="verified" />}
          </div>
        </div>
      </Card>

      <div className="grid grid-3 mt-6">
        <Card>
          <CardHeader title="Account" />
          <div style={{ paddingTop: 'var(--s-4)' }}>
            <DefinitionList
              items={[
                ['Email', parent.email],
                ['Phone', <span className="mono">{userPhone(parent)}</span>],
                ['Role', 'Parent'],
                ['Registered', formatDate(parent.createdAt)],
                ['Requirements', String(parent.requirementsCount ?? 0)],
              ]}
            />
          </div>
        </Card>

        <div style={{ gridColumn: 'span 2', minWidth: 0 }}>
          <Card padded={false}>
            <CardHeader
              title="Requirements"
              subtitle="Tuition requirements posted by this parent"
            />
            {(!parent.requirements || parent.requirements.length === 0) && (
              <EmptyState
                title="No requirements posted"
                message="This parent has not created a tuition requirement yet."
              />
            )}
            {parent.requirements && parent.requirements.length > 0 && (
              <TableWrap>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Requirement</th>
                      <th>Subjects</th>
                      <th>Grade</th>
                      <th>Posted</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parent.requirements.map((requirement) => (
                      <tr key={requirement._id}>
                        <td className="mono">{requirement.requirementId}</td>
                        <td>{requirement.subjects?.join(', ') || '—'}</td>
                        <td className="muted">{requirement.studentDetails?.grade || '—'}</td>
                        <td className="muted nowrap">{formatDate(requirement.createdAt)}</td>
                        <td>
                          <StatusBadge status={requirement.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
