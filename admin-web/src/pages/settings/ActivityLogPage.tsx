import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import * as usersApi from '../../api/users';
import { Card } from '../../components/ui/Primitives';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Toolbar } from '../../components/common/ListToolbar';
import { FilterSelect } from '../../components/ui/Form';
import { EmptyState, ErrorState, TableSkeleton } from '../../components/common/States';
import { Pagination, TableHead, TableMessageRow, TableWrap } from '../../components/ui/Table';
import { useListParams } from '../../hooks';
import { formatDateTime, fullName, humanize } from '../../utils/format';
import type { ActivityEntry } from '../../types';

const COLUMNS = [
  { key: 'action', label: 'Action' },
  { key: 'entity', label: 'Entity' },
  { key: 'admin', label: 'Administrator' },
  { key: 'ip', label: 'IP address' },
  { key: 'when', label: 'When' },
  { key: 'actions', label: '', align: 'right' as const },
];

/** Read-only view of the platform's `AuditLog` collection. */
export function ActivityLogPage() {
  const { get, set, page, setPage } = useListParams();
  const entityType = get('entityType');
  const [inspecting, setInspecting] = useState<ActivityEntry | null>(null);

  const query = useQuery({
    queryKey: ['admin', 'activity', { entityType, page }],
    queryFn: () => usersApi.getActivityLog({ entityType, page, limit: 25 }),
    placeholderData: keepPreviousData,
  });

  const entries = query.data?.data ?? [];

  return (
    <Card padded={false}>
      <Toolbar>
        <span className="text-sm muted grow">
          Every administrative change is recorded here with the acting account and the before/after
          values.
        </span>
        <FilterSelect
          value={entityType}
          onChange={(value) => set({ entityType: value })}
          options={[
            { value: 'User', label: 'User' },
            { value: 'TeacherProfile', label: 'Tutor profile' },
            { value: 'Course', label: 'Course' },
            { value: 'TeacherSubscription', label: 'Subscription' },
            { value: 'PromoCode', label: 'Promo code' },
          ]}
          placeholder="All entity types"
          ariaLabel="Filter by entity type"
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

          {query.isSuccess && entries.length === 0 && (
            <TableMessageRow colSpan={COLUMNS.length}>
              <EmptyState
                title="No recorded activity"
                message={
                  entityType
                    ? 'No entries for this entity type. Try clearing the filter.'
                    : 'Administrative actions will be logged here as they happen.'
                }
              />
            </TableMessageRow>
          )}

          {query.isSuccess && entries.length > 0 && (
            <tbody>
              {entries.map((entry) => {
                const admin = typeof entry.adminId === 'object' ? entry.adminId : null;
                const hasDetail = Boolean(entry.oldValue || entry.newValue);

                return (
                  <tr key={entry._id}>
                    <td className="cell-primary">{humanize(entry.action)}</td>
                    <td>
                      <Badge tone="neutral">{humanize(entry.entityType)}</Badge>
                      <div className="cell-sub mono" style={{ marginTop: 3 }}>
                        {entry.entityId}
                      </div>
                    </td>
                    <td>
                      <div className="truncate" style={{ maxWidth: 180 }}>
                        {admin ? fullName(admin.profile) : '—'}
                      </div>
                      <div className="cell-sub truncate" style={{ maxWidth: 180 }}>
                        {admin?.email ?? ''}
                      </div>
                    </td>
                    <td className="mono muted text-xs">{entry.ipAddress ?? '—'}</td>
                    <td className="muted nowrap">{formatDateTime(entry.createdAt)}</td>
                    <td className="actions">
                      {hasDetail && (
                        <Button size="sm" variant="ghost" onClick={() => setInspecting(entry)}>
                          Changes
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          )}
        </table>
      </TableWrap>

      {query.isSuccess && entries.length > 0 && (
        <div className="card-foot">
          <Pagination pagination={query.data.pagination} onChange={setPage} itemLabel="entries" />
        </div>
      )}

      {inspecting && (
        <Modal
          open
          size="lg"
          title={humanize(inspecting.action)}
          description={`${humanize(inspecting.entityType)} · ${formatDateTime(inspecting.createdAt)}`}
          onClose={() => setInspecting(null)}
          footer={
            <Button variant="secondary" onClick={() => setInspecting(null)}>
              Close
            </Button>
          }
        >
          <div className="grid grid-2">
            <div>
              <p className="label mb-4">Before</p>
              <JsonBlock value={inspecting.oldValue} />
            </div>
            <div>
              <p className="label mb-4">After</p>
              <JsonBlock value={inspecting.newValue} />
            </div>
          </div>

          {inspecting.userAgent && (
            <p className="field-hint mt-6">
              User agent: <span className="mono">{inspecting.userAgent}</span>
            </p>
          )}
        </Modal>
      )}
    </Card>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre
      className="mono"
      style={{
        padding: 'var(--s-3)',
        background: 'var(--c-bg-2)',
        borderRadius: 'var(--r-md)',
        fontSize: 11.5,
        lineHeight: 1.5,
        overflowX: 'auto',
        margin: 0,
        maxHeight: 300,
      }}
    >
      {value ? JSON.stringify(value, null, 2) : '—'}
    </pre>
  );
}
