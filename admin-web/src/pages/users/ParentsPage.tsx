import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as usersApi from '../../api/users';
import { ApiError } from '../../api/client';
import { Avatar, Card } from '../../components/ui/Primitives';
import { Button, IconButton } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import { FilterSelect, TextInput } from '../../components/ui/Form';
import { Modal, ConfirmDialog } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { PageHeader, SearchInput, Toolbar } from '../../components/common/ListToolbar';
import { EmptyState, ErrorState, TableSkeleton } from '../../components/common/States';
import { Pagination, TableHead, TableMessageRow, TableWrap } from '../../components/ui/Table';
import { IconEdit, IconEye, IconTrash } from '../../components/ui/Icons';
import { useDebounced, useListParams } from '../../hooks';
import { formatDate, formatNumber, fullName, userPhone } from '../../utils/format';
import type { AdminParent } from '../../types';

const COLUMNS = [
  { key: 'parent', label: 'Parent' },
  { key: 'contact', label: 'Contact' },
  { key: 'requirements', label: 'Requirements', align: 'right' as const },
  { key: 'joined', label: 'Joined' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: '', align: 'right' as const },
];

export function ParentsPage() {
  const { get, set, page, setPage } = useListParams();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [searchText, setSearchText] = useState(get('search'));
  const search = useDebounced(searchText);
  const isActive = get('isActive');

  const [editing, setEditing] = useState<AdminParent | null>(null);
  const [deleting, setDeleting] = useState<AdminParent | null>(null);

  const query = useQuery({
    queryKey: ['admin', 'parents', { search, isActive, page }],
    queryFn: () => usersApi.getParents({ search, isActive, page, limit: 20 }),
    placeholderData: keepPreviousData,
  });

  const remove = useMutation({
    mutationFn: (id: string) => usersApi.deleteParent(id),
    onSuccess: (result) => {
      toast.success(result.message || 'Parent deleted');
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'parents'] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Delete failed'),
  });

  const parents = query.data?.data ?? [];

  return (
    <div className="page">
      <PageHeader
        title="Parents"
        subtitle="Parent accounts and the requirements they have posted."
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
            ariaLabel="Search parents"
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
          {query.isFetching && !query.isLoading && (
            <span className="dim text-xs row gap-2">
              <span className="spinner" style={{ width: 12, height: 12 }} /> Updating…
            </span>
          )}
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

            {query.isSuccess && parents.length === 0 && (
              <TableMessageRow colSpan={COLUMNS.length}>
                <EmptyState
                  title="No parents found"
                  message={
                    search || isActive
                      ? 'Try changing your filters or clearing the search.'
                      : 'Parent accounts will appear here once people register.'
                  }
                  action={
                    (search || isActive) && (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setSearchText('');
                          set({ search: '', isActive: '' });
                        }}
                      >
                        Clear filters
                      </Button>
                    )
                  }
                />
              </TableMessageRow>
            )}

            {query.isSuccess && parents.length > 0 && (
              <tbody>
                {parents.map((parent) => (
                  <tr key={parent._id}>
                    <td>
                      <div className="row gap-3">
                        <Avatar name={fullName(parent.profile)} src={parent.profile?.profileImage} />
                        <div style={{ minWidth: 0 }}>
                          <Link to={`/users/parents/${parent._id}`} className="cell-primary">
                            {fullName(parent.profile)}
                          </Link>
                          <div className="cell-sub truncate">{parent.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="muted mono">{userPhone(parent)}</td>
                    <td className="num">{formatNumber(parent.requirementsCount)}</td>
                    <td className="muted nowrap">{formatDate(parent.createdAt)}</td>
                    <td>
                      <StatusBadge status={parent.isActive ? 'active' : 'inactive'} />
                    </td>
                    <td className="actions">
                      <div className="row gap-1" style={{ justifyContent: 'flex-end' }}>
                        <Link
                          to={`/users/parents/${parent._id}`}
                          className="btn btn-ghost btn-icon"
                          aria-label="View parent"
                          title="View"
                        >
                          <IconEye size={15} />
                        </Link>
                        <IconButton label="Edit parent" onClick={() => setEditing(parent)}>
                          <IconEdit size={15} />
                        </IconButton>
                        <IconButton label="Delete parent" onClick={() => setDeleting(parent)}>
                          <IconTrash size={15} />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </TableWrap>

        {query.isSuccess && parents.length > 0 && (
          <div className="card-foot">
            <Pagination pagination={query.data.pagination} onChange={setPage} itemLabel="parents" />
          </div>
        )}
      </Card>

      {editing && (
        <EditParentModal
          parent={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            queryClient.invalidateQueries({ queryKey: ['admin', 'parents'] });
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this parent?"
        destructive
        confirmLabel="Delete parent"
        busy={remove.isPending}
        message={
          <>
            <strong>{deleting ? fullName(deleting.profile) : ''}</strong> ({deleting?.email}) will be
            removed. This also affects the requirements posted by this account and cannot be undone.
          </>
        }
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting._id)}
      />
    </div>
  );
}

/**
 * `PUT /api/admin/parents/:id` only honours first name, last name and the active
 * flag, so the form offers exactly those — nothing that the server would drop.
 */
function EditParentModal({
  parent,
  onClose,
  onSaved,
}: {
  parent: AdminParent;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [firstName, setFirstName] = useState(parent.profile?.firstName ?? '');
  const [lastName, setLastName] = useState(parent.profile?.lastName ?? '');
  const [isActive, setIsActive] = useState(parent.isActive);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: () =>
      usersApi.updateParent(parent._id, {
        profile: { firstName: firstName.trim(), lastName: lastName.trim() },
        isActive,
      }),
    onSuccess: (result) => {
      toast.success(result.message || 'Parent updated');
      onSaved();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.fieldErrors.length > 0) {
        setErrors(
          Object.fromEntries(error.fieldErrors.map((fieldError) => [fieldError.field, fieldError.message]))
        );
      }
      toast.error(error instanceof Error ? error.message : 'Update failed');
    },
  });

  function submit() {
    const nextErrors: Record<string, string> = {};
    if (!firstName.trim()) nextErrors.firstName = 'First name is required';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    save.mutate();
  }

  return (
    <Modal
      open
      title="Edit parent"
      description={parent.email}
      busy={save.isPending}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button variant="primary" loading={save.isPending} onClick={submit}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <TextInput
          label="First name"
          required
          value={firstName}
          error={errors.firstName}
          onChange={(event) => setFirstName(event.target.value)}
        />
        <TextInput
          label="Last name"
          value={lastName}
          error={errors.lastName}
          onChange={(event) => setLastName(event.target.value)}
        />
        <div className="span-2">
          <label className="check">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
            />
            <span>
              Account is active
              <span className="field-hint" style={{ display: 'block' }}>
                Deactivating blocks sign-in for this parent across every client.
              </span>
            </span>
          </label>
        </div>
      </div>

      <p className="field-hint mt-4">
        Email and phone number are identity fields and are not editable from the admin console.
      </p>
    </Modal>
  );
}
