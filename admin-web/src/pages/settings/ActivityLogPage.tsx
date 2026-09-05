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
          <DiffTable oldValue={inspecting.oldValue} newValue={inspecting.newValue} />

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

/** `verificationStatus` → `Verification status` */
function humanizeField(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');
  const lower = spaced.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function isPlainValue(value: unknown): value is string | number | boolean | null | undefined {
  return value === null || value === undefined || typeof value !== 'object';
}

function DiffCell({ value }: { value: unknown }) {
  if (value === undefined || value === null || value === '') return <span className="muted">—</span>;
  if (isPlainValue(value)) return <span className="mono">{String(value)}</span>;

  return (
    <pre
      className="mono"
      style={{
        padding: 'var(--s-2)',
        background: 'var(--c-bg-2)',
        borderRadius: 'var(--r-md)',
        fontSize: 11,
        lineHeight: 1.45,
        overflowX: 'auto',
        margin: 0,
        maxWidth: 260,
      }}
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

/**
 * Renders only the fields that actually differ between `oldValue` and
 * `newValue` — a raw side-by-side JSON dump is unreadable for a
 * non-technical admin, so this reduces each entry to a "field changed from X
 * to Y" table instead.
 */
function DiffTable({
  oldValue,
  newValue,
}: {
  oldValue?: Record<string, any> | null;
  newValue?: Record<string, any> | null;
}) {
  if (!oldValue && !newValue) {
    return <p className="text-sm muted">No before/after details were recorded for this action.</p>;
  }

  const keys = Array.from(new Set([...Object.keys(oldValue ?? {}), ...Object.keys(newValue ?? {})])).sort();

  const changed = keys.filter((key) => {
    const before = oldValue?.[key];
    const after = newValue?.[key];
    return JSON.stringify(before) !== JSON.stringify(after);
  });

  if (changed.length === 0) {
    return <p className="text-sm muted">No fields changed.</p>;
  }

  return (
    <TableWrap>
      <table className="tbl">
        <thead>
          <tr>
            <th>Field</th>
            <th>Before</th>
            <th>After</th>
          </tr>
        </thead>
        <tbody>
          {changed.map((key) => (
            <tr key={key}>
              <td className="cell-primary">{humanizeField(key)}</td>
              <td>
                <DiffCell value={oldValue?.[key]} />
              </td>
              <td>
                <DiffCell value={newValue?.[key]} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}
