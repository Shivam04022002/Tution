import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as financeApi from '../../api/finance';
import { Avatar, Card, Kpi } from '../../components/ui/Primitives';
import { Button } from '../../components/ui/Button';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { FilterSelect, Select, TextArea, TextInput } from '../../components/ui/Form';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { PageHeader, SearchInput, Toolbar } from '../../components/common/ListToolbar';
import { EmptyState, ErrorState, TableSkeleton } from '../../components/common/States';
import { Pagination, TableHead, TableMessageRow, TableWrap } from '../../components/ui/Table';
import { useDebounced, useListParams } from '../../hooks';
import { SUBSCRIPTION_PLANS } from '../../utils/constants';
import { formatDate, formatNumber } from '../../utils/format';
import type { SubscriptionRow } from '../../types';

const COLUMNS = [
  { key: 'tutor', label: 'Tutor' },
  { key: 'plan', label: 'Plan' },
  { key: 'credits', label: 'Credits', align: 'right' as const },
  { key: 'usage', label: 'Unlocks used', align: 'right' as const },
  { key: 'start', label: 'Started' },
  { key: 'end', label: 'Expires' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: '', align: 'right' as const },
];

type ActionKind = 'upgrade' | 'downgrade' | 'extend' | 'suspend' | 'reactivate' | 'cancel';

