import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import * as usersApi from '../../api/users';
import { Avatar, Card } from '../../components/ui/Primitives';
import { Button } from '../../components/ui/Button';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { FilterSelect } from '../../components/ui/Form';
import { PageHeader, SearchInput, Toolbar } from '../../components/common/ListToolbar';
import { EmptyState, ErrorState, TableSkeleton } from '../../components/common/States';
import { Pagination, TableHead, TableMessageRow, TableWrap } from '../../components/ui/Table';
import { useDebounced, useListParams } from '../../hooks';
import { formatDate, fullName, userPhone, userVerified } from '../../utils/format';
import type { BadgeTone } from '../../components/ui/Badge';

const COLUMNS = [
  { key: 'user', label: 'Account' },
  { key: 'contact', label: 'Phone' },
  { key: 'role', label: 'Role' },
  { key: 'verified', label: 'Verified' },
  { key: 'joined', label: 'Registered' },
  { key: 'status', label: 'Status' },
];

const ROLE_TONES: Record<string, BadgeTone> = {
  admin: 'brand',
  staff: 'info',
  teacher: 'warning',
  parent: 'neutral',
};

/**
 * The unfiltered `/api/admin/users` collection — every account regardless of
 * role. Parents and tutors have dedicated screens with richer data; this is the
 * cross-role view for lookups.
 */
export function AccountsPage() {
  const { get, set, page, setPage } = useListParams();

  const [searchText, setSearchText] = useState(get('search'));
  const search = useDebounced(searchText);
  const role = get('role');
  const isActive = get('isActive');

  const query = useQuery({
    queryKey: ['admin', 'users', { search, role, isActive, page }],
    queryFn: () => usersApi.getUsers({ search, role, isActive, page, limit: 20 }),
    placeholderData: keepPreviousData,
  });

  const users = query.data?.data ?? [];
  const hasFilters = Boolean(search || role || isActive);

  return (
    <div className="page">
      <PageHeader
        title="All accounts"
        subtitle="Every user record across parents, tutors, staff and administrators."
      />

      <Card padded={false}>
        <Toolbar>
          <SearchInput
            value={searchText}
            onChange={(value) => {
              setSearchText(value);
              set({ search: value });
            }}
            placeholder="Search name, email or phone…"
            ariaLabel="Search accounts"
          />
          <FilterSelect
            value={role}
            onChange={(value) => set({ role: value })}
            options={[
              { value: 'parent', label: 'Parent' },
              { value: 'teacher', label: 'Tutor' },
              { value: 'staff', label: 'Staff' },
              { value: 'admin', label: 'Admin' },
            ]}
            placeholder="All roles"
            ariaLabel="Filter by role"
          />
          <FilterSelect
            value={isActive}
            onChange={(value) => set({ isActive: value })}
            options={[
              { value: 'true', label: 'Active' },
              { value: 'false', label: 'Inactive' },
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

            {query.isSuccess && users.length === 0 && (
              <TableMessageRow colSpan={COLUMNS.length}>
                <EmptyState
                  title="No accounts found"
                  message={hasFilters ? 'Try changing your filters or clearing the search.' : undefined}
                  action={
                    hasFilters && (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setSearchText('');
                          set({ search: '', role: '', isActive: '' });
                        }}
                      >
                        Clear filters
                      </Button>
                    )
                  }
                />
              </TableMessageRow>
            )}

            {query.isSuccess && users.length > 0 && (
              <tbody>
                {users.map((user) => (
                  <tr key={user._id}>
                    <td>
                      <div className="row gap-3">
                        <Avatar name={fullName(user.profile)} src={user.profile?.profileImage} />
                        <div style={{ minWidth: 0 }}>
                          <div className="cell-primary">{fullName(user.profile)}</div>
                          <div className="cell-sub truncate">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="muted mono">{userPhone(user)}</td>
                    <td>
                      <Badge tone={ROLE_TONES[user.role] ?? 'neutral'}>
                        {user.role === 'teacher' ? 'Tutor' : user.role}
                      </Badge>
                    </td>
                    <td>
                      {userVerified(user) ? (
                        <Badge tone="success" dot>
                          Verified
                        </Badge>
                      ) : (
                        <span className="dim">—</span>
                      )}
                    </td>
                    <td className="muted nowrap">{formatDate(user.createdAt)}</td>
                    <td>
                      <StatusBadge status={user.isActive ? 'active' : 'inactive'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </TableWrap>

        {query.isSuccess && users.length > 0 && (
          <div className="card-foot">
            <Pagination pagination={query.data.pagination} onChange={setPage} itemLabel="accounts" />
          </div>
        )}
      </Card>
    </div>
  );
}
