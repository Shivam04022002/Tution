import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import * as operationsApi from '../../api/operations';
import { Card, Kpi, Tabs } from '../../components/ui/Primitives';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { FilterSelect } from '../../components/ui/Form';
import { PageHeader, SearchInput, Toolbar } from '../../components/common/ListToolbar';
import { EmptyState, ErrorState, TableSkeleton } from '../../components/common/States';
import { Pagination, TableHead, TableMessageRow, TableWrap } from '../../components/ui/Table';
import { useDebounced, useListParams } from '../../hooks';
import { TICKET_CATEGORY_LABELS } from '../../utils/constants';
import { formatNumber, formatRelative, humanize } from '../../utils/format';
import type { BadgeTone } from '../../components/ui/Badge';
import type { TicketPriority } from '../../types';

const COLUMNS = [
  { key: 'ticket', label: 'Ticket' },
  { key: 'user', label: 'Raised by' },
  { key: 'category', label: 'Category' },
  { key: 'priority', label: 'Priority' },
  { key: 'assigned', label: 'Assigned to' },
  { key: 'updated', label: 'Updated' },
  { key: 'status', label: 'Status' },
];

const PRIORITY_TONES: Record<TicketPriority, BadgeTone> = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  urgent: 'error',
};

export function TicketsPage() {
  const { get, set, page, setPage } = useListParams();

  const status = get('status') || 'open';
  const priority = get('priority');
  const category = get('category');
  const [searchText, setSearchText] = useState(get('search'));
  const search = useDebounced(searchText);

  const stats = useQuery({
    queryKey: ['admin', 'tickets', 'stats'],
    queryFn: operationsApi.getTicketStats,
  });

  const query = useQuery({
    queryKey: ['admin', 'tickets', { status, priority, category, search, page }],
    queryFn: () =>
      operationsApi.listTickets({
        status: status === 'all' ? undefined : status,
        priority,
        category,
        search,
        page,
        limit: 20,
      }),
    placeholderData: keepPreviousData,
  });

  const tickets = query.data?.tickets ?? [];
  const counts = query.data?.counts;

  return (
    <div className="page">
      <PageHeader
        title="Support tickets"
        subtitle="Requests raised by parents and tutors from the app's support centre."
      />

      <div className="grid grid-kpi mb-4">
        <Kpi
          label="Open"
          value={formatNumber(stats.data?.open)}
          accent="#F59E0B"
          loading={stats.isLoading}
        />
        <Kpi
          label="In progress"
          value={formatNumber(stats.data?.in_progress)}
          accent="#3B82F6"
          loading={stats.isLoading}
        />
        <Kpi
          label="Urgent"
          value={formatNumber(stats.data?.urgent)}
          foot="Highest priority"
          accent="#EF4444"
          loading={stats.isLoading}
        />
        <Kpi
          label="Waiting over 24h"
          value={formatNumber(stats.data?.pending24h)}
          foot="Unanswered"
          accent="#EC4899"
          loading={stats.isLoading}
        />
        <Kpi
          label="Recently resolved"
          value={formatNumber(stats.data?.recentResolved)}
          accent="#10B981"
          loading={stats.isLoading}
        />
      </div>

      <Card padded={false}>
        <div style={{ padding: '0 var(--s-4)' }}>
          <Tabs
            value={status}
            onChange={(next) => set({ status: next === 'open' ? '' : next })}
            tabs={[
              { value: 'open', label: 'Open', count: counts?.open },
              { value: 'in_progress', label: 'In progress', count: counts?.in_progress },
              { value: 'resolved', label: 'Resolved', count: counts?.resolved },
              { value: 'closed', label: 'Closed', count: counts?.closed },
              { value: 'all', label: 'All' },
            ]}
          />
        </div>

        <Toolbar>
          <SearchInput
            value={searchText}
            onChange={(value) => {
              setSearchText(value);
              set({ search: value });
            }}
            placeholder="Search subject or ticket ID…"
            ariaLabel="Search tickets"
          />
          <FilterSelect
            value={priority}
            onChange={(value) => set({ priority: value })}
            options={[
              { value: 'urgent', label: 'Urgent' },
              { value: 'high', label: 'High' },
              { value: 'medium', label: 'Medium' },
              { value: 'low', label: 'Low' },
            ]}
            placeholder="All priorities"
            ariaLabel="Filter by priority"
          />
          <FilterSelect
            value={category}
            onChange={(value) => set({ category: value })}
            options={Object.entries(TICKET_CATEGORY_LABELS).map(([value, label]) => ({
              value,
              label,
            }))}
            placeholder="All categories"
            ariaLabel="Filter by category"
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

            {query.isSuccess && tickets.length === 0 && (
              <TableMessageRow colSpan={COLUMNS.length}>
                <EmptyState
                  title={status === 'open' ? 'No open tickets' : 'No tickets match these filters'}
                  message={
                    status === 'open'
                      ? 'The support queue is clear.'
                      : 'Try another status tab or clear the filters.'
                  }
                />
              </TableMessageRow>
            )}

            {query.isSuccess && tickets.length > 0 && (
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket._id}>
                    <td>
                      <Link
                        to={`/support/tickets/${ticket._id}`}
                        className="cell-primary truncate"
                        style={{ display: 'block', maxWidth: 300 }}
                      >
                        {ticket.subject}
                      </Link>
                      <div className="cell-sub mono">{ticket.ticketId}</div>
                    </td>
                    <td>
                      <div className="truncate" style={{ maxWidth: 170 }}>
                        {ticket.userName}
                      </div>
                      <div className="cell-sub">
                        {ticket.userRole === 'teacher' ? 'Tutor' : humanize(ticket.userRole)}
                      </div>
                    </td>
                    <td className="muted nowrap">
                      {TICKET_CATEGORY_LABELS[ticket.category] ?? humanize(ticket.category)}
                    </td>
                    <td>
                      <Badge tone={PRIORITY_TONES[ticket.priority] ?? 'neutral'}>
                        {humanize(ticket.priority)}
                      </Badge>
                    </td>
                    <td className="muted">{ticket.assignedToName ?? <span className="dim">Unassigned</span>}</td>
                    <td className="muted nowrap">{formatRelative(ticket.updatedAt)}</td>
                    <td>
                      <StatusBadge status={ticket.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </TableWrap>

        {query.isSuccess && tickets.length > 0 && (
          <div className="card-foot">
            <Pagination pagination={query.data.pagination} onChange={setPage} itemLabel="tickets" />
          </div>
        )}
      </Card>
    </div>
  );
}
