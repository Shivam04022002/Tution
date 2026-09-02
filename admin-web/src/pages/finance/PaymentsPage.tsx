import { keepPreviousData, useQuery } from '@tanstack/react-query';
import * as financeApi from '../../api/finance';
import { Card, CardHeader, Kpi, Tabs } from '../../components/ui/Primitives';
import { StatusBadge } from '../../components/ui/Badge';
import { PageHeader } from '../../components/common/ListToolbar';
import { RangeFilter, useRangeFilters } from '../../components/common/RangeFilter';
import { EmptyState, ErrorState, TableSkeleton } from '../../components/common/States';
import { Pagination, TableHead, TableMessageRow, TableWrap } from '../../components/ui/Table';
import { useListParams } from '../../hooks';
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  formatPercent,
  fullName,
  humanize,
} from '../../utils/format';

const PAYMENT_COLUMNS = [
  { key: 'payment', label: 'Payment' },
  { key: 'user', label: 'User' },
  { key: 'type', label: 'Type' },
  { key: 'method', label: 'Method' },
  { key: 'amount', label: 'Amount', align: 'right' as const },
  { key: 'gst', label: 'GST', align: 'right' as const },
  { key: 'date', label: 'Date' },
  { key: 'status', label: 'Status' },
];

const INVOICE_COLUMNS = [
  { key: 'invoice', label: 'Invoice' },
  { key: 'buyer', label: 'Buyer' },
  { key: 'total', label: 'Grand total', align: 'right' as const },
  { key: 'gst', label: 'GST', align: 'right' as const },
  { key: 'date', label: 'Invoice date' },
  { key: 'status', label: 'Status' },
];

