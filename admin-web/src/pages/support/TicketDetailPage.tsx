import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as operationsApi from '../../api/operations';
import { useAuth } from '../../auth/AuthContext';
import { Avatar, Card, CardHeader, DefinitionList } from '../../components/ui/Primitives';
import { Button } from '../../components/ui/Button';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { TextArea } from '../../components/ui/Form';
import { ConfirmDialog } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { ErrorState, InlineLoader } from '../../components/common/States';
import { IconChevronLeft } from '../../components/ui/Icons';
import { TICKET_CATEGORY_LABELS } from '../../utils/constants';
import { formatDateTime, formatRelative, humanize } from '../../utils/format';
import type { BadgeTone } from '../../components/ui/Badge';
import type { TicketPriority } from '../../types';

const PRIORITY_TONES: Record<TicketPriority, BadgeTone> = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  urgent: 'error',
};

export function TicketDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [reply, setReply] = useState('');
  const [replyError, setReplyError] = useState('');
  const [confirming, setConfirming] = useState<'resolve' | 'close' | 'reopen' | null>(null);

  const query = useQuery({
    queryKey: ['admin', 'ticket', id],
    queryFn: () => operationsApi.getTicket(id),
    enabled: Boolean(id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'ticket', id] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'tickets'] });
  };

  const sendReply = useMutation({
    mutationFn: () => operationsApi.replyToTicket(id, reply.trim()),
    onSuccess: () => {
      toast.success('Reply sent');
      setReply('');
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not send reply'),
  });

  const assign = useMutation({
    mutationFn: () => operationsApi.assignTicket(id, user!.id),
    onSuccess: () => {
      toast.success('Ticket assigned to you');
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not assign'),
  });

  const changeState = useMutation({
    mutationFn: (kind: 'resolve' | 'close' | 'reopen') => {
      if (kind === 'resolve') return operationsApi.resolveTicket(id);
      if (kind === 'close') return operationsApi.closeTicket(id);
      return operationsApi.reopenTicket(id);
    },
    onSuccess: (result) => {
      toast.success(result?.message || 'Ticket updated');
      setConfirming(null);
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not update'),
  });

  if (query.isLoading) {
    return (
      <div className="page">
        <InlineLoader label="Loading ticket…" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="page">
        <Card>
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        </Card>
      </div>
    );
  }

  const ticket = query.data;
  const closed = ticket.status === 'closed';

  return (
    <div className="page">
      <Link to="/support/tickets" className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }}>
        <IconChevronLeft size={14} /> All tickets
      </Link>

      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <div className="row gap-2 wrap" style={{ marginBottom: 6 }}>
            <StatusBadge status={ticket.status} />
            <Badge tone={PRIORITY_TONES[ticket.priority] ?? 'neutral'}>
              {humanize(ticket.priority)}
            </Badge>
            <span className="mono dim text-xs">{ticket.ticketId}</span>
          </div>
          <h1 className="page-title">{ticket.subject}</h1>
        </div>

        <div className="row gap-2 wrap">
          {!ticket.assignedTo && (
            <Button variant="secondary" loading={assign.isPending} onClick={() => assign.mutate()}>
              Assign to me
            </Button>
          )}
          {ticket.status !== 'resolved' && !closed && (
            <Button variant="primary" onClick={() => setConfirming('resolve')}>
              Mark resolved
            </Button>
          )}
          {!closed && (
            <Button variant="ghost" onClick={() => setConfirming('close')}>
              Close
            </Button>
          )}
          {closed && (
            <Button variant="secondary" onClick={() => setConfirming('reopen')}>
              Reopen
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-3">
        <Card>
          <CardHeader title="Ticket" />
          <div style={{ paddingTop: 'var(--s-4)' }}>
            <DefinitionList
              items={[
                ['Raised by', ticket.userName],
                ['Email', ticket.userEmail],
                ['Phone', ticket.userPhone ? <span className="mono">{ticket.userPhone}</span> : '—'],
                ['Role', ticket.userRole === 'teacher' ? 'Tutor' : humanize(ticket.userRole)],
                [
                  'Category',
                  TICKET_CATEGORY_LABELS[ticket.category] ?? humanize(ticket.category),
                ],
                ['Assigned to', ticket.assignedToName ?? 'Unassigned'],
                ['Opened', formatDateTime(ticket.createdAt)],
                ['Last update', formatDateTime(ticket.updatedAt)],
                ...(ticket.resolvedAt
                  ? ([['Resolved', formatDateTime(ticket.resolvedAt)]] as Array<[string, string]>)
                  : []),
              ]}
            />
          </div>
        </Card>

        <div style={{ gridColumn: 'span 2', minWidth: 0 }}>
          <Card padded={false}>
            <CardHeader
              title="Conversation"
              subtitle={`${ticket.messages?.length ?? 0} message${
                ticket.messages?.length === 1 ? '' : 's'
              }`}
            />

            <div className="card-body" style={{ display: 'grid', gap: 'var(--s-4)' }}>
              <Message
                senderName={ticket.userName}
                sender="user"
                message={ticket.description}
                createdAt={ticket.createdAt}
              />

              {ticket.messages?.map((message) => (
                <Message
                  key={message._id}
                  senderName={message.senderName}
                  sender={message.sender}
                  message={message.message}
                  createdAt={message.createdAt}
                />
              ))}
            </div>

            {closed ? (
              <div className="card-foot">
                <p className="text-sm muted">
                  This ticket is closed. Reopen it to continue the conversation.
                </p>
              </div>
            ) : (
              <div className="card-foot">
                <TextArea
                  label="Reply"
                  rows={3}
                  value={reply}
                  error={replyError}
                  placeholder="Write a reply to the user…"
                  onChange={(event) => {
                    setReply(event.target.value);
                    if (replyError) setReplyError('');
                  }}
                />
                <div className="row gap-2 mt-4" style={{ justifyContent: 'flex-end' }}>
                  <Button
                    variant="primary"
                    loading={sendReply.isPending}
                    onClick={() => {
                      if (!reply.trim()) {
                        setReplyError('Write a message before sending.');
                        return;
                      }
                      sendReply.mutate();
                    }}
                  >
                    Send reply
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirming !== null}
        title={
          confirming === 'resolve'
            ? 'Mark this ticket resolved?'
            : confirming === 'close'
              ? 'Close this ticket?'
              : 'Reopen this ticket?'
        }
        confirmLabel={
          confirming === 'resolve' ? 'Mark resolved' : confirming === 'close' ? 'Close' : 'Reopen'
        }
        destructive={confirming === 'close'}
        busy={changeState.isPending}
        message={
          confirming === 'resolve'
            ? 'The user is told their issue has been resolved. They can still reply if it is not.'
            : confirming === 'close'
              ? 'Closing ends the conversation. It can be reopened later if needed.'
              : 'The ticket returns to the open queue.'
        }
        onCancel={() => setConfirming(null)}
        onConfirm={() => confirming && changeState.mutate(confirming)}
      />
    </div>
  );
}

function Message({
  senderName,
  sender,
  message,
  createdAt,
}: {
  senderName: string;
  sender: 'user' | 'admin' | 'staff';
  message: string;
  createdAt: string;
}) {
  const fromTeam = sender === 'admin' || sender === 'staff';

  return (
    <div className="row gap-3" style={{ alignItems: 'flex-start' }}>
      <Avatar name={senderName} />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          padding: 'var(--s-3) var(--s-4)',
          borderRadius: 'var(--r-md)',
          background: fromTeam ? '#F5F3FF' : 'var(--c-bg-2)',
          border: `1px solid ${fromTeam ? '#DDD6FE' : 'var(--c-border)'}`,
        }}
      >
        <div className="row-between gap-3">
          <span className="text-sm strong">
            {senderName}
            {fromTeam && (
              <span className="muted" style={{ fontWeight: 400 }}>
                {' '}
                · {humanize(sender)}
              </span>
            )}
          </span>
          <span className="dim text-xs nowrap" title={formatDateTime(createdAt)}>
            {formatRelative(createdAt)}
          </span>
        </div>
        <p className="text-sm" style={{ marginTop: 6, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
          {message}
        </p>
      </div>
    </div>
  );
}
