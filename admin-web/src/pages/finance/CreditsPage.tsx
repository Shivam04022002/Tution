import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as financeApi from '../../api/finance';
import { Avatar, Card, Tabs } from '../../components/ui/Primitives';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import { FilterSelect, TextArea, TextInput } from '../../components/ui/Form';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { PageHeader, SearchInput, Toolbar } from '../../components/common/ListToolbar';
import { EmptyState, ErrorState, TableSkeleton } from '../../components/common/States';
import { Pagination, TableHead, TableMessageRow, TableWrap } from '../../components/ui/Table';
import { useDebounced, useListParams } from '../../hooks';
import { SUBSCRIPTION_PLANS } from '../../utils/constants';
import { formatDateTime, formatNumber, humanize } from '../../utils/format';
import type { CreditBalanceRow } from '../../types';

const BALANCE_COLUMNS = [
  { key: 'tutor', label: 'Tutor' },
  { key: 'plan', label: 'Plan' },
  { key: 'remaining', label: 'Remaining', align: 'right' as const },
  { key: 'used', label: 'Used', align: 'right' as const },
  { key: 'unlocks', label: 'Lead unlocks', align: 'right' as const },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: '', align: 'right' as const },
];

const TRANSACTION_COLUMNS = [
  { key: 'transaction', label: 'Transaction' },
  { key: 'tutor', label: 'Tutor' },
  { key: 'type', label: 'Type' },
  { key: 'amount', label: 'Amount', align: 'right' as const },
  { key: 'balance', label: 'Balance after', align: 'right' as const },
  { key: 'description', label: 'Description' },
  { key: 'date', label: 'Date' },
];

type AdjustKind = 'grant' | 'deduct' | 'bonus';

