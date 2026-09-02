import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as usersApi from '../../api/users';
import { Avatar, Card } from '../../components/ui/Primitives';
import { Button } from '../../components/ui/Button';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { FilterSelect, TextArea } from '../../components/ui/Form';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { PageHeader, SearchInput, Toolbar } from '../../components/common/ListToolbar';
import { EmptyState, ErrorState, TableSkeleton } from '../../components/common/States';
import { Pagination, TableHead, TableMessageRow, TableWrap } from '../../components/ui/Table';
import { IconEye } from '../../components/ui/Icons';
import { useDebounced, useListParams } from '../../hooks';
import { formatCurrency, formatDate } from '../../utils/format';
import type { AdminTeacher } from '../../types';

const COLUMNS = [
  { key: 'tutor', label: 'Tutor' },
  { key: 'subjects', label: 'Subjects' },
  { key: 'city', label: 'City' },
  { key: 'rate', label: 'Hourly rate', align: 'right' as const },
  { key: 'rating', label: 'Rating', align: 'right' as const },
  { key: 'joined', label: 'Joined' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: '', align: 'right' as const },
];

type PendingAction =
  | { kind: 'approve'; tutor: AdminTeacher }
  | { kind: 'reject'; tutor: AdminTeacher }
  | { kind: 'block'; tutor: AdminTeacher }
  | { kind: 'unblock'; tutor: AdminTeacher };

