import { useQueries } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import * as operationsApi from '../api/operations';
import { Card, CardHeader, Kpi, Tabs } from '../components/ui/Primitives';
import { PageHeader } from '../components/common/ListToolbar';
import { EmptyState, ErrorState, InlineLoader } from '../components/common/States';
import { TableWrap } from '../components/ui/Table';
import { useListParams } from '../hooks';
import { CHART_COLORS } from '../utils/constants';
import { formatCurrency, formatNumber, formatPercent } from '../utils/format';

const AXIS = { fontSize: 11, fill: '#64748B' };
const TOOLTIP = {
  fontSize: 12,
  borderRadius: 8,
  border: '1px solid #E2E8F0',
  boxShadow: '0 8px 24px rgba(45,10,125,.12)',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Reports drawn from the `/api/admin/analytics/*` endpoints. Each chart maps to
 * an aggregate the backend already computes — nothing here derives figures the
 * API does not return.
 */
export function ReportsPage() {
  const { get, set } = useListParams();
  const tab = (get('tab') || 'overview') as 'overview' | 'demand' | 'supply';

  const [overview, demand, supply] = useQueries({
    queries: [
      {
        queryKey: ['admin', 'analytics', 'overview'],
        queryFn: operationsApi.getOverviewAnalytics,
      },
      {
        queryKey: ['admin', 'analytics', 'demand'],
        queryFn: operationsApi.getDemandAnalytics,
        enabled: tab === 'demand' || tab === 'overview',
      },
      {
        queryKey: ['admin', 'analytics', 'supply'],
        queryFn: operationsApi.getSupplyAnalytics,
        enabled: tab === 'supply',
      },
    ],
  });

  const stats = overview.data;

  return (
    <div className="page">
      <PageHeader
        title="Reports"
        subtitle="Platform analytics from the existing admin analytics endpoints."
      />

      <div className="grid grid-kpi mb-4">
        <Kpi
          label="Parents"
          value={formatNumber(stats?.totalParents)}
          accent="#2D0A7D"
          loading={overview.isLoading}
        />
        <Kpi
          label="Tutors"
          value={formatNumber(stats?.totalTeachers)}
          foot={
            stats?.verifiedTeachers !== undefined
              ? `${formatNumber(stats.verifiedTeachers)} verified`
              : undefined
          }
          accent="#5B21B6"
          loading={overview.isLoading}
        />
        <Kpi
          label="Requirements"
          value={formatNumber(stats?.totalRequirements)}
          foot={
            stats?.activeRequirements !== undefined
              ? `${formatNumber(stats.activeRequirements)} active`
              : undefined
          }
          accent="#EC4899"
          loading={overview.isLoading}
        />
        <Kpi
          label="Applications"
          value={formatNumber(stats?.totalApplications)}
          accent="#F59E0B"
          loading={overview.isLoading}
        />
        <Kpi
          label="Demo classes"
          value={formatNumber(stats?.totalDemoClasses)}
          foot={
            stats?.completedDemos !== undefined
              ? `${formatNumber(stats.completedDemos)} completed`
              : undefined
          }
          accent="#10B981"
          loading={overview.isLoading}
        />
        <Kpi
          label="Conversion"
          value={
            stats?.conversionRate !== undefined ? formatPercent(stats.conversionRate) : '—'
          }
          foot="Requirement to demo"
          accent="#3B82F6"
          loading={overview.isLoading}
        />
      </div>

      {overview.isError && (
        <Card>
          <ErrorState error={overview.error} onRetry={() => overview.refetch()} />
        </Card>
      )}

      <Card padded={false}>
        <div style={{ padding: '0 var(--s-4)' }}>
          <Tabs
            value={tab}
            onChange={(next) => set({ tab: next === 'overview' ? '' : next })}
            tabs={[
              { value: 'overview', label: 'Growth' },
              { value: 'demand', label: 'Demand' },
              { value: 'supply', label: 'Supply' },
            ]}
          />
        </div>

        <div className="card-body">
          {tab === 'overview' && (
            <MonthlyTrendChart
              title="Requirements posted per month"
              data={demand.data?.monthlyTrend}
              loading={demand.isLoading}
              error={demand.error}
              onRetry={() => demand.refetch()}
            />
          )}

          {tab === 'demand' && (
            <div className="grid grid-2">
              <RankedChart
                title="Most requested subjects"
                data={demand.data?.topSubjects}
                nameKey="subject"
                loading={demand.isLoading}
                error={demand.error}
                onRetry={() => demand.refetch()}
              />
              <RankedChart
                title="Demand by city"
                data={demand.data?.topCities}
                nameKey="city"
                loading={demand.isLoading}
                error={demand.error}
                onRetry={() => demand.refetch()}
              />
              <RankedChart
                title="Demand by grade"
                data={demand.data?.topGrades}
                nameKey="grade"
                loading={demand.isLoading}
                error={demand.error}
                onRetry={() => demand.refetch()}
              />
              <RankedChart
                title="Demand by board"
                data={demand.data?.topBoards}
                nameKey="board"
                loading={demand.isLoading}
                error={demand.error}
                onRetry={() => demand.refetch()}
              />
            </div>
          )}

          {tab === 'supply' && (
            <div className="grid grid-2">
              <RankedChart
                title="Tutors by city"
                data={supply.data?.byCity}
                nameKey="city"
                loading={supply.isLoading}
                error={supply.error}
                onRetry={() => supply.refetch()}
              />
              <RankedChart
                title="Tutors by subject"
                data={supply.data?.bySubject}
                nameKey="subject"
                loading={supply.isLoading}
                error={supply.error}
                onRetry={() => supply.refetch()}
              />

              <div style={{ gridColumn: '1 / -1', minWidth: 0 }}>
                <SupplyDemandTable
                  rows={supply.data?.supplyVsDemand}
                  loading={supply.isLoading}
                />
              </div>

              <div style={{ gridColumn: '1 / -1', minWidth: 0 }}>
                <CityRatesTable rows={supply.data?.cityRates} loading={supply.isLoading} />
              </div>
            </div>
          )}
        </div>
      </Card>

      <p className="dim text-xs mt-6" style={{ lineHeight: 1.6, maxWidth: 760 }}>
        Course-marketplace analytics (enrollment trends over time, per-course completion, tutor
        earnings) are not shown here because the backend exposes no endpoint for them. Those charts
        would need new aggregate APIs rather than client-side computation over paginated lists.
      </p>
    </div>
  );
}

function MonthlyTrendChart({
  title,
  data,
  loading,
  error,
  onRetry,
}: {
  title: string;
  data?: Array<{ year: number; month: number; count: number }>;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  if (loading) return <InlineLoader />;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (!data || data.length === 0)
    return <EmptyState title="No trend data available" message={`The API returned no data for “${title}”.`} />;

  const points = data.map((entry) => ({
    label: `${MONTHS[(entry.month ?? 1) - 1] ?? entry.month} ${String(entry.year).slice(2)}`,
    count: entry.count,
  }));

  return (
    <>
      <h3 className="section-title mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#E2E8F0" vertical={false} />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} minTickGap={16} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={48} allowDecimals={false} />
          <Tooltip
            formatter={(value: any) => [formatNumber(Number(value)), 'Requirements']}
            contentStyle={TOOLTIP}
          />
          <Line
            type="monotone"
            dataKey="count"
            stroke="#5B21B6"
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#5B21B6' }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </>
  );
}

function RankedChart({
  title,
  data,
  nameKey,
  loading,
  error,
  onRetry,
}: {
  title: string;
  data?: Array<Record<string, any>>;
  nameKey: string;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <Card padded={false}>
      <CardHeader title={title} />
      <div className="card-body">
        {loading && <InlineLoader />}
        {!loading && Boolean(error) && <ErrorState error={error} onRetry={onRetry} />}
        {!loading && !error && (!data || data.length === 0) && (
          <EmptyState title="No data" message="The API returned no rows for this breakdown." />
        )}
        {!loading && !error && data && data.length > 0 && (
          <ResponsiveContainer width="100%" height={Math.max(200, data.slice(0, 8).length * 34)}>
            <BarChart
              layout="vertical"
              data={data.slice(0, 8).map((entry) => ({
                label: String(entry[nameKey] ?? 'Unknown'),
                count: entry.count ?? 0,
              }))}
              margin={{ top: 4, right: 16, bottom: 4, left: 4 }}
            >
              <CartesianGrid stroke="#E2E8F0" horizontal={false} />
              <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="label"
                tick={AXIS}
                tickLine={false}
                axisLine={false}
                width={120}
              />
              <Tooltip
                formatter={(value: any) => [formatNumber(Number(value)), 'Count']}
                contentStyle={TOOLTIP}
                cursor={{ fill: 'rgba(45,10,125,.05)' }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
                {data.slice(0, 8).map((_, index) => (
                  <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

function SupplyDemandTable({
  rows,
  loading,
}: {
  rows?: Array<{ subject: string; demand: number; supply: number; gap: number }>;
  loading: boolean;
}) {
  return (
    <Card padded={false}>
      <CardHeader
        title="Supply vs demand by subject"
        subtitle="A positive gap means more demand than available tutors"
      />
      {loading && <InlineLoader />}
      {!loading && (!rows || rows.length === 0) && (
        <EmptyState title="No supply/demand data available" />
      )}
      {!loading && rows && rows.length > 0 && (
        <TableWrap>
          <table className="tbl">
            <thead>
              <tr>
                <th>Subject</th>
                <th className="num">Demand</th>
                <th className="num">Supply</th>
                <th className="num">Gap</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.subject}>
                  <td className="cell-primary">{row.subject}</td>
                  <td className="num">{formatNumber(row.demand)}</td>
                  <td className="num">{formatNumber(row.supply)}</td>
                  <td
                    className="num strong"
                    style={{ color: row.gap > 0 ? 'var(--c-error)' : 'var(--c-success)' }}
                  >
                    {row.gap > 0 ? '+' : ''}
                    {formatNumber(row.gap)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </Card>
  );
}

function CityRatesTable({
  rows,
  loading,
}: {
  rows?: Array<{ city: string; avgHourlyRate: number; teacherCount: number }>;
  loading: boolean;
}) {
  return (
    <Card padded={false}>
      <CardHeader title="Average hourly rate by city" />
      {loading && <InlineLoader />}
      {!loading && (!rows || rows.length === 0) && <EmptyState title="No rate data available" />}
      {!loading && rows && rows.length > 0 && (
        <TableWrap>
          <table className="tbl">
            <thead>
              <tr>
                <th>City</th>
                <th className="num">Tutors</th>
                <th className="num">Average hourly rate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.city}>
                  <td className="cell-primary">{row.city}</td>
                  <td className="num">{formatNumber(row.teacherCount)}</td>
                  <td className="num strong">{formatCurrency(row.avgHourlyRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </Card>
  );
}