export function SubscriptionsPage() {
  const { get, set, page, setPage } = useListParams();
  const queryClient = useQueryClient();

  const [searchText, setSearchText] = useState(get('search'));
  const search = useDebounced(searchText);
  const plan = get('plan');
  const status = get('status');

  const [action, setAction] = useState<{ kind: ActionKind; row: SubscriptionRow } | null>(null);

  const summary = useQuery({
    queryKey: ['admin', 'subscriptions', 'summary'],
    queryFn: financeApi.getSubscriptionSummary,
  });

  const query = useQuery({
    queryKey: ['admin', 'subscriptions', { search, plan, status, page }],
    queryFn: () => financeApi.listSubscriptions({ search, plan, status, page, limit: 20 }),
    placeholderData: keepPreviousData,
  });

  const rows = query.data?.subscriptions ?? [];
  const hasFilters = Boolean(search || plan || status);
  const distribution = summary.data?.planDistribution ?? {};

  return (
    <div className="page">
      <PageHeader
        title="Subscriptions"
        subtitle="Tutor subscription plans, credit allowances and their lifecycle."
      />

      <div className="grid grid-kpi mb-4">
        {SUBSCRIPTION_PLANS.map((planName, index) => (
          <Kpi
            key={planName}
            label={planName}
            value={formatNumber(distribution[planName] ?? 0)}
            foot="Active tutors"
            accent={['#94A3B8', '#3B82F6', '#5B21B6', '#2D0A7D'][index]}
            loading={summary.isLoading}
          />
        ))}
        <Kpi
          label="Expiring soon"
          value={formatNumber(summary.data?.upcomingExpirations)}
          foot={`${formatNumber(summary.data?.suspendedCount)} suspended`}
          accent="#F59E0B"
          loading={summary.isLoading}
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
            placeholder="Search tutor name or email…"
            ariaLabel="Search subscriptions"
          />
          <FilterSelect
            value={plan}
            onChange={(value) => set({ plan: value })}
            options={SUBSCRIPTION_PLANS.map((planName) => ({ value: planName, label: planName }))}
            placeholder="All plans"
            ariaLabel="Filter by plan"
          />
          <FilterSelect
            value={status}
            onChange={(value) => set({ status: value })}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'pending', label: 'Pending' },
              { value: 'suspended', label: 'Suspended' },
              { value: 'cancelled', label: 'Cancelled' },
              { value: 'expired', label: 'Expired' },
            ]}
            placeholder="All statuses"
            ariaLabel="Filter by status"
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

            {query.isSuccess && rows.length === 0 && (
              <TableMessageRow colSpan={COLUMNS.length}>
                <EmptyState
                  title="No subscriptions found"
                  message={
                    hasFilters
                      ? 'Try changing your filters or clearing the search.'
                      : 'Subscriptions appear once tutors take a plan.'
                  }
                  action={
                    hasFilters && (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setSearchText('');
                          set({ search: '', plan: '', status: '' });
                        }}
                      >
                        Clear filters
                      </Button>
                    )
                  }
                />
              </TableMessageRow>
            )}

            {query.isSuccess && rows.length > 0 && (
              <tbody>
                {rows.map((row) => (
                  <tr key={row._id}>
                    <td>
                      <div className="row gap-3">
                        <Avatar name={row.teacher?.fullName} src={row.teacher?.profilePhoto} />
                        <div style={{ minWidth: 0 }}>
                          <div className="cell-primary">{row.teacher?.fullName || '—'}</div>
                          <div className="cell-sub truncate">{row.teacher?.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={row.planName} dot={false} />
                    </td>
                    <td className="num">
                      {formatNumber(row.credits?.creditsRemaining)}
                      <span className="dim"> left</span>
                    </td>
                    <td className="num muted">{formatNumber(row.usage?.leadUnlocksUsed)}</td>
                    <td className="muted nowrap">{formatDate(row.startDate)}</td>
                    <td className="muted nowrap">{formatDate(row.endDate)}</td>
                    <td>
                      <div className="row gap-1 wrap">
                        <StatusBadge status={row.status} />
                        {row.autoRenew && <Badge tone="info">Auto-renew</Badge>}
                      </div>
                    </td>
                    <td className="actions">
                      <div className="row gap-1" style={{ justifyContent: 'flex-end' }}>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setAction({ kind: 'upgrade', row })}
                        >
                          Change plan
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setAction({ kind: 'extend', row })}
                        >
                          Extend
                        </Button>
                        {row.status === 'suspended' ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setAction({ kind: 'reactivate', row })}
                          >
                            Reactivate
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setAction({ kind: 'suspend', row })}
                          >
                            Suspend
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </TableWrap>

        {query.isSuccess && rows.length > 0 && (
          <div className="card-foot">
            <Pagination
              pagination={query.data.pagination}
              onChange={setPage}
              itemLabel="subscriptions"
            />
          </div>
        )}
      </Card>

      {action && (
        <SubscriptionActionModal
          kind={action.kind}
          row={action.row}
          onClose={() => setAction(null)}
          onDone={() => {
            setAction(null);
            queryClient.invalidateQueries({ queryKey: ['admin', 'subscriptions'] });
          }}
        />
      )}
    </div>
  );
}

const ACTION_COPY: Record<ActionKind, { title: string; confirm: string; destructive: boolean }> = {
  upgrade: { title: 'Change plan', confirm: 'Apply plan change', destructive: false },
  downgrade: { title: 'Downgrade plan', confirm: 'Downgrade', destructive: true },
  extend: { title: 'Extend subscription', confirm: 'Extend', destructive: false },
  suspend: { title: 'Suspend subscription', confirm: 'Suspend', destructive: true },
  reactivate: { title: 'Reactivate subscription', confirm: 'Reactivate', destructive: false },
  cancel: { title: 'Cancel subscription', confirm: 'Cancel subscription', destructive: true },
};

const PLAN_RANK: Record<string, number> = { free: 0, starter: 1, professional: 2, premium: 3 };

function SubscriptionActionModal({
  kind,
  row,
  onClose,
  onDone,
}: {
  kind: ActionKind;
  row: SubscriptionRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const copy = ACTION_COPY[kind];

  const [targetPlan, setTargetPlan] = useState<string>(row.planName);
  const [days, setDays] = useState('30');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const run = useMutation({
    mutationFn: () => {
      const teacherId = row.teacher.teacherId;
      switch (kind) {
        case 'upgrade': {
          // The API splits plan changes into upgrade/downgrade endpoints; pick
          // the right one from the plan ranking rather than asking the admin.
          const isDowngrade = PLAN_RANK[targetPlan] < PLAN_RANK[row.planName];
          return isDowngrade
            ? financeApi.downgradeSubscription(teacherId, targetPlan, reason)
            : financeApi.upgradeSubscription(teacherId, targetPlan, reason);
        }
        case 'downgrade':
          return financeApi.downgradeSubscription(teacherId, targetPlan, reason);
        case 'extend':
          return financeApi.extendSubscription(teacherId, Number(days), reason);
        case 'suspend':
          return financeApi.suspendSubscription(teacherId, reason);
        case 'reactivate':
          return financeApi.reactivateSubscription(teacherId, reason);
        case 'cancel':
          return financeApi.cancelSubscription(teacherId, reason);
      }
    },
    onSuccess: (result) => {
      toast.success(result?.message || 'Subscription updated');
      onDone();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Action failed'),
  });

  function submit() {
    const nextErrors: Record<string, string> = {};
    if (!reason.trim()) nextErrors.reason = 'A reason is required and is recorded in the audit log';
    if (kind === 'upgrade' && targetPlan === row.planName)
      nextErrors.targetPlan = 'Choose a different plan';
    if (kind === 'extend') {
      const value = Number(days);
      if (!Number.isInteger(value) || value <= 0)
        nextErrors.days = 'Enter a whole number of days greater than zero';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    run.mutate();
  }

  return (
    <Modal
      open
      size="sm"
      title={copy.title}
      description={row.teacher?.fullName}
      busy={run.isPending}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={run.isPending}>
            Cancel
          </Button>
          <Button
            variant={copy.destructive ? 'danger' : 'primary'}
            loading={run.isPending}
            onClick={submit}
          >
            {copy.confirm}
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 'var(--s-4)' }}>
        {kind === 'upgrade' && (
          <Select
            label="Target plan"
            value={targetPlan}
            error={errors.targetPlan}
            hint={`Currently on ${row.planName}.`}
            options={SUBSCRIPTION_PLANS.map((planName) => ({ value: planName, label: planName }))}
            onChange={(event) => setTargetPlan(event.target.value)}
          />
        )}

        {kind === 'extend' && (
          <TextInput
            label="Extend by (days)"
            type="number"
            min={1}
            step={1}
            value={days}
            error={errors.days}
            hint={`Current expiry: ${formatDate(row.endDate)}.`}
            onChange={(event) => setDays(event.target.value)}
          />
        )}

        <TextArea
          label="Reason"
          required
          rows={3}
          value={reason}
          error={errors.reason}
          placeholder="Why is this change being made?"
          onChange={(event) => setReason(event.target.value)}
        />
      </div>
    </Modal>
  );
}
