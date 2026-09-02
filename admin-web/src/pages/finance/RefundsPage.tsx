import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as financeApi from '../../api/finance';
import { Card } from '../../components/ui/Primitives';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import { FilterSelect, TextArea } from '../../components/ui/Form';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { PageHeader, Toolbar } from '../../components/common/ListToolbar';
import { EmptyState, ErrorState, TableSkeleton } from '../../components/common/States';
import { Pagination, TableHead, TableMessageRow, TableWrap } from '../../components/ui/Table';
import { useListParams } from '../../hooks';
import { formatCurrency, formatDateTime, fullName } from '../../utils/format';
import type { RefundRequestRow } from '../../types';

const COLUMNS = [
  { key: 'request', label: 'Request' },
  { key: 'user', label: 'Requested by' },
  { key: 'payment', label: 'Original payment' },
  { key: 'amount', label: 'Amount', align: 'right' as const },
  { key: 'reason', label: 'Reason' },
  { key: 'date', label: 'Requested' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: '', align: 'right' as const },
];

export function RefundsPage() {
  const { get, set, page, setPage } = useListParams();
  const queryClient = useQueryClient();
  const status = get('status');

  const [decision, setDecision] = useState<{
    kind: 'approve' | 'reject';
    row: RefundRequestRow;
  } | null>(null);

  const query = useQuery({
    queryKey: ['admin', 'refunds', { status, page }],
    queryFn: () => financeApi.listRefunds({ status, page, limit: 20 }),
    placeholderData: keepPreviousData,
  });

  const rows = query.data?.requests ?? [];

  return (
    <div className="page">
      <PageHeader
        title="Refunds"
        subtitle="Refund requests raised against completed payments. Approving triggers the payment gateway refund."
      />

      <Card padded={false}>
        <Toolbar>
          <FilterSelect
            value={status}
            onChange={(value) => set({ status: value })}
            options={[
              { value: 'pending', label: 'Pending' },
              { value: 'approved', label: 'Approved' },
              { value: 'rejected', label: 'Rejected' },
              { value: 'processed', label: 'Processed' },
            ]}
            placeholder="All statuses"
            ariaLabel="Filter by refund status"
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
                  title="No refund requests"
                  message={
                    status
                      ? 'No requests with this status. Try clearing the filter.'
                      : 'Refund requests raised by users will appear here for review.'
                  }
                  action={
                    status && (
                      <Button variant="secondary" onClick={() => set({ status: '' })}>
                        Clear filter
                      </Button>
                    )
                  }
                />
              </TableMessageRow>
            )}

            {query.isSuccess && rows.length > 0 && (
              <tbody>
                {rows.map((row) => {
                  const payment = typeof row.paymentId === 'object' ? row.paymentId : null;
                  const user = typeof row.userId === 'object' ? row.userId : null;
                  const pending = String(row.status).toLowerCase() === 'pending';

                  return (
                    <tr key={row._id}>
                      <td className="mono cell-primary">{row.refundId || row._id.slice(-8)}</td>
                      <td>
                        <div className="truncate" style={{ maxWidth: 180 }}>
                          {fullName(user?.profile)}
                        </div>
                        <div className="cell-sub truncate" style={{ maxWidth: 180 }}>
                          {user?.email ?? '—'}
                        </div>
                      </td>
                      <td>
                        <div className="mono text-xs">{payment?.paymentId ?? '—'}</div>
                        <div className="cell-sub">{formatCurrency(payment?.totalAmount)}</div>
                      </td>
                      <td className="num strong">{formatCurrency(row.amount, true)}</td>
                      <td className="muted truncate" style={{ maxWidth: 220 }}>
                        {row.reason || '—'}
                      </td>
                      <td className="muted nowrap">{formatDateTime(row.createdAt)}</td>
                      <td>
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="actions">
                        {pending ? (
                          <div className="row gap-1" style={{ justifyContent: 'flex-end' }}>
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => setDecision({ kind: 'approve', row })}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDecision({ kind: 'reject', row })}
                            >
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="dim text-xs">
                            {row.processedAt ? formatDateTime(row.processedAt) : 'Decided'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            )}
          </table>
        </TableWrap>

        {query.isSuccess && rows.length > 0 && (
          <div className="card-foot">
            <Pagination pagination={query.data.pagination} onChange={setPage} itemLabel="requests" />
          </div>
        )}
      </Card>

      {decision && (
        <RefundDecisionModal
          kind={decision.kind}
          row={decision.row}
          onClose={() => setDecision(null)}
          onDone={() => {
            setDecision(null);
            queryClient.invalidateQueries({ queryKey: ['admin', 'refunds'] });
            queryClient.invalidateQueries({ queryKey: ['admin', 'revenue'] });
          }}
        />
      )}
    </div>
  );
}

function RefundDecisionModal({
  kind,
  row,
  onClose,
  onDone,
}: {
  kind: 'approve' | 'reject';
  row: RefundRequestRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const run = useMutation({
    mutationFn: () =>
      kind === 'approve'
        ? financeApi.approveRefund(row._id, notes.trim() || undefined)
        : financeApi.rejectRefund(row._id, notes.trim()),
    onSuccess: (result) => {
      toast.success(result?.message || (kind === 'approve' ? 'Refund approved' : 'Refund rejected'));
      onDone();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Action failed'),
  });

  function submit() {
    if (kind === 'reject' && !notes.trim()) {
      setError('A rejection reason is required and is shown to the user.');
      return;
    }
    setError('');
    run.mutate();
  }

  return (
    <Modal
      open
      size="sm"
      title={kind === 'approve' ? 'Approve this refund?' : 'Reject this refund?'}
      description={row.refundId || row._id}
      busy={run.isPending}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={run.isPending}>
            Cancel
          </Button>
          <Button
            variant={kind === 'approve' ? 'primary' : 'danger'}
            loading={run.isPending}
            onClick={submit}
          >
            {kind === 'approve' ? 'Approve refund' : 'Reject refund'}
          </Button>
        </>
      }
    >
      <p className="text-sm muted" style={{ lineHeight: 1.55 }}>
        {kind === 'approve' ? (
          <>
            Approving initiates a real refund of{' '}
            <strong style={{ color: 'var(--c-text)' }}>{formatCurrency(row.amount, true)}</strong>{' '}
            through the payment gateway. This moves money and cannot be reversed from the console.
          </>
        ) : (
          <>The user is told the request was rejected, along with the reason you give below.</>
        )}
      </p>

      <div className="mt-4">
        <TextArea
          label={kind === 'approve' ? 'Admin notes' : 'Rejection reason'}
          required={kind === 'reject'}
          rows={3}
          value={notes}
          error={error}
          placeholder={
            kind === 'approve'
              ? 'Optional note stored with the refund record.'
              : 'Explain why this refund is being declined.'
          }
          onChange={(event) => {
            setNotes(event.target.value);
            if (error) setError('');
          }}
        />
      </div>
    </Modal>
  );
}