export function TutorsPage() {
  const { get, set, page, setPage } = useListParams();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [searchText, setSearchText] = useState(get('search'));
  const search = useDebounced(searchText);
  const verificationStatus = get('verificationStatus');
  const city = get('city');

  const [pending, setPending] = useState<PendingAction | null>(null);

  const query = useQuery({
    queryKey: ['admin', 'teachers', { search, verificationStatus, city, page }],
    queryFn: () => usersApi.getTeachers({ search, verificationStatus, city, page, limit: 20 }),
    placeholderData: keepPreviousData,
  });

  const action = useMutation({
    mutationFn: async ({ kind, tutor, reason }: PendingAction & { reason?: string }) => {
      switch (kind) {
        case 'approve':
          return usersApi.approveTeacher(tutor._id);
        case 'reject':
          return usersApi.rejectTeacher(tutor._id, reason ?? '');
        case 'block':
          return usersApi.blockTeacher(tutor._id, reason ?? '');
        case 'unblock':
          return usersApi.unblockTeacher(tutor._id);
      }
    },
    onSuccess: (result) => {
      toast.success(result?.message || 'Tutor updated');
      setPending(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'teachers'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Action failed'),
  });

  const tutors = query.data?.data ?? [];
  const hasFilters = Boolean(search || verificationStatus || city);

  return (
    <div className="page">
      <PageHeader
        title="Tutors"
        subtitle="Tutor profiles, verification state and marketplace availability."
      />

      <Card padded={false}>
        <Toolbar>
          <SearchInput
            value={searchText}
            onChange={(value) => {
              setSearchText(value);
              set({ search: value });
            }}
            placeholder="Search name, email or mobile…"
            ariaLabel="Search tutors"
          />
          <FilterSelect
            value={verificationStatus}
            onChange={(value) => set({ verificationStatus: value })}
            options={[
              { value: 'pending', label: 'Pending' },
              { value: 'verified', label: 'Verified' },
              { value: 'rejected', label: 'Rejected' },
            ]}
            placeholder="All verification"
            ariaLabel="Filter by verification status"
          />
          <input
            className="control filter-select"
            style={{ maxWidth: 180 }}
            placeholder="Filter by city"
            aria-label="Filter by city"
            defaultValue={city}
            onBlur={(event) => set({ city: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === 'Enter') set({ city: (event.target as HTMLInputElement).value });
            }}
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

            {query.isSuccess && tutors.length === 0 && (
              <TableMessageRow colSpan={COLUMNS.length}>
                <EmptyState
                  title="No tutors found"
                  message={
                    hasFilters
                      ? 'Try changing your filters or clearing the search.'
                      : 'Tutor profiles appear here once teachers complete registration.'
                  }
                  action={
                    hasFilters && (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setSearchText('');
                          set({ search: '', verificationStatus: '', city: '' });
                        }}
                      >
                        Clear filters
                      </Button>
                    )
                  }
                />
              </TableMessageRow>
            )}

            {query.isSuccess && tutors.length > 0 && (
              <tbody>
                {tutors.map((tutor) => (
                  <tr key={tutor._id}>
                    <td>
                      <div className="row gap-3">
                        <Avatar
                          name={tutor.basicDetails?.fullName}
                          src={tutor.basicDetails?.profilePhoto}
                        />
                        <div style={{ minWidth: 0 }}>
                          <Link to={`/users/tutors/${tutor._id}`} className="cell-primary">
                            {tutor.basicDetails?.fullName || 'Unnamed tutor'}
                          </Link>
                          <div className="cell-sub truncate">{tutor.basicDetails?.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="muted">
                      <span className="truncate" style={{ display: 'block', maxWidth: 220 }}>
                        {tutor.teachingDetails?.subjects?.join(', ') || '—'}
                      </span>
                    </td>
                    <td className="muted">{tutor.locationAvailability?.city || '—'}</td>
                    <td className="num">{formatCurrency(tutor.pricingRevenue?.hourlyRate)}</td>
                    <td className="num">
                      {tutor.stats?.averageRating ? tutor.stats.averageRating.toFixed(1) : '—'}
                    </td>
                    <td className="muted nowrap">{formatDate(tutor.createdAt)}</td>
                    <td>
                      <div className="row gap-1 wrap">
                        <StatusBadge status={tutor.verificationStatus} />
                        {tutor.isBlocked && <Badge tone="error">Blocked</Badge>}
                      </div>
                    </td>
                    <td className="actions">
                      <div className="row gap-1" style={{ justifyContent: 'flex-end' }}>
                        {tutor.verificationStatus === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => setPending({ kind: 'approve', tutor })}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setPending({ kind: 'reject', tutor })}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        {tutor.verificationStatus !== 'pending' &&
                          (tutor.isBlocked ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setPending({ kind: 'unblock', tutor })}
                            >
                              Unblock
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setPending({ kind: 'block', tutor })}
                            >
                              Block
                            </Button>
                          ))}
                        <Link
                          to={`/users/tutors/${tutor._id}`}
                          className="btn btn-ghost btn-icon"
                          aria-label="View tutor"
                          title="View"
                        >
                          <IconEye size={15} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </TableWrap>

        {query.isSuccess && tutors.length > 0 && (
          <div className="card-foot">
            <Pagination pagination={query.data.pagination} onChange={setPage} itemLabel="tutors" />
          </div>
        )}
      </Card>

      {pending && (
        <TutorActionModal
          pending={pending}
          busy={action.isPending}
          onCancel={() => setPending(null)}
          onConfirm={(reason) => action.mutate({ ...pending, reason })}
        />
      )}
    </div>
  );
}

const ACTION_COPY: Record<
  PendingAction['kind'],
  { title: string; confirm: string; needsReason: boolean; destructive: boolean; body: string }
> = {
  approve: {
    title: 'Approve this tutor?',
    confirm: 'Approve tutor',
    needsReason: false,
    destructive: false,
    body: 'The tutor becomes verified and visible to parents in search and matching.',
  },
  reject: {
    title: 'Reject this tutor?',
    confirm: 'Reject tutor',
    needsReason: true,
    destructive: true,
    body: 'The tutor is marked rejected. The reason is stored and shown to them in the app.',
  },
  block: {
    title: 'Block this tutor?',
    confirm: 'Block tutor',
    needsReason: true,
    destructive: true,
    body: 'A blocked tutor cannot apply to requirements or be matched with parents.',
  },
  unblock: {
    title: 'Unblock this tutor?',
    confirm: 'Unblock tutor',
    needsReason: false,
    destructive: false,
    body: 'The tutor regains access to applications and matching immediately.',
  },
};

function TutorActionModal({
  pending,
  busy,
  onCancel,
  onConfirm,
}: {
  pending: PendingAction;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (reason?: string) => void;
}) {
  const copy = ACTION_COPY[pending.kind];
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  function submit() {
    if (copy.needsReason && !reason.trim()) {
      setError('A reason is required and is recorded in the audit log.');
      return;
    }
    onConfirm(reason.trim() || undefined);
  }

  return (
    <Modal
      open
      title={copy.title}
      description={pending.tutor.basicDetails?.fullName}
      size="sm"
      busy={busy}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant={copy.destructive ? 'danger' : 'primary'} loading={busy} onClick={submit}>
            {copy.confirm}
          </Button>
        </>
      }
    >
      <p className="text-sm muted" style={{ lineHeight: 1.55 }}>
        {copy.body}
      </p>
      {copy.needsReason && (
        <div className="mt-4">
          <TextArea
            label="Reason"
            required
            value={reason}
            error={error}
            placeholder="Explain why — this is stored with the record."
            onChange={(event) => {
              setReason(event.target.value);
              if (error) setError('');
            }}
          />
        </div>
      )}
    </Modal>
  );
}
