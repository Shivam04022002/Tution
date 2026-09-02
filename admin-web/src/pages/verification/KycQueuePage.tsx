import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as operationsApi from '../../api/operations';
import { Avatar, Card, Tabs } from '../../components/ui/Primitives';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import { TextArea } from '../../components/ui/Form';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { PageHeader, SearchInput, Toolbar } from '../../components/common/ListToolbar';
import { EmptyState, ErrorState, TableSkeleton } from '../../components/common/States';
import { Pagination, TableHead, TableMessageRow, TableWrap } from '../../components/ui/Table';
import { useDebounced, useListParams } from '../../hooks';
import { formatDateTime, fullName } from '../../utils/format';
import type { KycQueueRecord } from '../../types';

const COLUMNS = [
  { key: 'tutor', label: 'Tutor' },
  { key: 'kycId', label: 'KYC ID' },
  { key: 'documents', label: 'Documents', align: 'right' as const },
  { key: 'submitted', label: 'Submitted' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: '', align: 'right' as const },
];

const TABS = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'reupload_required', label: 'Re-upload' },
  { value: 'all', label: 'All' },
] as const;

type Decision = { kind: 'approve' | 'reject'; record: KycQueueRecord };

export function KycQueuePage() {
  const { get, set, page, setPage } = useListParams();
  const queryClient = useQueryClient();

  const status = get('status') || 'submitted';
  const [searchText, setSearchText] = useState(get('search'));
  const search = useDebounced(searchText);

  const [decision, setDecision] = useState<Decision | null>(null);
  const [viewing, setViewing] = useState<KycQueueRecord | null>(null);

  const query = useQuery({
    queryKey: ['admin', 'kyc', { status, search, page }],
    queryFn: () =>
      operationsApi.getKycQueue({
        status: status === 'all' ? undefined : status,
        search,
        page,
        limit: 20,
      }),
    placeholderData: keepPreviousData,
  });

  const records = query.data?.records ?? [];
  const counts = query.data?.counts;

  return (
    <div className="page">
      <PageHeader
        title="KYC queue"
        subtitle="Tutor identity documents awaiting verification. Approving here marks the tutor verified."
      />

      <Card padded={false}>
        <div style={{ padding: '0 var(--s-4)' }}>
          <Tabs
            value={status}
            onChange={(next) => set({ status: next === 'submitted' ? '' : next })}
            tabs={TABS.map((tab) => ({
              value: tab.value,
              label: tab.label,
              count: counts
                ? tab.value === 'all'
                  ? counts.all
                  : counts[tab.value as keyof typeof counts]
                : undefined,
            }))}
          />
        </div>

        <Toolbar>
          <SearchInput
            value={searchText}
            onChange={(value) => {
              setSearchText(value);
              set({ search: value });
            }}
            placeholder="Search tutor name or email…"
            ariaLabel="Search KYC submissions"
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

            {query.isSuccess && records.length === 0 && (
              <TableMessageRow colSpan={COLUMNS.length}>
                <EmptyState
                  title={
                    status === 'submitted'
                      ? 'Nothing waiting for review'
                      : 'No submissions in this state'
                  }
                  message={
                    status === 'submitted'
                      ? 'The verification queue is clear. New submissions will appear here.'
                      : 'Switch tabs to see submissions in another state.'
                  }
                />
              </TableMessageRow>
            )}

            {query.isSuccess && records.length > 0 && (
              <tbody>
                {records.map((record) => {
                  const details = record.teacherId?.basicDetails;
                  const name =
                    details?.fullName || fullName(record.teacherId?.userId?.profile) || 'Unnamed tutor';
                  const pending = ['submitted', 'under_review'].includes(record.status);

                  return (
                    <tr key={record._id}>
                      <td>
                        <div className="row gap-3">
                          <Avatar name={name} src={details?.profilePhoto} />
                          <div style={{ minWidth: 0 }}>
                            <div className="cell-primary">{name}</div>
                            <div className="cell-sub truncate">
                              {details?.email || record.teacherId?.userId?.email || '—'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="mono muted">{record.kycId}</td>
                      <td className="num">{record.documents?.length ?? 0}</td>
                      <td className="muted nowrap">
                        {formatDateTime(record.submittedAt || record.createdAt)}
                      </td>
                      <td>
                        <StatusBadge status={record.status} />
                      </td>
                      <td className="actions">
                        <div className="row gap-1" style={{ justifyContent: 'flex-end' }}>
                          <Button size="sm" variant="ghost" onClick={() => setViewing(record)}>
                            Documents
                          </Button>
                          {pending && (
                            <>
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => setDecision({ kind: 'approve', record })}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setDecision({ kind: 'reject', record })}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            )}
          </table>
        </TableWrap>

        {query.isSuccess && records.length > 0 && query.data && (
          <div className="card-foot">
            <Pagination
              pagination={{
                page: query.data.pagination.page,
                limit: query.data.pagination.limit,
                total: query.data.pagination.total,
                pages: query.data.pagination.totalPages,
              }}
              onChange={setPage}
              itemLabel="submissions"
            />
          </div>
        )}
      </Card>

      {viewing && <KycDocumentsModal record={viewing} onClose={() => setViewing(null)} />}

      {decision && (
        <KycDecisionModal
          decision={decision}
          onClose={() => setDecision(null)}
          onDone={() => {
            setDecision(null);
            queryClient.invalidateQueries({ queryKey: ['admin', 'kyc'] });
            queryClient.invalidateQueries({ queryKey: ['admin', 'teachers'] });
            queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
          }}
        />
      )}
    </div>
  );
}

function KycDocumentsModal({
  record,
  onClose,
}: {
  record: KycQueueRecord;
  onClose: () => void;
}) {
  const query = useQuery({
    queryKey: ['admin', 'kyc', record._id],
    queryFn: () => operationsApi.getKycDetail(record._id),
  });

  const documents = query.data?.kyc?.documents ?? record.documents ?? [];

  return (
    <Modal
      open
      size="lg"
      title="Submitted documents"
      description={record.teacherId?.basicDetails?.fullName}
      onClose={onClose}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}

      {documents.length === 0 ? (
        <EmptyState title="No documents attached to this submission" />
      ) : (
        <div style={{ display: 'grid', gap: 'var(--s-3)' }}>
          {documents.map((document: any, index: number) => (
            <div
              key={document._id ?? index}
              className="row gap-3 wrap"
              style={{
                padding: 'var(--s-3)',
                border: '1px solid var(--c-border)',
                borderRadius: 'var(--r-md)',
                alignItems: 'center',
              }}
            >
              <div className="grow" style={{ minWidth: 160 }}>
                <p className="strong text-sm">
                  {String(document.documentType || 'Document').replace(/_/g, ' ')}
                </p>
                {document.documentNumber && (
                  <p className="field-hint mono">{document.documentNumber}</p>
                )}
                {document.rejectionReason && (
                  <p className="field-error">{document.rejectionReason}</p>
                )}
              </div>
              <StatusBadge status={document.status} />
              {document.fileUrl && (
                <a
                  href={document.fileUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="btn btn-secondary btn-sm"
                >
                  Open file
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {query.data?.profileCompletion !== undefined && (
        <p className="field-hint mt-4">
          Tutor profile completion: <strong>{query.data.profileCompletion}%</strong>
        </p>
      )}
    </Modal>
  );
}

function KycDecisionModal({
  decision,
  onClose,
  onDone,
}: {
  decision: Decision;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const run = useMutation({
    mutationFn: () =>
      decision.kind === 'approve'
        ? operationsApi.approveKyc(decision.record._id, text.trim() || undefined)
        : operationsApi.rejectKyc(decision.record._id, text.trim()),
    onSuccess: (result) => {
      toast.success(
        result?.message || (decision.kind === 'approve' ? 'KYC approved' : 'KYC rejected')
      );
      onDone();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Action failed'),
  });

  function submit() {
    if (decision.kind === 'reject' && !text.trim()) {
      setError('A reason is required and is shown to the tutor.');
      return;
    }
    setError('');
    run.mutate();
  }

  return (
    <Modal
      open
      size="sm"
      title={decision.kind === 'approve' ? 'Approve this KYC?' : 'Reject this KYC?'}
      description={decision.record.teacherId?.basicDetails?.fullName}
      busy={run.isPending}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={run.isPending}>
            Cancel
          </Button>
          <Button
            variant={decision.kind === 'approve' ? 'primary' : 'danger'}
            loading={run.isPending}
            onClick={submit}
          >
            {decision.kind === 'approve' ? 'Approve KYC' : 'Reject KYC'}
          </Button>
        </>
      }
    >
      <p className="text-sm muted" style={{ lineHeight: 1.55 }}>
        {decision.kind === 'approve'
          ? 'The tutor’s identity is confirmed and their verification status updates across the platform.'
          : 'The tutor is told their documents were rejected and can resubmit.'}
      </p>

      <div className="mt-4">
        <TextArea
          label={decision.kind === 'approve' ? 'Verification notes' : 'Rejection reason'}
          required={decision.kind === 'reject'}
          rows={3}
          value={text}
          error={error}
          placeholder={
            decision.kind === 'approve'
              ? 'Optional note stored with the KYC record.'
              : 'Which document failed, and why?'
          }
          onChange={(event) => {
            setText(event.target.value);
            if (error) setError('');
          }}
        />
      </div>
    </Modal>
  );
}
