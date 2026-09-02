import { useQueries } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import * as financeApi from '../../api/finance';
import { Card, CardHeader, Kpi } from '../../components/ui/Primitives';
import { PageHeader } from '../../components/common/ListToolbar';
import { RangeFilter, useRangeFilters } from '../../components/common/RangeFilter';
import { EmptyState, ErrorState, InlineLoader } from '../../components/common/States';
import { useListParams } from '../../hooks';
import { CHART_COLORS } from '../../utils/constants';
import {
  formatCurrency,
  formatCurrencyCompact,
  formatNumber,
  formatPercent,
  humanize,
} from '../../utils/format';

const AXIS = { fontSize: 11, fill: '#64748B' };

export function RevenuePage() {
  const { get, set } = useListParams();
  const { filters, range, from, to } = useRangeFilters(get);

  const [overview, charts, subscriptions, credits] = useQueries({
    queries: [
      {
        queryKey: ['admin', 'revenue', 'overview', filters],
        queryFn: () => financeApi.getRevenueOverview(filters),
      },
      {
        queryKey: ['admin', 'revenue', 'charts', filters],
        queryFn: () => financeApi.getRevenueCharts(filters),
      },
      {
        queryKey: ['admin', 'revenue', 'subscriptions', filters],
        queryFn: () => financeApi.getSubscriptionMetrics(filters),
      },
      {
        queryKey: ['admin', 'revenue', 'credits', filters],
        queryFn: () => financeApi.getCreditMetrics(filters),
      },
    ],
  });

  const data = overview.data;

  return (
    <div className="page">
      <PageHeader
        title="Revenue"
        subtitle="Transaction volume, subscriptions and credit sales for the selected period."
        actions={
          <RangeFilter
            range={range}
            from={from}
            to={to}
            onChange={(next) => set({ ...next }, false)}
          />
        }
      />

      {overview.isError && (
        <Card>
          <ErrorState error={overview.error} onRetry={() => overview.refetch()} />
        </Card>
      )}

      <div className="grid grid-kpi">
        <Kpi
          label="Revenue"
          value={formatCurrencyCompact(data?.revenue.total)}
          foot={
            data ? (
              <>
                <span className={data.revenue.growth >= 0 ? 'delta-up' : 'delta-down'}>
                  {data.revenue.growth >= 0 ? '▲' : '▼'} {Math.abs(data.revenue.growth).toFixed(1)}%
                </span>{' '}
                vs {formatCurrencyCompact(data.revenue.previous)}
              </>
            ) : undefined
          }
          accent="#2D0A7D"
          loading={overview.isLoading}
        />
        <Kpi
          label="Transactions"
          value={formatNumber(data?.transactions.total)}
          foot={
            data ? (
              <span className={data.transactions.growth >= 0 ? 'delta-up' : 'delta-down'}>
                {data.transactions.growth >= 0 ? '▲' : '▼'}{' '}
                {Math.abs(data.transactions.growth).toFixed(1)}%
              </span>
            ) : undefined
          }
          accent="#5B21B6"
          loading={overview.isLoading}
        />
        <Kpi
          label="Successful"
          value={formatNumber(data?.transactions.successful)}
          foot={data ? formatCurrency(data.amounts.successAmount) : undefined}
          accent="#10B981"
          loading={overview.isLoading}
        />
        <Kpi
          label="Failed"
          value={formatNumber(data?.transactions.failed)}
          foot={data ? formatCurrency(data.amounts.failedAmount) : undefined}
          accent="#EF4444"
          loading={overview.isLoading}
        />
        <Kpi
          label="Refunded"
          value={formatNumber(data?.transactions.refunded)}
          foot={data ? formatCurrency(data.amounts.refundedAmount) : undefined}
          accent="#3B82F6"
          loading={overview.isLoading}
        />
        <Kpi
          label="Today"
          value={formatCurrencyCompact(data?.revenue.today)}
          foot="Revenue booked today"
          accent="#EC4899"
          loading={overview.isLoading}
        />
      </div>

      {/* ── Revenue trend ─────────────────────────────────────────────────── */}
      <Card padded={false} className="mt-6">
        <CardHeader title="Revenue trend" subtitle="Daily revenue and transaction count" />
        <div className="card-body">
          {charts.isLoading && <InlineLoader />}
          {charts.isError && <ErrorState error={charts.error} onRetry={() => charts.refetch()} />}
          {charts.isSuccess &&
            (charts.data.daily.length === 0 ? (
              <EmptyState
                title="No transactions in this period"
                message="Choose a wider date range to see the trend."
              />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={charts.data.daily} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#5B21B6" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#5B21B6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis
                    tick={AXIS}
                    tickLine={false}
                    axisLine={false}
                    width={64}
                    tickFormatter={(value) => formatCurrencyCompact(Number(value))}
                  />
                  <Tooltip
                    formatter={(value: any, name: any) =>
                      name === 'revenue'
                        ? [formatCurrency(Number(value)), 'Revenue']
                        : [formatNumber(Number(value)), 'Transactions']
                    }
                    contentStyle={tooltipStyle}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#5B21B6"
                    strokeWidth={2}
                    fill="url(#revGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ))}
        </div>
      </Card>

      <div className="grid grid-2 mt-6">
        {/* ── Revenue by type ─────────────────────────────────────────────── */}
        <Card padded={false}>
          <CardHeader title="Revenue by type" subtitle="Where the money comes from" />
          <div className="card-body">
            {charts.isLoading && <InlineLoader />}
            {charts.isSuccess &&
              (charts.data.byType.length === 0 ? (
                <EmptyState title="No revenue recorded in this period" />
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart
                    data={charts.data.byType.map((entry) => ({
                      ...entry,
                      label: humanize(entry.type),
                    }))}
                    margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
                    <YAxis
                      tick={AXIS}
                      tickLine={false}
                      axisLine={false}
                      width={64}
                      tickFormatter={(value) => formatCurrencyCompact(Number(value))}
                    />
                    <Tooltip
                      formatter={(value: any) => [formatCurrency(Number(value)), 'Revenue']}
                      contentStyle={tooltipStyle}
                      cursor={{ fill: 'rgba(45,10,125,.05)' }}
                    />
                    <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                      {charts.data.byType.map((_, index) => (
                        <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ))}
          </div>
        </Card>

        {/* ── Subscription mix ────────────────────────────────────────────── */}
        <Card padded={false}>
          <CardHeader title="Active subscription plans" subtitle="Tutors by plan" />
          <div className="card-body">
            {charts.isLoading && <InlineLoader />}
            {charts.isSuccess &&
              (charts.data.subscriptionDistribution.length === 0 ? (
                <EmptyState title="No active subscriptions" />
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={charts.data.subscriptionDistribution.map((entry) => ({
                        ...entry,
                        label: humanize(entry.plan),
                      }))}
                      dataKey="count"
                      nameKey="label"
                      innerRadius={54}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {charts.data.subscriptionDistribution.map((_, index) => (
                        <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend
                      verticalAlign="bottom"
                      height={28}
                      formatter={(value) => <span style={{ fontSize: 12 }}>{value}</span>}
                    />
                    <Tooltip
                      formatter={(value: any) => formatNumber(Number(value))}
                      contentStyle={tooltipStyle}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-2 mt-6">
        {/* ── Subscription activity ───────────────────────────────────────── */}
        <Card>
          <CardHeader title="Subscription activity" subtitle="Movement during the period" />
          <div className="grid grid-2 mt-4" style={{ gap: 'var(--s-3)' }}>
            <Metric
              label="New"
              value={formatNumber(subscriptions.data?.activity.newSubscriptions)}
              loading={subscriptions.isLoading}
            />
            <Metric
              label="Cancelled"
              value={formatNumber(subscriptions.data?.activity.cancelledSubscriptions)}
              loading={subscriptions.isLoading}
            />
            <Metric
              label="Renewals"
              value={formatNumber(subscriptions.data?.activity.renewals)}
              loading={subscriptions.isLoading}
            />
            <Metric
              label="Upgrades"
              value={formatNumber(subscriptions.data?.activity.upgrades)}
              loading={subscriptions.isLoading}
            />
            <Metric
              label="Upgrade rate"
              value={formatPercent(subscriptions.data?.activity.upgradeRate)}
              loading={subscriptions.isLoading}
            />
            <Metric
              label="Churn rate"
              value={formatPercent(subscriptions.data?.activity.churnRate)}
              loading={subscriptions.isLoading}
            />
          </div>
          {subscriptions.data && (
            <p className="field-hint mt-6">
              Subscription revenue in this period:{' '}
              <strong>{formatCurrency(subscriptions.data.revenue.total)}</strong> across{' '}
              {formatNumber(subscriptions.data.revenue.count)} payments (average{' '}
              {formatCurrency(subscriptions.data.revenue.avg)}).
            </p>
          )}
        </Card>

        {/* ── Credits ─────────────────────────────────────────────────────── */}
        <Card>
          <CardHeader title="Credits" subtitle="Lead-unlock credit economy" />
          <div className="grid grid-2 mt-4" style={{ gap: 'var(--s-3)' }}>
            <Metric
              label="Sold"
              value={formatNumber(credits.data?.summary.creditsSold)}
              loading={credits.isLoading}
            />
            <Metric
              label="Consumed"
              value={formatNumber(credits.data?.summary.creditsConsumed)}
              loading={credits.isLoading}
            />
            <Metric
              label="Refunded"
              value={formatNumber(credits.data?.summary.creditsRefunded)}
              loading={credits.isLoading}
            />
            <Metric
              label="Net"
              value={formatNumber(credits.data?.summary.netCredits)}
              loading={credits.isLoading}
            />
            <Metric
              label="Bonuses granted"
              value={formatNumber(credits.data?.byType.bonuses)}
              loading={credits.isLoading}
            />
            <Metric
              label="Top pack"
              value={credits.data?.summary.topPack || '—'}
              loading={credits.isLoading}
            />
          </div>
          {credits.data && (
            <p className="field-hint mt-6">
              Credit revenue in this period:{' '}
              <strong>{formatCurrency(credits.data.revenue.total)}</strong> across{' '}
              {formatNumber(credits.data.revenue.count)} purchases.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

const tooltipStyle = {
  fontSize: 12,
  borderRadius: 8,
  border: '1px solid #E2E8F0',
  boxShadow: '0 8px 24px rgba(45,10,125,.12)',
};

function Metric({
  label,
  value,
  loading,
}: {
  label: string;
  value: string;
  loading: boolean;
}) {
  return (
    <div
      style={{
        padding: 'var(--s-3)',
        background: 'var(--c-bg-2)',
        borderRadius: 'var(--r-md)',
      }}
    >
      <p className="kpi-label" style={{ fontSize: 11 }}>
        {label}
      </p>
      {loading ? (
        <div className="skel mt-2" style={{ height: 18, width: '50%' }} />
      ) : (
        <p style={{ fontSize: 18, fontWeight: 650, marginTop: 2 }}>{value}</p>
      )}
    </div>
  );
}
