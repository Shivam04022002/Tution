import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as usersApi from '../../api/users';
import { ApiError } from '../../api/client';
import { Avatar, Card } from '../../components/ui/Primitives';
import { Button, IconButton } from '../../components/ui/Button';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { Checkbox, FilterSelect, Select, TextInput } from '../../components/ui/Form';
import { ConfirmDialog, Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { PageHeader, SearchInput, Toolbar } from '../../components/common/ListToolbar';
import { EmptyState, ErrorState, TableSkeleton } from '../../components/common/States';
import { Pagination, TableHead, TableMessageRow, TableWrap } from '../../components/ui/Table';
import { IconEdit, IconPlus, IconShield, IconTrash } from '../../components/ui/Icons';
import { PERMISSIONS } from '../../auth/permissions';
import { useAuth } from '../../auth/AuthContext';
import { useDebounced, useListParams } from '../../hooks';
import { formatRelative } from '../../utils/format';
import type { StaffMember } from '../../types';

const COLUMNS = [
  { key: 'member', label: 'Member' },
  { key: 'employeeId', label: 'Employee ID' },
  { key: 'role', label: 'Staff role' },
  { key: 'department', label: 'Department' },
  { key: 'permissions', label: 'Permissions', align: 'right' as const },
  { key: 'lastLogin', label: 'Last login' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: '', align: 'right' as const },
];

/** The permission strings the console understands, offered as checkboxes. */
const ASSIGNABLE_PERMISSIONS = Object.values(PERMISSIONS);

export function AdminsPage() {
  const { get, set, page, setPage } = useListParams();
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [searchText, setSearchText] = useState(get('search'));
  const search = useDebounced(searchText);
  const staffRole = get('staffRole');
  const isActive = get('isActive');

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [deleting, setDeleting] = useState<StaffMember | null>(null);
  const [resetting, setResetting] = useState<StaffMember | null>(null);

  const query = useQuery({
    queryKey: ['admin', 'staff', { search, staffRole, isActive, page }],
    queryFn: () => usersApi.getStaff({ search, staffRole, isActive, page, limit: 20 }),
    placeholderData: keepPreviousData,
  });

  const remove = useMutation({
    mutationFn: (id: string) => usersApi.deleteStaff(id),
    onSuccess: (result) => {
      toast.success(result.message || 'Staff member removed');
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'staff'] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Delete failed'),
  });

  const members = query.data?.data ?? [];
  const hasFilters = Boolean(search || staffRole || isActive);

  return (
    <div className="page">
      <PageHeader
        title="Admins & staff"
        subtitle="Staff accounts, their staff role and the permissions attached to them."
        actions={
          <Button variant="primary" icon={<IconPlus size={15} />} onClick={() => setCreating(true)}>
            New staff member
          </Button>
        }
      />

      <div
        className="card mb-4"
        style={{ padding: 'var(--s-3) var(--s-4)', display: 'flex', gap: 12, alignItems: 'flex-start' }}
      >
        <span style={{ color: 'var(--c-primary)', flex: 'none', marginTop: 1 }}>
          <IconShield size={16} />
        </span>
        <p className="text-sm muted" style={{ lineHeight: 1.55 }}>
          You are signed in as <strong>{user?.email}</strong> with the <strong>admin</strong> role.
          This screen manages <strong>staff</strong> accounts — the backend creates every account here
          with <span className="mono">role: staff</span>. Creating another full administrator is not
          exposed by the API and is done through the platform's seeding scripts.
        </p>
      </div>

      <Card padded={false}>
        <Toolbar>
          <SearchInput
            value={searchText}
            onChange={(value) => {
              setSearchText(value);
              set({ search: value });
            }}
            placeholder="Search name, email, employee ID…"
            ariaLabel="Search staff"
          />
          <FilterSelect
            value={staffRole}
            onChange={(value) => set({ staffRole: value })}
            options={usersApi.STAFF_ROLES.map((role) => ({ value: role, label: role }))}
            placeholder="All staff roles"
            ariaLabel="Filter by staff role"
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

            {query.isSuccess && members.length === 0 && (
              <TableMessageRow colSpan={COLUMNS.length}>
                <EmptyState
                  title="No staff members found"
                  message={
                    hasFilters
                      ? 'Try changing your filters or clearing the search.'
                      : 'Add a staff member to delegate verification, support or finance work.'
                  }
                  action={
                    hasFilters ? (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setSearchText('');
                          set({ search: '', staffRole: '', isActive: '' });
                        }}
                      >
                        Clear filters
                      </Button>
                    ) : (
                      <Button variant="primary" onClick={() => setCreating(true)}>
                        New staff member
                      </Button>
                    )
                  }
                />
              </TableMessageRow>
            )}

            {query.isSuccess && members.length > 0 && (
              <tbody>
                {members.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <div className="row gap-3">
                        <Avatar name={member.name} />
                        <div style={{ minWidth: 0 }}>
                          <div className="cell-primary">{member.name || '—'}</div>
                          <div className="cell-sub truncate">{member.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="mono muted">{member.employeeId ?? '—'}</td>
                    <td>
                      {member.staffRole ? (
                        <Badge tone="info">{member.staffRole}</Badge>
                      ) : (
                        <span className="dim">—</span>
                      )}
                    </td>
                    <td className="muted">{member.department ?? '—'}</td>
                    <td className="num">{member.permissionsCount}</td>
                    <td className="muted nowrap">
                      {member.lastLogin ? formatRelative(member.lastLogin) : 'Never'}
                    </td>
                    <td>
                      <StatusBadge status={member.isActive ? 'active' : 'inactive'} />
                    </td>
                    <td className="actions">
                      <div className="row gap-1" style={{ justifyContent: 'flex-end' }}>
                        <Button size="sm" variant="ghost" onClick={() => setResetting(member)}>
                          Reset password
                        </Button>
                        <IconButton label="Edit staff member" onClick={() => setEditing(member)}>
                          <IconEdit size={15} />
                        </IconButton>
                        <IconButton label="Delete staff member" onClick={() => setDeleting(member)}>
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

        {query.isSuccess && members.length > 0 && (
          <div className="card-foot">
            <Pagination
              pagination={query.data.pagination}
              onChange={setPage}
              itemLabel="staff members"
            />
          </div>
        )}
      </Card>

      {(creating || editing) && (
        <StaffFormModal
          member={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            queryClient.invalidateQueries({ queryKey: ['admin', 'staff'] });
          }}
        />
      )}

      {resetting && (
        <ResetPasswordModal member={resetting} onClose={() => setResetting(null)} />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Remove this staff member?"
        destructive
        confirmLabel="Remove staff member"
        busy={remove.isPending}
        message={
          <>
            <strong>{deleting?.name}</strong> ({deleting?.email}) will lose access to the platform
            immediately. Their past actions stay in the audit log.
          </>
        }
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  );
}

function StaffFormModal({
  member,
  onClose,
  onSaved,
}: {
  member: StaffMember | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const isEdit = Boolean(member);

  const [form, setForm] = useState({
    name: member?.name ?? '',
    email: member?.email ?? '',
    phoneNumber: member?.phoneNumber ?? '',
    password: '',
    username: member?.username ?? '',
    department: member?.department ?? '',
    staffRole: member?.staffRole ?? '',
    designation: member?.designation ?? '',
    isActive: member?.isActive ?? true,
  });
  const [permissions, setPermissions] = useState<string[]>(member?.permissions ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = (key: keyof typeof form, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = useMutation({
    mutationFn: () => {
      const payload: usersApi.StaffInput = {
        name: form.name.trim(),
        email: form.email.trim(),
        phoneNumber: form.phoneNumber.trim(),
        username: form.username.trim() || undefined,
        department: form.department.trim() || undefined,
        staffRole: form.staffRole || undefined,
        designation: form.designation.trim() || undefined,
        permissions,
        isActive: form.isActive,
      };

      if (isEdit && member) return usersApi.updateStaff(member.id, payload);
      return usersApi.createStaff({ ...payload, password: form.password });
    },
    onSuccess: (result) => {
      toast.success(result.message || (isEdit ? 'Staff member updated' : 'Staff member created'));
      onSaved();
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        // Field errors come back from express-validator; keep the form filled in.
        setErrors(
          Object.fromEntries(error.fieldErrors.map((fieldError) => [fieldError.field, fieldError.message]))
        );
        toast.error(error.message);
      } else {
        toast.error('Could not save the staff member.');
      }
    },
  });

  function submit() {
    const nextErrors: Record<string, string> = {};
    if (form.name.trim().length < 2) nextErrors.name = 'Name must be at least 2 characters';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      nextErrors.email = 'Enter a valid email address';
    if (!/^\+?[\d\s\-()]+$/.test(form.phoneNumber.trim()))
      nextErrors.phoneNumber = 'Enter a valid phone number';
    if (!isEdit && form.password.length < 8)
      nextErrors.password = 'Password must be at least 8 characters';
    if (form.username && (form.username.length < 3 || form.username.length > 30))
      nextErrors.username = 'Username must be 3–30 characters';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    save.mutate();
  }

  return (
    <Modal
      open
      size="lg"
      title={isEdit ? 'Edit staff member' : 'New staff member'}
      description={
        isEdit
          ? member?.employeeId ?? undefined
          : 'The employee ID is generated by the backend on creation.'
      }
      busy={save.isPending}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button variant="primary" loading={save.isPending} onClick={submit}>
            {isEdit ? 'Save changes' : 'Create staff member'}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <TextInput
          label="Full name"
          required
          value={form.name}
          error={errors.name}
          onChange={(event) => update('name', event.target.value)}
        />
        <TextInput
          label="Email"
          type="email"
          required
          value={form.email}
          error={errors.email}
          onChange={(event) => update('email', event.target.value)}
        />
        <TextInput
          label="Phone number"
          required
          value={form.phoneNumber}
          error={errors.phoneNumber}
          onChange={(event) => update('phoneNumber', event.target.value)}
        />
        <TextInput
          label="Username"
          value={form.username}
          error={errors.username}
          hint="Optional. Must be unique across the platform."
          onChange={(event) => update('username', event.target.value)}
        />

        {!isEdit && (
          <TextInput
            label="Password"
            type="password"
            required
            autoComplete="new-password"
            value={form.password}
            error={errors.password}
            hint="Minimum 8 characters, as enforced by the backend."
            onChange={(event) => update('password', event.target.value)}
          />
        )}

        <Select
          label="Staff role"
          value={form.staffRole}
          placeholder="No staff role"
          error={errors.staffRole}
          options={usersApi.STAFF_ROLES.map((role) => ({ value: role, label: role }))}
          onChange={(event) => update('staffRole', event.target.value)}
        />
        <TextInput
          label="Department"
          value={form.department}
          error={errors.department}
          onChange={(event) => update('department', event.target.value)}
        />
        <TextInput
          label="Designation"
          value={form.designation}
          error={errors.designation}
          onChange={(event) => update('designation', event.target.value)}
        />

        <div className="span-2">
          <p className="label">Console permissions</p>
          <p className="field-hint" style={{ marginTop: 4, marginBottom: 10 }}>
            These narrow which sections a person sees. Backend authorization is unchanged and remains
            the real gate — leaving every box unchecked grants the full menu.
          </p>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8 }}>
            {ASSIGNABLE_PERMISSIONS.map((permission) => (
              <Checkbox
                key={permission}
                checked={permissions.includes(permission)}
                label={<span className="mono">{permission}</span>}
                onChange={(event) =>
                  setPermissions((current) =>
                    event.target.checked
                      ? [...current, permission]
                      : current.filter((value) => value !== permission)
                  )
                }
              />
            ))}
          </div>
        </div>

        <div className="span-2">
          <Checkbox
            checked={form.isActive}
            label="Account is active"
            onChange={(event) => update('isActive', event.target.checked)}
          />
        </div>
      </div>
    </Modal>
  );
}

function ResetPasswordModal({ member, onClose }: { member: StaffMember; onClose: () => void }) {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [generated, setGenerated] = useState<string | null>(null);

  const reset = useMutation({
    mutationFn: () => usersApi.resetStaffPassword(member.id, password || undefined),
    onSuccess: (result) => {
      // The endpoint echoes the new password back so it can be handed over.
      const issued = result.data?.password;
      if (issued) setGenerated(issued);
      else {
        toast.success(result.message || 'Password reset');
        onClose();
      }
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Reset failed'),
  });

  function submit() {
    if (password && password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setError('');
    reset.mutate();
  }

  return (
    <Modal
      open
      size="sm"
      title="Reset password"
      description={member.email}
      busy={reset.isPending}
      onClose={onClose}
      footer={
        generated ? (
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={reset.isPending}>
              Cancel
            </Button>
            <Button variant="primary" loading={reset.isPending} onClick={submit}>
              Reset password
            </Button>
          </>
        )
      }
    >
      {generated ? (
        <>
          <p className="text-sm">
            The password has been set. Share it with {member.name} over a secure channel — it is
            shown once here and is not stored anywhere in this console.
          </p>
          <p
            className="mono mt-4"
            style={{
              padding: 'var(--s-3)',
              background: 'var(--c-bg-2)',
              borderRadius: 'var(--r-md)',
              fontSize: 14,
              userSelect: 'all',
            }}
          >
            {generated}
          </p>
        </>
      ) : (
        <>
          <p className="text-sm muted" style={{ lineHeight: 1.55 }}>
            Set a new password for this staff member, or leave the field blank to have the backend
            generate one.
          </p>
          <div className="mt-4">
            <TextInput
              label="New password"
              type="password"
              autoComplete="new-password"
              value={password}
              error={error}
              hint="Leave blank to auto-generate. Minimum 8 characters."
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
        </>
      )}
    </Modal>
  );
}