export function PaymentsPage() {
  const { get, set, page, setPage } = useListParams();
  const { filters, range, from, to } = useRangeFilters(get);
  const tab = (get('tab') || 'payments') as 'payments' | 'invoices';

  const payments = useQuery({
    queryKey: ['admin', 'payments', filters, page],
    queryFn: () => financeApi.getPaymentMetrics(filters, page, 20),
    placeholderData: keepPreviousData,
    enabled: tab === 'payments',
  });

  const invoices = useQuery({
    queryKey: ['admin', 'invoices', filters, page],
    queryFn: () => financeApi.getInvoiceMetrics(filters, page, 20),
    placeholderData: keepPreviousData,
    enabled: tab === 'invoices',
  });

  const summary = payments.data?.summary;

  return (
    <div className="page">
      <PageHeader
        title="Payments"
        subtitle="Transactions and GST invoices recorded by the payment system."
        actions={
          <RangeFilter
            range={range}
            from={from}
            to={to}
            onChange={(next) => set({ ...next })}
          />
        }
      />

      <div className="grid grid-kpi mb-4">
        <Kpi
          label="Total revenue"
          value={formatCurrency(summary?.totalRevenue)}
          accent="#2D0A7D"
          loading={payments.isLoading}
        />
        <Kpi
          label="Transactions"
          value={formatNumber(summary?.total)}
          foot={summary ? `${formatNumber(summary.completed)} completed` : undefined}
          accent="#5B21B6"
          loading={payments.isLoading}
        />
        <Kpi
          label="Success rate"
          value={formatPercent(summary?.successRate)}
          foot={summary ? `${formatNumber(summary.failed)} failed` : undefined}
          accent="#10B981"
          loading={payments.isLoading}
        />
        <Kpi
          label="Average value"
          value={formatCurrency(summary?.avgTxValue)}
          accent="#EC4899"
          loading={payments.isLoading}
        />
        <Kpi
          label="Refunded"
          value={formatNumber(summary?.refunded)}
          foot={summary ? `${formatNumber(summary.pending)} pending` : undefined}
          accent="#3B82F6"
          loading={payments.isLoading}
        />
      </div>

      <Card padded={false}>
        <div style={{ padding: '0 var(--s-4)' }}>
          <Tabs
            value={tab}
            onChange={(next) => set({ tab: next === 'payments' ? '' : next })}
            tabs={[
              { value: 'payments', label: 'Transactions' },
              { value: 'invoices', label: 'Invoices' },
            ]}
          />
        </div>

        {tab === 'payments' && (
          <>
            <TableWrap>
              <table className="tbl">
                <TableHead columns={PAYMENT_COLUMNS} />

                {payments.isLoading && <TableSkeleton cols={PAYMENT_COLUMNS.length} />}

                {payments.isError && (
                  <TableMessageRow colSpan={PAYMENT_COLUMNS.length}>
                    <ErrorState error={payments.error} onRetry={() => payments.refetch()} />
                  </TableMessageRow>
                )}

                {payments.isSuccess && payments.data.payments.length === 0 && (
                  <TableMessageRow colSpan={PAYMENT_COLUMNS.length}>
                    <EmptyState
                      title="No transactions in this period"
                      message="Choose a wider date range to see payment activity."
                    />
                  </TableMessageRow>
                )}

                {payments.isSuccess && payments.data.payments.length > 0 && (
                  <tbody>
                    {payments.data.payments.map((payment) => (
                      <tr key={payment.paymentId}>
                        <td>
                          <div className="mono cell-primary">{payment.paymentId}</div>
                          {payment.invoiceNumber && (
                            <div className="cell-sub mono">{payment.invoiceNumber}</div>
                          )}
                        </td>
                        <td>
                          <div className="truncate" style={{ maxWidth: 180 }}>
                            {fullName(payment.user?.profile)}
                          </div>
                          <div className="cell-sub truncate" style={{ maxWidth: 180 }}>
                            {payment.user?.email ?? '—'}
                          </div>
                        </td>
                        <td className="muted">{humanize(payment.type)}</td>
                        <td className="muted">{humanize(payment.paymentMethod)}</td>
                        <td className="num strong">{formatCurrency(payment.totalAmount, true)}</td>
                        <td className="num muted">{formatCurrency(payment.gstAmount, true)}</td>
                        <td className="muted nowrap">
                          {formatDateTime(payment.paymentDate || payment.createdAt)}
                        </td>
                        <td>
                          <StatusBadge status={payment.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                )}
              </table>
            </TableWrap>

            {payments.isSuccess && payments.data.payments.length > 0 && (
              <div className="card-foot">
                <Pagination
                  pagination={payments.data.pagination}
                  onChange={setPage}
                  itemLabel="transactions"
                />
              </div>
            )}
          </>
        )}

        {tab === 'invoices' && (
          <>
            <TableWrap>
              <table className="tbl">
                <TableHead columns={INVOICE_COLUMNS} />

                {invoices.isLoading && <TableSkeleton cols={INVOICE_COLUMNS.length} />}

                {invoices.isError && (
                  <TableMessageRow colSpan={INVOICE_COLUMNS.length}>
                    <ErrorState error={invoices.error} onRetry={() => invoices.refetch()} />
                  </TableMessageRow>
                )}

                {invoices.isSuccess && invoices.data.invoices.length === 0 && (
                  <TableMessageRow colSpan={INVOICE_COLUMNS.length}>
                    <EmptyState title="No invoices in this period" />
                  </TableMessageRow>
                )}

                {invoices.isSuccess && invoices.data.invoices.length > 0 && (
                  <tbody>
                    {invoices.data.invoices.map((invoice) => (
                      <tr key={invoice._id}>
                        <td className="mono cell-primary">{invoice.invoiceNumber}</td>
                        <td>
                          <div className="truncate" style={{ maxWidth: 200 }}>
                            {invoice.buyer?.name || fullName(invoice.user?.profile)}
                          </div>
                          <div className="cell-sub truncate" style={{ maxWidth: 200 }}>
                            {invoice.buyer?.email || invoice.user?.email || '—'}
                          </div>
                        </td>
                        <td className="num strong">{formatCurrency(invoice.grandTotal, true)}</td>
                        <td className="num muted">{formatCurrency(invoice.gstTotal, true)}</td>
                        <td className="muted nowrap">{formatDateTime(invoice.invoiceDate)}</td>
                        <td>
                          <StatusBadge status={invoice.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                )}
              </table>
            </TableWrap>

            {invoices.isSuccess && invoices.data.invoices.length > 0 && (
              <>
                <div className="card-foot">
                  <Pagination
                    pagination={invoices.data.pagination}
                    onChange={setPage}
                    itemLabel="invoices"
                  />
                </div>
              </>
            )}
          </>
        )}
      </Card>

      {tab === 'payments' && payments.data && payments.data.byType.length > 0 && (
        <div className="grid grid-2 mt-6">
          <Card padded={false}>
            <CardHeader title="By transaction type" />
            <TableWrap>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th className="num">Count</th>
                    <th className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.data.byType.map((entry) => (
                    <tr key={entry.type}>
                      <td>{humanize(entry.type)}</td>
                      <td className="num">{formatNumber(entry.count)}</td>
                      <td className="num strong">{formatCurrency(entry.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Card>

          <Card padded={false}>
            <CardHeader title="By payment method" />
            <TableWrap>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Method</th>
                    <th className="num">Count</th>
                    <th className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.data.byMethod.map((entry) => (
                    <tr key={entry.method}>
                      <td>{humanize(entry.method)}</td>
                      <td className="num">{formatNumber(entry.count)}</td>
                      <td className="num strong">{formatCurrency(entry.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Card>
        </div>
      )}
    </div>
  );
}
