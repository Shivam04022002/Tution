import { request, requestData } from './client';
import type {
  ActivityEntry,
  AdminParent,
  AdminParentDetail,
  AdminTeacher,
  AdminUser,
  Pagination,
  PlatformStats,
  StaffMember,
} from '../types';

/**
 * `/api/admin/*` user endpoints. Every one is guarded by
 * `authenticate + authorize('admin')` on the backend.
 */

interface ListEnvelope<T> {
  success: boolean;
  data: T[];
  pagination: Pagination;
}

export interface UserListParams {
  role?: string;
  search?: string;
  isActive?: string;
  page?: number;
  limit?: number;
}

export function getPlatformStats() {
  return requestData<PlatformStats>('/admin/stats');
}

export function getUsers(params: UserListParams) {
  return request<ListEnvelope<AdminUser>>('/admin/users', { query: { ...params } });
}

export function getActivityLog(params: { page?: number; limit?: number; action?: string; entityType?: string }) {
  return request<ListEnvelope<ActivityEntry>>('/admin/activity', { query: { ...params } });
}

// ── Parents ────────────────────────────────────────────────────────────────

export function getParents(params: { search?: string; isActive?: string; page?: number; limit?: number }) {
  return request<ListEnvelope<AdminParent>>('/admin/parents', { query: { ...params } });
}

export function getParent(id: string) {
  return requestData<AdminParentDetail>(`/admin/parents/${id}`);
}

/**
 * `PUT /api/admin/parents/:id` only honours `profile.firstName`,
 * `profile.lastName` and `isActive` — anything else is ignored server-side, so
 * the edit form exposes exactly those.
 */
export function updateParent(
  id: string,
  payload: { profile?: { firstName?: string; lastName?: string }; isActive?: boolean }
) {
  return request<{ success: boolean; message: string }>(`/admin/parents/${id}`, {
    method: 'PUT',
    body: payload,
  });
}

export function deleteParent(id: string) {
  return request<{ success: boolean; message: string }>(`/admin/parents/${id}`, {
    method: 'DELETE',
  });
}

// ── Teachers / tutors ──────────────────────────────────────────────────────

export interface TeacherListParams {
  verificationStatus?: string;
  city?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export function getTeachers(params: TeacherListParams) {
  return request<ListEnvelope<AdminTeacher>>('/admin/teachers', { query: { ...params } });
}

export function getTeacher(id: string) {
  return requestData<AdminTeacher>(`/admin/teachers/${id}`);
}

export function approveTeacher(id: string) {
  return request<{ success: boolean; message: string }>(`/admin/teachers/${id}/approve`, {
    method: 'PATCH',
  });
}

export function rejectTeacher(id: string, reason: string) {
  return request<{ success: boolean; message: string }>(`/admin/teachers/${id}/reject`, {
    method: 'PATCH',
    body: { reason },
  });
}

export function blockTeacher(id: string, reason: string) {
  return request<{ success: boolean; message: string }>(`/admin/teachers/${id}/block`, {
    method: 'PATCH',
    body: { reason },
  });
}

export function unblockTeacher(id: string) {
  return request<{ success: boolean; message: string }>(`/admin/teachers/${id}/unblock`, {
    method: 'PATCH',
  });
}

// ── Staff (administrators) ─────────────────────────────────────────────────

export interface StaffListParams {
  search?: string;
  department?: string;
  staffRole?: string;
  isActive?: string;
  page?: number;
  limit?: number;
}

export interface StaffInput {
  name: string;
  email: string;
  phoneNumber: string;
  password?: string;
  username?: string;
  department?: string;
  staffRole?: string;
  designation?: string;
  permissions?: string[];
  isActive?: boolean;
}

export function getStaff(params: StaffListParams) {
  return request<ListEnvelope<StaffMember>>('/admin/staff', { query: { ...params } });
}

export function getStaffMember(id: string) {
  return requestData<StaffMember>(`/admin/staff/${id}`);
}

export function createStaff(payload: StaffInput) {
  return request<{ success: boolean; message: string }>('/admin/staff', {
    method: 'POST',
    body: payload,
  });
}

export function updateStaff(id: string, payload: Partial<StaffInput>) {
  return request<{ success: boolean; message: string }>(`/admin/staff/${id}`, {
    method: 'PUT',
    body: payload,
  });
}

export function deleteStaff(id: string) {
  return request<{ success: boolean; message: string }>(`/admin/staff/${id}`, {
    method: 'DELETE',
  });
}

export function resetStaffPassword(id: string, password?: string) {
  return request<{ success: boolean; message: string; data?: { password?: string } }>(
    `/admin/staff/${id}/reset-password`,
    { method: 'POST', body: password ? { password } : {} }
  );
}

/** Staff roles accepted by `staffManagementController.STAFF_ROLES`. */
export const STAFF_ROLES = [
  'Operations',
  'Verification',
  'Customer Support',
  'Finance',
  'Marketing',
  'Content',
  'Academic Coordinator',
  'Sales',
  'Technical Support',
  'Super Staff',
] as const;
