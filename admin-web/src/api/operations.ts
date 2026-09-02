import { request, requestData, uploadFile } from './client';
import type {
  Campaign,
  CampaignsSummary,
  DemandAnalytics,
  KycQueueResult,
  LocationConfig,
  OverviewAnalytics,
  Pagination,
  SmtpConfig,
  SupplyAnalytics,
  Ticket,
  TicketListResult,
  TicketStats,
} from '../types';

/** KYC queue, tickets, campaigns, analytics, imports and platform settings. */

// ── KYC verification queue ─────────────────────────────────────────────────

export function getKycQueue(params: { status?: string; search?: string; page?: number; limit?: number }) {
  return requestData<KycQueueResult>('/admin/kyc', { query: { ...params } });
}

export function getKycDetail(id: string) {
  return requestData<{ kyc: any; teacherProfile: any; profileCompletion: number }>(
    `/admin/kyc/${id}`
  );
}

export function approveKyc(id: string, notes?: string) {
  return request<{ success: boolean; message: string }>(`/admin/kyc/${id}/approve`, {
    method: 'POST',
    body: notes ? { notes } : {},
  });
}

export function rejectKyc(id: string, reason: string, notes?: string) {
  return request<{ success: boolean; message: string }>(`/admin/kyc/${id}/reject`, {
    method: 'POST',
    body: { reason, ...(notes ? { notes } : {}) },
  });
}

export function requestKycReupload(id: string, documentTypes: string[], reason: string) {
  return request<{ success: boolean; message: string }>(`/admin/kyc/${id}/request-reupload`, {
    method: 'POST',
    body: { documentTypes, reason },
  });
}

// ── Support tickets ────────────────────────────────────────────────────────

