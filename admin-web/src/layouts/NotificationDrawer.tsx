import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import * as notificationsApi from '../api/notifications';
import { Button, IconButton } from '../components/ui/Button';
import { IconClose } from '../components/ui/Icons';
import { EmptyState, ErrorState, InlineLoader } from '../components/common/States';
import { formatRelative } from '../utils/format';

/**
 * Reads the shared `/api/notifications` feed — the same one the mobile clients
 * use. The backend scopes results to the authenticated admin.
 */
export function NotificationDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => notificationsApi.listNotifications({ page: 1, limit: 25 }),
    enabled: open,
  });

  const markAll = useMutation({
    mutationFn: notificationsApi.markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markOne = useMutation({
    mutationFn: notificationsApi.markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  if (!open) return null;

  const notifications = query.data?.notifications ?? [];
  const unreadCount = query.data?.unreadCount ?? 0;

  return createPortal(
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="Notifications">
        <div className="drawer-head">
          <div>
            <h2 className="section-title">Notifications</h2>
            <p className="muted text-xs" style={{ marginTop: 2 }}>
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </p>
          </div>
          <div className="row gap-2">
            {unreadCount > 0 && (
              <Button size="sm" variant="ghost" loading={markAll.isPending} onClick={() => markAll.mutate()}>
                Mark all read
              </Button>
            )}
            <IconButton label="Close notifications" onClick={onClose}>
              <IconClose size={16} />
            </IconButton>
          </div>
        </div>

        <div className="drawer-body">
          {query.isLoading && <InlineLoader label="Loading notifications…" />}

          {query.isError && (
            <ErrorState error={query.error} onRetry={() => query.refetch()} />
          )}

          {query.isSuccess && notifications.length === 0 && (
            <EmptyState
              title="No notifications yet"
              message="Platform alerts and admin notices will appear here."
            />
          )}

          {notifications.map((notification) => (
            <div
              key={notification._id}
              className={`notif${notification.isRead ? '' : ' unread'}`}
              onClick={() => {
                if (!notification.isRead) markOne.mutate(notification._id);
              }}
            >
              {!notification.isRead && <span className="notif-dot" />}
              <div style={{ minWidth: 0, marginLeft: notification.isRead ? 15 : 0 }}>
                <p className="notif-title">{notification.title}</p>
                <p className="notif-body">{notification.body}</p>
                <p className="notif-time">{formatRelative(notification.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </>,
    document.body
  );
}