export function CreditsPage() {
  const { get, set, page, setPage } = useListParams();
  const queryClient = useQueryClient();

  const tab = (get('tab') || 'balances') as 'balances' | 'transactions';
  const [searchText, setSearchText] = useState(get('search'));
  const search = useDebounced(searchText);
  const plan = get('plan');
  const type = get('type');

  const [adjusting, setAdjusting] = useState<{ kind: AdjustKind; row: CreditBalanceRow } | null>(
    null
  );

  const balances = useQuery({
    queryKey: ['admin', 'credits', 'balances', { search, plan, page }],
    queryFn: () => financeApi.listCredits({ search, plan, page, limit: 20 }),
    placeholderData: keepPreviousData,
    enabled: tab === 'balances',
  });

  const transactions = useQuery({
    queryKey: ['admin', 'credits', 'transactions', { type, page }],
    queryFn: () => financeApi.listCreditTransactions({ type, page, limit: 20 }),
    placeholderData: keepPreviousData,
    enabled: tab === 'transactions',
  });

  const rows = balances.data?.teachers ?? [];

  return (
    <div className="page">
      <PageHeader
        title="Credits"
        subtitle="Lead-unlock credit balances and the full ledger of credit movements."
      />

      <Card padded={false}>
        <div style={{ padding: '0 var(--s-4)' }}>
          <Tabs
            value={tab}
            onChange={(next) => set({ tab: next === 'balances' ? '' : next })}
            tabs={[
              { value: 'balances', label: 'Balances' },
              { value: 'transactions', label: 'Transaction ledger' },
            ]}
          />
        </div>

        {tab === 'balances' && (
          <>
            <Toolbar>
              <SearchInput
                value={searchText}
                onChange={(value) => {
                  setSearchText(value);
                  set({ search: value });
                }}
                placeholder="Search tutor name or email…"
                ariaLabel="Search credit balances"
              />
              <FilterSelect
                value={plan}
                onChange={(value) => set({ plan: value })}
                options={SUBSCRIPTION_PLANS.map((planName) => ({
                  value: planName,
                  label: planName,
                }))}
                placeholder="All plans"
                ariaLabel="Filter by plan"
              />
            </Toolbar>

            <TableWrap>
              <table className="tbl">
                <TableHead columns={BALANCE_COLUMNS} />

                {balances.isLoading && <TableSkeleton cols={BALANCE_COLUMNS.length} />}

                {balances.isError && (
                  <TableMessageRow colSpan={BALANCE_COLUMNS.length}>
                    <ErrorState error={balances.error} onRetry={() => balances.refetch()} />
                  </TableMessageRow>
                )}

                {balances.isSuccess && rows.length === 0 && (
                  <TableMessageRow colSpan={BALANCE_COLUMNS.length}>
                    <EmptyState
                      title="No credit balances found"
                      message="Balances appear once tutors have an active subscription."
                    />
                  </TableMessageRow>
                )}

                {balances.isSuccess && rows.length > 0 && (
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
                        <td className="num strong">
                          {formatNumber(row.credits?.creditsRemaining)}
                        </td>
                        <td className="num muted">{formatNumber(row.credits?.creditsUsed)}</td>
                        <td className="num muted">{formatNumber(row.usage?.leadUnlocksUsed)}</td>
                        <td>
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="actions">
                          <div className="row gap-1" style={{ justifyContent: 'flex-end' }}>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setAdjusting({ kind: 'grant', row })}
                            >
                              Grant
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setAdjusting({ kind: 'bonus', row })}
                            >
                              Bonus
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setAdjusting({ kind: 'deduct', row })}
                            >
                              Deduct
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                )}
              </table>
            </TableWrap>

            {balances.isSuccess && rows.length > 0 && (
              <div className="card-foot">
                <Pagination
                  pagination={balances.data.pagination}
                  onChange={setPage}
                  itemLabel="tutors"
                />
              </div>
            )}
          </>
        )}

        {tab === 'transactions' && (
          <>
            <Toolbar>
              <FilterSelect
                value={type}
                onChange={(value) => set({ type: value })}
                options={[
                  { value: 'CREDIT_GRANTED', label: 'Granted' },
                  { value: 'LEAD_UNLOCK', label: 'Lead unlock' },
                  { value: 'CREDIT_REFUND', label: 'Refund' },
                  { value: 'BONUS_CREDIT', label: 'Bonus' },
                ]}
                placeholder="All transaction types"
                ariaLabel="Filter by transaction type"
              />
            </Toolbar>

            <TableWrap>
              <table className="tbl">
                <TableHead columns={TRANSACTION_COLUMNS} />

                {transactions.isLoading && <TableSkeleton cols={TRANSACTION_COLUMNS.length} />}

                {transactions.isError && (
                  <TableMessageRow colSpan={TRANSACTION_COLUMNS.length}>
                    <ErrorState error={transactions.error} onRetry={() => transactions.refetch()} />
                  </TableMessageRow>
                )}

                {transactions.isSuccess && transactions.data.transactions.length === 0 && (
                  <TableMessageRow colSpan={TRANSACTION_COLUMNS.length}>
                    <EmptyState
                      title="No credit transactions"
                      message="Try removing the type filter to see the full ledger."
                    />
                  </TableMessageRow>
                )}

                {transactions.isSuccess && transactions.data.transactions.length > 0 && (
                  <tbody>
                    {transactions.data.transactions.map((entry) => (
                      <tr key={entry._id}>
                        <td className="mono cell-primary">{entry.transactionId}</td>
                        <td className="muted truncate" style={{ maxWidth: 180 }}>
                          {entry.teacher?.basicDetails?.fullName ?? '—'}
                        </td>
                        <td>
                          <span className="muted">{humanize(entry.type)}</span>
                        </td>
                        <td
                          className="num strong"
                          style={{ color: entry.amount < 0 ? 'var(--c-error)' : 'var(--c-success)' }}
                        >
                          {entry.amount > 0 ? '+' : ''}
                          {formatNumber(entry.amount)}
                        </td>
                        <td className="num muted">{formatNumber(entry.balanceAfter)}</td>
                        <td className="muted truncate" style={{ maxWidth: 260 }}>
                          {entry.description || '—'}
                        </td>
                        <td className="muted nowrap">{formatDateTime(entry.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                )}
              </table>
            </TableWrap>

            {transactions.isSuccess && transactions.data.transactions.length > 0 && (
              <div className="card-foot">
                <Pagination
                  pagination={transactions.data.pagination}
                  onChange={setPage}
                  itemLabel="transactions"
                />
              </div>
            )}
          </>
        )}
      </Card>

      {adjusting && (
        <AdjustCreditsModal
          kind={adjusting.kind}
          row={adjusting.row}
          onClose={() => setAdjusting(null)}
          onDone={() => {
            setAdjusting(null);
            queryClient.invalidateQueries({ queryKey: ['admin', 'credits'] });
          }}
        />
      )}
    </div>
  );
}

const ADJUST_COPY: Record<AdjustKind, { title: string; confirm: string; destructive: boolean; hint: string }> =
  {
    grant: {
      title: 'Grant credits',
      confirm: 'Grant credits',
      destructive: false,
      hint: 'Adds credits to the tutor’s balance and records a CREDIT_GRANTED transaction.',
    },
    bonus: {
      title: 'Grant bonus credits',
      confirm: 'Grant bonus',
      destructive: false,
      hint: 'Adds promotional credits and records a BONUS_CREDIT transaction.',
    },
    deduct: {
      title: 'Deduct credits',
      confirm: 'Deduct credits',
      destructive: true,
      hint: 'Removes credits from the tutor’s balance. Use for corrections.',
    },
  };

function AdjustCreditsModal({
  kind,
  row,
  onClose,
  onDone,
}: {
  kind: AdjustKind;
  row: CreditBalanceRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const copy = ADJUST_COPY[kind];

  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const run = useMutation({
    mutationFn: () => {
      const teacherId = row.teacher.teacherId;
      const value = Number(amount);
      if (kind === 'grant') return financeApi.grantCredits(teacherId, value, reason);
      if (kind === 'bonus') return financeApi.grantBonusCredits(teacherId, value, reason);
      return financeApi.deductCredits(teacherId, value, reason);
    },
    onSuccess: (result) => {
      toast.success(result?.message || 'Credits updated');
      onDone();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Adjustment failed'),
  });

  function submit() {
    const nextErrors: Record<string, string> = {};
    const value = Number(amount);

    if (!Number.isInteger(value) || value <= 0)
      nextErrors.amount = 'Enter a whole number greater than zero';
    else if (kind === 'deduct' && value > (row.credits?.creditsRemaining ?? 0))
      nextErrors.amount = `Only ${row.credits?.creditsRemaining ?? 0} credits are available to deduct`;

    if (!reason.trim()) nextErrors.reason = 'A reason is required and is recorded in the audit log';

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
      <p className="text-sm muted" style={{ lineHeight: 1.55 }}>
        {copy.hint} Current balance:{' '}
        <strong>{formatNumber(row.credits?.creditsRemaining)} credits</strong>.
      </p>

      <div className="mt-4" style={{ display: 'grid', gap: 'var(--s-4)' }}>
        <TextInput
          label="Amount"
          type="number"
          min={1}
          step={1}
          required
          value={amount}
          error={errors.amount}
          onChange={(event) => setAmount(event.target.value)}
        />
        <TextArea
          label="Reason"
          required
          rows={3}
          value={reason}
          error={errors.reason}
          placeholder="Why is this adjustment being made?"
          onChange={(event) => setReason(event.target.value)}
        />
      </div>
    </Modal>
  );
}