export function listTickets(params: {
  status?: string;
  priority?: string;
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  return requestData<TicketListResult>('/tickets', { query: { ...params } });
}

export function getTicketStats() {
  return requestData<TicketStats>('/tickets/stats');
}

export function getTicket(id: string) {
  return requestData<Ticket>(`/tickets/${id}`);
}

export function replyToTicket(id: string, message: string) {
  return request<{ success: boolean; message: string }>(`/tickets/${id}/reply`, {
    method: 'POST',
    body: { message },
  });
}

export function assignTicket(id: string, assignedTo: string) {
  return request<{ success: boolean; message: string }>(`/tickets/${id}/assign`, {
    method: 'PATCH',
    body: { assignedTo },
  });
}

export function resolveTicket(id: string, resolution?: string) {
  return request<{ success: boolean; message: string }>(`/tickets/${id}/resolve`, {
    method: 'PATCH',
    body: resolution ? { resolution } : {},
  });
}

export function closeTicket(id: string) {
  return request<{ success: boolean; message: string }>(`/tickets/${id}/close`, {
    method: 'PATCH',
  });
}

export function reopenTicket(id: string) {
  return request<{ success: boolean; message: string }>(`/tickets/${id}/reopen`, {
    method: 'PATCH',
  });
}

// ── Notification campaigns ─────────────────────────────────────────────────

export function listCampaigns(params: { status?: string; campaignType?: string; page?: number; limit?: number }) {
  return requestData<{ campaigns: Campaign[]; pagination: Pagination }>('/admin/campaigns', {
    query: { ...params },
  });
}

export function getCampaignsSummary() {
  return requestData<CampaignsSummary>('/admin/campaigns/summary');
}

export interface CampaignInput {
  title: string;
  message: string;
  imageUrl?: string;
  deepLinkScreen?: string;
  campaignType?: string;
  targetAudience: string;
  scheduledAt?: string;
}

export function createCampaign(input: CampaignInput) {
  return request<{ success: boolean; message: string }>('/admin/campaigns', {
    method: 'POST',
    body: input,
  });
}

export function updateCampaign(id: string, input: Partial<CampaignInput>) {
  return request<{ success: boolean; message: string }>(`/admin/campaigns/${id}`, {
    method: 'PUT',
    body: input,
  });
}

export function deleteCampaign(id: string) {
  return request<{ success: boolean; message: string }>(`/admin/campaigns/${id}`, {
    method: 'DELETE',
  });
}

export function sendCampaign(id: string) {
  return request<{ success: boolean; message: string }>(`/admin/campaigns/${id}/send`, {
    method: 'POST',
  });
}

export function cancelCampaign(id: string, reason: string) {
  return request<{ success: boolean; message: string }>(`/admin/campaigns/${id}/cancel`, {
    method: 'POST',
    body: { reason },
  });
}

export function duplicateCampaign(id: string) {
  return request<{ success: boolean; message: string }>(`/admin/campaigns/${id}/duplicate`, {
    method: 'POST',
  });
}

export function getCampaignStats(id: string) {
  return requestData<{ campaign: Campaign; stats: any; dailyTrend: Array<{ date: string; opened: number }> }>(
    `/admin/campaigns/${id}/stats`
  );
}

// ── Analytics ──────────────────────────────────────────────────────────────

export function getOverviewAnalytics() {
  return requestData<OverviewAnalytics>('/admin/analytics/overview');
}

export function getDemandAnalytics() {
  return requestData<DemandAnalytics>('/admin/analytics/demand');
}

export function getSupplyAnalytics() {
  return requestData<SupplyAnalytics>('/admin/analytics/supply');
}

export function getGeographyAnalytics() {
  return requestData<Record<string, any>>('/admin/analytics/geography');
}

export function getSubjectAnalytics() {
  return requestData<Record<string, any>>('/admin/analytics/subjects');
}

export function getSupplyDemandAnalytics() {
  return requestData<Record<string, any>>('/admin/analytics/supply-demand');
}

// ── Data import ────────────────────────────────────────────────────────────

export interface ImportResult {
  totalRows?: number;
  successCount?: number;
  failureCount?: number;
  errors?: Array<{ row: number; message: string; field?: string }>;
  [key: string]: any;
}

export function importParents(file: File) {
  return uploadFile<{ success: boolean; message: string; data: ImportResult }>(
    '/admin/import/parents',
    'file',
    file
  );
}

export function importTeachers(file: File) {
  return uploadFile<{ success: boolean; message: string; data: ImportResult }>(
    '/admin/import/teachers',
    'file',
    file
  );
}

export function getImportHistory(params: { page?: number; limit?: number }) {
  return request<{ success: boolean; data: any[]; pagination?: Pagination }>(
    '/admin/import/history',
    { query: { ...params } }
  );
}

// ── Platform settings ──────────────────────────────────────────────────────

export function getSmtpConfig() {
  return requestData<SmtpConfig>('/admin/smtp-config');
}

export function updateSmtpConfig(payload: Record<string, any>) {
  return request<{ success: boolean; message: string }>('/admin/smtp-config', {
    method: 'PUT',
    body: payload,
  });
}

/**
 * `POST /admin/smtp-config/test` takes the server details alongside the
 * recipient (`to`), so an unsaved configuration can be verified before saving.
 * Omitting `password` makes the backend fall back to the stored one.
 */
export function testSmtpConfig(payload: {
  to: string;
  host: string;
  port: number;
  encryption?: string;
  authRequired?: boolean;
  username?: string;
  password?: string;
  fromEmail?: string;
  fromName?: string;
  replyToEmail?: string;
}) {
  return request<{ success: boolean; message: string }>('/admin/smtp-config/test', {
    method: 'POST',
    body: payload,
  });
}

export function getLocationConfig() {
  return requestData<LocationConfig>('/admin/location-config');
}

export function updateLocationConfig(payload: Record<string, any>) {
  return request<{ success: boolean; message: string }>('/admin/location-config', {
    method: 'PUT',
    body: payload,
  });
}

/**
 * `POST /admin/location-config/test` verifies a key by geocoding the backend's
 * own sample address. Passing `apiKey` tests an unsaved key; omitting it tests
 * the stored one.
 */
export function testLocationConfig(apiKey?: string) {
  return request<{ success: boolean; message: string; data?: any }>('/admin/location-config/test', {
    method: 'POST',
    body: apiKey ? { apiKey } : {},
  });
}
