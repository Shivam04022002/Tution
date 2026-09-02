import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as financeApi from '../../api/finance';
import { ApiError } from '../../api/client';
import { Card } from '../../components/ui/Primitives';
import { Button, IconButton } from '../../components/ui/Button';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { FilterSelect, Select, TextArea, TextInput } from '../../components/ui/Form';
import { ConfirmDialog, Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { PageHeader, Toolbar } from '../../components/common/ListToolbar';
import { EmptyState, ErrorState, TableSkeleton } from '../../components/common/States';
import { Pagination, TableHead, TableMessageRow, TableWrap } from '../../components/ui/Table';
import { IconEdit, IconPlus, IconTrash } from '../../components/ui/Icons';
import { useListParams } from '../../hooks';
import { formatCurrency, formatDate, formatNumber, humanize } from '../../utils/format';
import type { PromoCode } from '../../types';

const COLUMNS = [
  { key: 'code', label: 'Code' },
  { key: 'discount', label: 'Discount' },
  { key: 'applies', label: 'Applies to' },
  { key: 'usage', label: 'Usage', align: 'right' as const },
  { key: 'given', label: 'Discount given', align: 'right' as const },
  { key: 'validity', label: 'Valid' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: '', align: 'right' as const },
];

const APPLICABLE_TO = [
  { value: 'all', label: 'Everything' },
  { value: 'unlock_lead', label: 'Lead unlock' },
  { value: 'unlock_tutor', label: 'Tutor unlock' },
  { value: 'subscription', label: 'Subscription' },
  { value: 'credit_pack', label: 'Credit pack' },
];

export function PromosPage() {
  const { get, set, page, setPage } = useListParams();
  const toast = useToast();
  const queryClient = useQueryClient();

  const isActive = get('isActive');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PromoCode | null>(null);
  const [deactivating, setDeactivating] = useState<PromoCode | null>(null);

  const query = useQuery({
    queryKey: ['admin', 'promos', { isActive, page }],
    queryFn: () => financeApi.listPromos({ isActive, page, limit: 20 }),
    placeholderData: keepPreviousData,
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => financeApi.deactivatePromo(id),
    onSuccess: (result) => {
      toast.success(result.message || 'Promo code deactivated');
      setDeactivating(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'promos'] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Action failed'),
  });

  const promos = query.data?.promos ?? [];

  return (
    <div className="page">
      <PageHeader
        title="Promo codes"
        subtitle="Discount codes applied at checkout for unlocks, subscriptions and credit packs."
        actions={
          <Button variant="primary" icon={<IconPlus size={15} />} onClick={() => setCreating(true)}>
            New promo code
          </Button>
        }
      />

      <Card padded={false}>
        <Toolbar>
          <FilterSelect
            value={isActive}
            onChange={(value) => set({ isActive: value })}
            options={[
              { value: 'true', label: 'Active' },
              { value: 'false', label: 'Inactive' },
            ]}
            placeholder="All codes"
            ariaLabel="Filter by active state"
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

            {query.isSuccess && promos.length === 0 && (
              <TableMessageRow colSpan={COLUMNS.length}>
                <EmptyState
                  title="No promo codes"
                  message={
                    isActive
                      ? 'No codes match this filter.'
                      : 'Create a promo code to run a discount campaign.'
                  }
                  action={
                    <Button variant="primary" onClick={() => setCreating(true)}>
                      New promo code
                    </Button>
                  }
                />
              </TableMessageRow>
            )}

            {query.isSuccess && promos.length > 0 && (
              <tbody>
                {promos.map((promo) => {
                  const expired = new Date(promo.validTo).getTime() < Date.now();
                  const exhausted = promo.usageLimit > 0 && promo.usageCount >= promo.usageLimit;

                  return (
                    <tr key={promo._id}>
                      <td>
                        <div className="mono cell-primary" style={{ fontSize: 13 }}>
                          {promo.code}
                        </div>
                        <div className="cell-sub truncate" style={{ maxWidth: 220 }}>
                          {promo.description}
                        </div>
                      </td>
                      <td>
                        <span className="strong">
                          {promo.discountType === 'percent'
                            ? `${promo.discountValue}%`
                            : formatCurrency(promo.discountValue)}
                        </span>
                        {promo.discountType === 'percent' && promo.maxDiscountAmount ? (
                          <div className="cell-sub">
                            max {formatCurrency(promo.maxDiscountAmount)}
                          </div>
                        ) : null}
                      </td>
                      <td className="muted">{humanize(promo.applicableTo)}</td>
                      <td className="num">
                        {formatNumber(promo.usageCount)}
                        <span className="dim">
                          {promo.usageLimit > 0 ? ` / ${promo.usageLimit}` : ' / ∞'}
                        </span>
                      </td>
                      <td className="num muted">{formatCurrency(promo.totalDiscountGiven)}</td>
                      <td className="muted nowrap text-xs">
                        {formatDate(promo.validFrom)}
                        <br />
                        {formatDate(promo.validTo)}
                      </td>
                      <td>
                        <div className="row gap-1 wrap">
                          <StatusBadge status={promo.isActive ? 'active' : 'inactive'} />
                          {promo.isActive && expired && <Badge tone="warning">Expired</Badge>}
                          {promo.isActive && exhausted && <Badge tone="warning">Limit reached</Badge>}
                        </div>
                      </td>
                      <td className="actions">
                        <div className="row gap-1" style={{ justifyContent: 'flex-end' }}>
                          <IconButton label="Edit promo code" onClick={() => setEditing(promo)}>
                            <IconEdit size={15} />
                          </IconButton>
                          <IconButton
                            label="Deactivate promo code"
                            disabled={!promo.isActive}
                            title={promo.isActive ? 'Deactivate' : 'Already inactive'}
                            onClick={() => setDeactivating(promo)}
                          >
                            <IconTrash size={15} />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            )}
          </table>
        </TableWrap>

        {query.isSuccess && promos.length > 0 && (
          <div className="card-foot">
            <Pagination pagination={query.data.pagination} onChange={setPage} itemLabel="promo codes" />
          </div>
        )}
      </Card>

      {(creating || editing) && (
        <PromoFormModal
          promo={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            queryClient.invalidateQueries({ queryKey: ['admin', 'promos'] });
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deactivating)}
        title="Deactivate this promo code?"
        destructive
        confirmLabel="Deactivate"
        busy={deactivate.isPending}
        message={
          <>
            <strong className="mono">{deactivating?.code}</strong> stops working at checkout
            immediately. The code and its usage history are kept, not deleted, so past orders stay
            explainable.
          </>
        }
        onCancel={() => setDeactivating(null)}
        onConfirm={() => deactivating && deactivate.mutate(deactivating._id)}
      />
    </div>
  );
}

function toDateInput(value: string | undefined) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function PromoFormModal({
  promo,
  onClose,
  onSaved,
}: {
  promo: PromoCode | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const isEdit = Boolean(promo);

  const [form, setForm] = useState({
    code: promo?.code ?? '',
    description: promo?.description ?? '',
    discountType: promo?.discountType ?? 'percent',
    discountValue: promo ? String(promo.discountValue) : '',
    maxDiscountAmount: promo?.maxDiscountAmount ? String(promo.maxDiscountAmount) : '',
    applicableTo: promo?.applicableTo ?? 'all',
    minOrderAmount: promo ? String(promo.minOrderAmount ?? 0) : '0',
    usageLimit: promo ? String(promo.usageLimit ?? 0) : '0',
    perUserLimit: promo ? String(promo.perUserLimit ?? 1) : '1',
    validFrom: toDateInput(promo?.validFrom) || new Date().toISOString().slice(0, 10),
    validTo: toDateInput(promo?.validTo),
    isActive: promo?.isActive ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = (key: keyof typeof form, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        description: form.description.trim(),
        discountType: form.discountType as 'flat' | 'percent',
        discountValue: Number(form.discountValue),
        maxDiscountAmount: form.maxDiscountAmount ? Number(form.maxDiscountAmount) : undefined,
        applicableTo: form.applicableTo,
        minOrderAmount: Number(form.minOrderAmount) || 0,
        usageLimit: Number(form.usageLimit) || 0,
        perUserLimit: Number(form.perUserLimit) || 1,
        validFrom: new Date(form.validFrom).toISOString(),
        validTo: new Date(form.validTo).toISOString(),
      };

      // The code itself is the identifier and is not editable after creation.
      if (isEdit && promo) {
        return financeApi.updatePromo(promo._id, { ...payload, isActive: form.isActive });
      }
      return financeApi.createPromo({ ...payload, code: form.code.trim().toUpperCase() });
    },
    onSuccess: (result) => {
      toast.success(result.message || (isEdit ? 'Promo code updated' : 'Promo code created'));
      onSaved();
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        setErrors(
          Object.fromEntries(error.fieldErrors.map((fieldError) => [fieldError.field, fieldError.message]))
        );
        toast.error(error.message);
      } else {
        toast.error('Could not save the promo code.');
      }
    },
  });

  function submit() {
    const nextErrors: Record<string, string> = {};

    if (!isEdit) {
      if (!form.code.trim()) nextErrors.code = 'A code is required';
      else if (!/^[A-Za-z0-9_-]{3,24}$/.test(form.code.trim()))
        nextErrors.code = 'Use 3–24 letters, digits, hyphens or underscores';
    }

    if (!form.description.trim()) nextErrors.description = 'A description is required';

    const value = Number(form.discountValue);
    if (!Number.isFinite(value) || value <= 0)
      nextErrors.discountValue = 'Enter a discount greater than zero';
    else if (form.discountType === 'percent' && value > 100)
      nextErrors.discountValue = 'A percentage discount cannot exceed 100';

    if (!form.validTo) nextErrors.validTo = 'An end date is required';
    else if (form.validFrom && new Date(form.validTo) <= new Date(form.validFrom))
      nextErrors.validTo = 'The end date must be after the start date';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    save.mutate();
  }

  return (
    <Modal
      open
      size="lg"
      title={isEdit ? 'Edit promo code' : 'New promo code'}
      description={isEdit ? promo?.code : undefined}
      busy={save.isPending}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button variant="primary" loading={save.isPending} onClick={submit}>
            {isEdit ? 'Save changes' : 'Create promo code'}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        {!isEdit && (
          <TextInput
            label="Code"
            required
            value={form.code}
            error={errors.code}
            hint="Stored in upper case. Cannot be changed later."
            style={{ textTransform: 'uppercase' }}
            onChange={(event) => update('code', event.target.value)}
          />
        )}

        <Select
          label="Applies to"
          value={form.applicableTo}
          options={APPLICABLE_TO}
          error={errors.applicableTo}
          className={isEdit ? '' : undefined}
          onChange={(event) => update('applicableTo', event.target.value)}
        />

        <TextArea
          className="span-2"
          label="Description"
          required
          rows={2}
          value={form.description}
          error={errors.description}
          hint="Shown to users when the code is applied."
          onChange={(event) => update('description', event.target.value)}
        />

        <Select
          label="Discount type"
          value={form.discountType}
          options={[
            { value: 'percent', label: 'Percentage' },
            { value: 'flat', label: 'Flat amount' },
          ]}
          onChange={(event) => update('discountType', event.target.value)}
        />

        <TextInput
          label={form.discountType === 'percent' ? 'Discount (%)' : 'Discount (INR)'}
          type="number"
          min={1}
          required
          value={form.discountValue}
          error={errors.discountValue}
          onChange={(event) => update('discountValue', event.target.value)}
        />

        <TextInput
          label="Maximum discount (INR)"
          type="number"
          min={0}
          value={form.maxDiscountAmount}
          error={errors.maxDiscountAmount}
          disabled={form.discountType !== 'percent'}
          hint="Caps a percentage discount. Ignored for flat discounts."
          onChange={(event) => update('maxDiscountAmount', event.target.value)}
        />

        <TextInput
          label="Minimum order (INR)"
          type="number"
          min={0}
          value={form.minOrderAmount}
          error={errors.minOrderAmount}
          hint="0 for no minimum."
          onChange={(event) => update('minOrderAmount', event.target.value)}
        />

        <TextInput
          label="Total usage limit"
          type="number"
          min={0}
          value={form.usageLimit}
          error={errors.usageLimit}
          hint="0 for unlimited."
          onChange={(event) => update('usageLimit', event.target.value)}
        />

        <TextInput
          label="Per-user limit"
          type="number"
          min={1}
          value={form.perUserLimit}
          error={errors.perUserLimit}
          onChange={(event) => update('perUserLimit', event.target.value)}
        />

        <TextInput
          label="Valid from"
          type="date"
          required
          value={form.validFrom}
          error={errors.validFrom}
          onChange={(event) => update('validFrom', event.target.value)}
        />

        <TextInput
          label="Valid to"
          type="date"
          required
          value={form.validTo}
          error={errors.validTo}
          onChange={(event) => update('validTo', event.target.value)}
        />

        {isEdit && (
          <div className="span-2">
            <label className="check">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => update('isActive', event.target.checked)}
              />
              <span>Code is active</span>
            </label>
          </div>
        )}
      </div>
    </Modal>
  );
}
