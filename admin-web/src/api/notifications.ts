import { request, requestData } from './client';
import type { NotificationListResult } from '../types';

/**
 * The shared notification feed (`/api/notifications`) — the same one the mobile
 * clients read. Only the admin's own notifications are returned; the backend
 * scopes by the authenticated user.
 */

export function listNotifications(params: {
  page?: number;
  limit?: number;
  category?: string;
  unreadOnly?: boolean;
}) {
  return requestData<NotificationListResult>('/notifications', { query: { ...params } });
}

export function getUnreadCount() {
  return requestData<{ unreadCount: number }>('/notifications/unread-count');
}

export function markAsRead(id: string) {
  return request<{ success: boolean }>(`/notifications/${id}/read`, { method: 'PATCH' });
}

export function markAllAsRead() {
  return request<{ success: boolean }>('/notifications/read-all', { method: 'PATCH' });
}

export function deleteNotification(id: string) {
  return request<{ success: boolean }>(`/notifications/${id}`, { method: 'DELETE' });
}
