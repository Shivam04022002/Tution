import { request, requestData } from './client';
import type {
  CreditBalanceRow,
  CreditMetrics,
  CreditTransactionRow,
  InvoiceMetrics,
  Pagination,
  PaymentMetrics,
  PromoCode,
  RefundRequestRow,
  RevenueCharts,
  RevenueFilters,
  RevenueOverview,
  SubscriptionMetrics,
  SubscriptionRow,
} from '../types';

/** Revenue, payments, invoices, refunds, subscriptions, credits and promos. */

function revenueQuery(filters: RevenueFilters, extra: Record<string, any> = {}) {
  return {
    range: filters.range,
    from: filters.range === 'custom' ? filters.from : undefined,
    to: filters.range === 'custom' ? filters.to : undefined,
    ...extra,
  };
}

// ── Revenue dashboards ─────────────────────────────────────────────────────

export function getRevenueOverview(filters: RevenueFilters) {
  return requestData<RevenueOverview>('/admin/revenue/overview', { query: revenueQuery(filters) });
}

export function getRevenueCharts(filters: RevenueFilters) {
  return requestData<RevenueCharts>('/admin/revenue/charts', { query: revenueQuery(filters) });
}

export function getSubscriptionMetrics(filters: RevenueFilters) {
  return requestData<SubscriptionMetrics>('/admin/revenue/subscriptions', {
    query: revenueQuery(filters),
  });
}

export function getCreditMetrics(filters: RevenueFilters) {
  return requestData<CreditMetrics>('/admin/revenue/credits', { query: revenueQuery(filters) });
}

export function getPaymentMetrics(filters: RevenueFilters, page = 1, limit = 20) {
  return requestData<PaymentMetrics>('/admin/revenue/payments', {
    query: revenueQuery(filters, { page, limit }),
  });
}

export function getInvoiceMetrics(filters: RevenueFilters, page = 1, limit = 20) {
  return requestData<InvoiceMetrics>('/admin/revenue/invoices', {
    query: revenueQuery(filters, { page, limit }),
  });
}

// ── Refunds ────────────────────────────────────────────────────────────────

export function listRefunds(params: { status?: string; page?: number; limit?: number }) {
  return requestData<{ requests: RefundRequestRow[]; pagination: Pagination }>('/admin/refunds', {
    query: { ...params },
  });
}

export function approveRefund(id: string, adminNotes?: string) {
  return request<{ success: boolean; message: string }>(`/admin/refunds/${id}/approve`, {
    method: 'PATCH',
    body: adminNotes ? { adminNotes } : {},
  });
}

export function rejectRefund(id: string, rejectionReason: string) {
  return request<{ success: boolean; message: string }>(`/admin/refunds/${id}/reject`, {
    method: 'PATCH',
    body: { rejectionReason },
  });
}

// ── Subscriptions ──────────────────────────────────────────────────────────

export interface SubscriptionListParams {
  page?: number;
  limit?: number;
  plan?: string;
  status?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function listSubscriptions(params: SubscriptionListParams) {
  return requestData<{ subscriptions: SubscriptionRow[]; pagination: Pagination }>(
    '/admin/subscriptions',
    { query: { ...params } }
  );
}

export function getSubscriptionSummary() {
  return requestData<{
    planDistribution: Record<string, number>;
    statusDistribution: Record<string, number>;
    upcomingExpirations: number;
    suspendedCount: number;
  }>('/admin/subscriptions/summary');
}

export function getSubscriptionDetail(teacherId: string) {
  return requestData<{
    subscription: any;
    payments: any[];
    creditTransactions: any[];
    auditHistory: any[];
  }>(`/admin/subscriptions/${teacherId}`);
}

export function upgradeSubscription(teacherId: string, targetPlan: string, reason: string) {
  return request<{ success: boolean; message: string }>('/admin/subscriptions/upgrade', {
    method: 'POST',
    body: { teacherId, targetPlan, reason },
  });
}

export function downgradeSubscription(teacherId: string, targetPlan: string, reason: string) {
  return request<{ success: boolean; message: string }>('/admin/subscriptions/downgrade', {
    method: 'POST',
    body: { teacherId, targetPlan, reason },
  });
}

export function extendSubscription(teacherId: string, extensionDays: number, reason: string) {
  return request<{ success: boolean; message: string }>('/admin/subscriptions/extend', {
    method: 'POST',
    body: { teacherId, extensionDays, reason },
  });
}

export function suspendSubscription(teacherId: string, reason: string) {
  return request<{ success: boolean; message: string }>('/admin/subscriptions/suspend', {
    method: 'POST',
    body: { teacherId, reason },
  });
}

export function reactivateSubscription(teacherId: string, reason: string) {
  return request<{ success: boolean; message: string }>('/admin/subscriptions/reactivate', {
    method: 'POST',
    body: { teacherId, reason },
  });
}

export function cancelSubscription(teacherId: string, reason: string) {
  return request<{ success: boolean; message: string }>('/admin/subscriptions/cancel', {
    method: 'POST',
    body: { teacherId, reason },
  });
}

// ── Credits ────────────────────────────────────────────────────────────────

export function listCredits(params: { page?: number; limit?: number; search?: string; plan?: string }) {
  return requestData<{ teachers: CreditBalanceRow[]; pagination: Pagination }>('/admin/credits', {
    query: { ...params },
  });
}

export function getCreditsSummary() {
  return requestData<Record<string, any>>('/admin/credits/summary');
}

export function listCreditTransactions(params: {
  page?: number;
  limit?: number;
  type?: string;
  teacherId?: string;
}) {
  return requestData<{ transactions: CreditTransactionRow[]; pagination: Pagination }>(
    '/admin/credits/transactions',
    { query: { ...params } }
  );
}

export function grantCredits(teacherId: string, amount: number, reason: string) {
  return request<{ success: boolean; message: string }>('/admin/credits/grant', {
    method: 'POST',
    body: { teacherId, amount, reason },
  });
}

export function deductCredits(teacherId: string, amount: number, reason: string) {
  return request<{ success: boolean; message: string }>('/admin/credits/deduct', {
    method: 'POST',
    body: { teacherId, amount, reason },
  });
}

export function grantBonusCredits(teacherId: string, amount: number, reason: string) {
  return request<{ success: boolean; message: string }>('/admin/credits/bonus', {
    method: 'POST',
    body: { teacherId, amount, reason },
  });
}

// ── Promo codes ────────────────────────────────────────────────────────────

export function listPromos(params: { page?: number; limit?: number; isActive?: string }) {
  return requestData<{ promos: PromoCode[]; pagination: Pagination }>('/admin/promos', {
    query: { ...params },
  });
}

export interface PromoInput {
  code: string;
  description: string;
  discountType: 'flat' | 'percent';
  discountValue: number;
  maxDiscountAmount?: number;
  applicableTo: string;
  minOrderAmount?: number;
  usageLimit?: number;
  perUserLimit?: number;
  validFrom: string;
  validTo: string;
}

export function createPromo(input: PromoInput) {
  return request<{ success: boolean; message: string }>('/admin/promos', {
    method: 'POST',
    body: input,
  });
}

export function updatePromo(id: string, input: Partial<PromoInput> & { isActive?: boolean }) {
  return request<{ success: boolean; message: string }>(`/admin/promos/${id}`, {
    method: 'PATCH',
    body: input,
  });
}

/** `DELETE /admin/promos/:id` deactivates rather than destroys the code. */
export function deactivatePromo(id: string) {
  return request<{ success: boolean; message: string }>(`/admin/promos/${id}`, {
    method: 'DELETE',
  });
}
