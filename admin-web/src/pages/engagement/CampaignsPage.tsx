import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as operationsApi from '../../api/operations';
import { ApiError } from '../../api/client';
import { Card, Kpi } from '../../components/ui/Primitives';
import { Button, IconButton } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import { FilterSelect, Select, TextArea, TextInput } from '../../components/ui/Form';
import { ConfirmDialog, Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { PageHeader, Toolbar } from '../../components/common/ListToolbar';
import { EmptyState, ErrorState, TableSkeleton } from '../../components/common/States';
import { Pagination, TableHead, TableMessageRow, TableWrap } from '../../components/ui/Table';
import { IconEdit, IconPlus, IconTrash } from '../../components/ui/Icons';
import { useListParams } from '../../hooks';
import { CAMPAIGN_AUDIENCES, CAMPAIGN_TYPES } from '../../utils/constants';
import { formatDateTime, formatNumber, formatPercent, humanize } from '../../utils/format';
import type { Campaign } from '../../types';

const COLUMNS = [
  { key: 'campaign', label: 'Campaign' },
  { key: 'audience', label: 'Audience' },
  { key: 'type', label: 'Type' },
  { key: 'targeted', label: 'Targeted', align: 'right' as const },
  { key: 'delivered', label: 'Delivered', align: 'right' as const },
  { key: 'openRate', label: 'Open rate', align: 'right' as const },
  { key: 'when', label: 'Sent / scheduled' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: '', align: 'right' as const },
];

const AUDIENCE_LABELS = Object.fromEntries(
  CAMPAIGN_AUDIENCES.map((audience) => [audience.value, audience.label])
);

export function CampaignsPage() {
  const { get, set, page, setPage } = useListParams();
  const toast = useToast();
  const queryClient = useQueryClient();

  const status = get('status');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [sending, setSending] = useState<Campaign | null>(null);
  const [deleting, setDeleting] = useState<Campaign | null>(null);

  const summary = useQuery({
    queryKey: ['admin', 'campaigns', 'summary'],
    queryFn: operationsApi.getCampaignsSummary,
  });

  const query = useQuery({
    queryKey: ['admin', 'campaigns', { status, page }],
    queryFn: () => operationsApi.listCampaigns({ status, page, limit: 20 }),
    placeholderData: keepPreviousData,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'campaigns'] });
  };

  const send = useMutation({
    mutationFn: (id: string) => operationsApi.sendCampaign(id),
    onSuccess: (result) => {
      toast.success(result.message || 'Campaign sending');
      setSending(null);
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Send failed'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => operationsApi.deleteCampaign(id),
    onSuccess: (result) => {
      toast.success(result.message || 'Campaign deleted');
      setDeleting(null);
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Delete failed'),
  });

  const duplicate = useMutation({
    mutationFn: (id: string) => operationsApi.duplicateCampaign(id),
    onSuccess: (result) => {
      toast.success(result.message || 'Campaign duplicated as a draft');
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Duplicate failed'),
  });

  const campaigns = query.data?.campaigns ?? [];
  const totals = summary.data?.totals;

  return (
    <div className="page">
      <PageHeader
        title="Campaigns"
        subtitle="Push notification campaigns sent to segments of the user base."
        actions={
          <Button variant="primary" icon={<IconPlus size={15} />} onClick={() => setCreating(true)}>
            New campaign
          </Button>
        }
      />

      <div className="grid grid-kpi mb-4">
        <Kpi
          label="Campaigns"
          value={formatNumber(summary.data?.total)}
          accent="#2D0A7D"
          loading={summary.isLoading}
        />
        <Kpi
          label="Notifications sent"
          value={formatNumber(totals?.totalSent)}
          accent="#5B21B6"
          loading={summary.isLoading}
        />
        <Kpi
          label="Delivered"
          value={formatNumber(totals?.totalDelivered)}
          foot={`${formatNumber(totals?.totalFailed)} failed`}
          accent="#10B981"
          loading={summary.isLoading}
        />
        <Kpi
          label="Opened"
          value={formatNumber(totals?.totalOpened)}
          foot={`${formatPercent(totals?.overallOpenRate)} open rate`}
          accent="#EC4899"
          loading={summary.isLoading}
        />
      </div>

      <Card padded={false}>
        <Toolbar>
          <FilterSelect
            value={status}
            onChange={(value) => set({ status: value })}
            options={[
              { value: 'draft', label: 'Draft' },
              { value: 'scheduled', label: 'Scheduled' },
              { value: 'sending', label: 'Sending' },
              { value: 'sent', label: 'Sent' },
              { value: 'failed', label: 'Failed' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
            placeholder="All statuses"
            ariaLabel="Filter by campaign status"
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

            {query.isSuccess && campaigns.length === 0 && (
              <TableMessageRow colSpan={COLUMNS.length}>
                <EmptyState
                  title="No campaigns"
                  message={
                    status
                      ? 'No campaigns with this status. Try clearing the filter.'
                      : 'Create a campaign to send a push notification to a segment of users.'
                  }
                  action={
                    <Button variant="primary" onClick={() => setCreating(true)}>
                      New campaign
                    </Button>
                  }
                />
              </TableMessageRow>
            )}

            {query.isSuccess && campaigns.length > 0 && (
              <tbody>
                {campaigns.map((campaign) => {
                  const stats = campaign.deliveryStats;
                  const isDraft = campaign.status === 'draft';

                  return (
                    <tr key={campaign._id}>
                      <td>
                        <div className="cell-primary truncate" style={{ maxWidth: 260 }}>
                          {campaign.title}
                        </div>
                        <div className="cell-sub truncate" style={{ maxWidth: 260 }}>
                          {campaign.message}
                        </div>
                      </td>
                      <td className="muted nowrap">
                        {AUDIENCE_LABELS[campaign.targetAudience] ??
                          humanize(campaign.targetAudience)}
                      </td>
                      <td className="muted">{humanize(campaign.campaignType)}</td>
                      <td className="num">{formatNumber(stats?.totalTargeted)}</td>
                      <td className="num">{formatNumber(stats?.delivered)}</td>
                      <td className="num muted">{formatPercent(stats?.openRate)}</td>
                      <td className="muted nowrap">
                        {campaign.sentAt
                          ? formatDateTime(campaign.sentAt)
                          : campaign.scheduledAt
                            ? formatDateTime(campaign.scheduledAt)
                            : '—'}
                      </td>
                      <td>
                        <StatusBadge status={campaign.status} />
                      </td>
                      <td className="actions">
                        <div className="row gap-1" style={{ justifyContent: 'flex-end' }}>
                          {isDraft && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => setSending(campaign)}
                            >
                              Send
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            loading={duplicate.isPending && duplicate.variables === campaign._id}
                            onClick={() => duplicate.mutate(campaign._id)}
                          >
                            Duplicate
                          </Button>
                          <IconButton
                            label="Edit campaign"
                            disabled={!isDraft}
                            title={isDraft ? 'Edit' : 'Only drafts can be edited'}
                            onClick={() => setEditing(campaign)}
                          >
                            <IconEdit size={15} />
                          </IconButton>
                          <IconButton
                            label="Delete campaign"
                            onClick={() => setDeleting(campaign)}
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

        {query.isSuccess && campaigns.length > 0 && (
          <div className="card-foot">
            <Pagination pagination={query.data.pagination} onChange={setPage} itemLabel="campaigns" />
          </div>
        )}
      </Card>

      {(creating || editing) && (
        <CampaignFormModal
          campaign={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            invalidate();
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(sending)}
        title="Send this campaign now?"
        confirmLabel="Send campaign"
        busy={send.isPending}
        message={
          <>
            <strong>{sending?.title}</strong> will be pushed to every device in the{' '}
            <strong>
              {sending ? (AUDIENCE_LABELS[sending.targetAudience] ?? sending.targetAudience) : ''}
            </strong>{' '}
            segment. Notifications cannot be recalled once sent.
          </>
        }
        onCancel={() => setSending(null)}
        onConfirm={() => sending && send.mutate(sending._id)}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this campaign?"
        destructive
        confirmLabel="Delete campaign"
        busy={remove.isPending}
        message={
          <>
            <strong>{deleting?.title}</strong> and its delivery statistics will be removed. Already
            delivered notifications stay on users' devices.
          </>
        }
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting._id)}
      />
    </div>
  );
}

function CampaignFormModal({
  campaign,
  onClose,
  onSaved,
}: {
  campaign: Campaign | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const isEdit = Boolean(campaign);

  const [form, setForm] = useState({
    title: campaign?.title ?? '',
    message: campaign?.message ?? '',
    campaignType: campaign?.campaignType ?? 'broadcast',
    targetAudience: campaign?.targetAudience ?? 'all_users',
    imageUrl: campaign?.imageUrl ?? '',
    deepLinkScreen: campaign?.deepLinkScreen ?? '',
    scheduledAt: campaign?.scheduledAt ? campaign.scheduledAt.slice(0, 16) : '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        title: form.title.trim(),
        message: form.message.trim(),
        campaignType: form.campaignType,
        targetAudience: form.targetAudience,
        imageUrl: form.imageUrl.trim() || undefined,
        deepLinkScreen: form.deepLinkScreen.trim() || undefined,
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
      };
      if (isEdit && campaign) return operationsApi.updateCampaign(campaign._id, payload);
      return operationsApi.createCampaign(payload);
    },
    onSuccess: (result) => {
      toast.success(result.message || (isEdit ? 'Campaign updated' : 'Campaign created as a draft'));
      onSaved();
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        setErrors(
          Object.fromEntries(error.fieldErrors.map((fieldError) => [fieldError.field, fieldError.message]))
        );
        toast.error(error.message);
      } else {
        toast.error('Could not save the campaign.');
      }
    },
  });

  function submit() {
    const nextErrors: Record<string, string> = {};
    if (!form.title.trim()) nextErrors.title = 'A title is required';
    if (!form.message.trim()) nextErrors.message = 'A message is required';
    if (form.scheduledAt && new Date(form.scheduledAt).getTime() < Date.now())
      nextErrors.scheduledAt = 'Choose a time in the future';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    save.mutate();
  }

  return (
    <Modal
      open
      size="lg"
      title={isEdit ? 'Edit campaign' : 'New campaign'}
      description="Campaigns are created as drafts and are only delivered when you send them."
      busy={save.isPending}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button variant="primary" loading={save.isPending} onClick={submit}>
            {isEdit ? 'Save changes' : 'Create draft'}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <TextInput
          className="span-2"
          label="Title"
          required
          value={form.title}
          error={errors.title}
          hint="Shown as the notification heading."
          onChange={(event) => update('title', event.target.value)}
        />

        <TextArea
          className="span-2"
          label="Message"
          required
          rows={3}
          value={form.message}
          error={errors.message}
          hint="Keep it short — notification bodies are truncated on most devices."
          onChange={(event) => update('message', event.target.value)}
        />

        <Select
          label="Audience"
          value={form.targetAudience}
          error={errors.targetAudience}
          options={CAMPAIGN_AUDIENCES}
          onChange={(event) => update('targetAudience', event.target.value)}
        />

        <Select
          label="Campaign type"
          value={form.campaignType}
          error={errors.campaignType}
          options={CAMPAIGN_TYPES}
          onChange={(event) => update('campaignType', event.target.value)}
        />

        <TextInput
          label="Image URL"
          type="url"
          value={form.imageUrl}
          error={errors.imageUrl}
          placeholder="https://…"
          hint="Optional rich-notification image."
          onChange={(event) => update('imageUrl', event.target.value)}
        />

        <TextInput
          label="Deep link screen"
          value={form.deepLinkScreen}
          error={errors.deepLinkScreen}
          hint="Optional app screen name to open on tap."
          onChange={(event) => update('deepLinkScreen', event.target.value)}
        />

        <TextInput
          className="span-2"
          label="Schedule for"
          type="datetime-local"
          value={form.scheduledAt}
          error={errors.scheduledAt}
          hint="Leave blank to keep it a draft you send manually."
          onChange={(event) => update('scheduledAt', event.target.value)}
        />
      </div>
    </Modal>
  );
}
