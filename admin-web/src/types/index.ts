/**
 * Types mirrored from the existing backend responses (`backend/src/controllers`)
 * and the mobile service layer (`tuition-mobile/src/services`). They describe
 * what the API already returns — nothing here invents a field.
 */

export type UserRole = 'parent' | 'teacher' | 'admin' | 'staff';

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface Paginated<T> {
  data: T[];
  pagination: Pagination;
}

export interface AuthUser {
  id: string;
  email: string;
  phoneNumber?: string;
  role: UserRole;
  staffRole?: string | null;
  permissions?: string[];
  profile: {
    firstName: string;
    lastName: string;
    profileImage?: string | null;
  };
  profileCompleted?: boolean;
  onboardingCompleted?: boolean;
}

// ── Users ──────────────────────────────────────────────────────────────────

export interface AdminUser {
  _id: string;
  email: string;
  // Two user document shapes coexist in the collection: older records carry
  // `phoneNumber`, newer ones `mobileNumber`. Read both via `userPhone()`.
  phoneNumber?: string;
  mobileNumber?: string;
  isVerified?: boolean;
  isEmailVerified?: boolean;
  isMobileVerified?: boolean;
  role: UserRole;
  staffRole?: string | null;
  profile: {
    firstName: string;
    lastName: string;
    profileImage?: string | null;
  };
  isActive: boolean;
  isBlocked?: boolean;
  createdAt: string;
}

export interface AdminParent extends Omit<AdminUser, 'role'> {
  role: 'parent';
  requirementsCount: number;
}

export interface AdminParentDetail extends AdminParent {
  requirements: Array<{
    _id: string;
    requirementId: string;
    subjects: string[];
    studentDetails: { grade: string };
    status: string;
    createdAt: string;
  }>;
}

export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export interface AdminTeacher {
  _id: string;
  userId:
    | string
    | { _id: string; email?: string; phoneNumber?: string; isActive?: boolean; isVerified?: boolean };
  basicDetails: {
    fullName: string;
    email: string;
    mobileNumber: string;
    profilePhoto?: string;
  };
  teachingDetails: {
    subjects: string[];
    classes: string[];
  };
  locationAvailability: {
    city?: string;
  };
  verificationStatus: VerificationStatus;
  isActive: boolean;
  isBlocked: boolean;
  blockReason?: string;
  stats: { averageRating?: number };
  pricingRevenue: { hourlyRate?: number };
  createdAt: string;
  updatedAt?: string;
}

/** One row from `GET /api/admin/staff` (`buildStaffResponse`). */
export interface StaffMember {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  username: string | null;
  employeeId: string | null;
  role: UserRole;
  staffRole: string | null;
  department: string | null;
  designation: string | null;
  joiningDate: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  permissions: string[];
  permissionsCount: number;
  isActive: boolean;
  isVerified: boolean;
  isBlocked: boolean;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Platform stats & activity ──────────────────────────────────────────────

export interface PlatformStats {
  totalParents: number;
  totalTeachers: number;
  pendingTeachers: number;
  activeRequirements: number;
  totalApplications: number;
  totalDemoClasses: number;
}

export interface ActivityEntry {
  _id: string;
  action: string;
  entityType: string;
  entityId: string;
  adminId:
    | string
    | null
    | {
        _id: string;
        email?: string;
        role?: string;
        profile?: { firstName?: string; lastName?: string };
      };
  oldValue?: Record<string, any> | null;
  newValue?: Record<string, any> | null;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

// ── Course marketplace ─────────────────────────────────────────────────────

export type CourseLevel = 'beginner' | 'intermediate' | 'advanced';
export type CourseAccessType = 'free' | 'paid';
export type LessonVideoStatus = 'processing' | 'ready' | 'failed';

export interface LessonVideo {
  originalFileName: string;
  mimeType: string;
  size: number;
  sizeLabel: string;
  duration?: number;
  status: LessonVideoStatus;
  failureReason?: string;
  uploadedAt: string;
  hasThumbnail: boolean;
}

export interface AdminLesson {
  _id: string;
  title: string;
  description?: string;
  order: number;
  isPublished: boolean;
  isFreePreview: boolean;
  hasVideo: boolean;
  video: LessonVideo | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminCourse {
  _id: string;
  title: string;
  description: string;
  categoryId: string;
  level: CourseLevel;
  thumbnailUrl?: string;
  accessType: CourseAccessType;
  price: number;
  currency: string;
  isPublished: boolean;
  publishedAt?: string;
  isActive: boolean;
  enrollmentCount: number;
  lessonCount: number;
  publishedLessonCount: number;
  videoCount: number;
  totalDurationSeconds: number;
  createdAt?: string;
  updatedAt?: string;
  lessons?: AdminLesson[];
}

export interface VideoUploadLimits {
  maxSizeBytes: number;
  maxSizeLabel: string;
  allowedMimeTypes: string[];
  recommended: string;
}

export interface CourseListResult {
  courses: AdminCourse[];
  pagination: Pagination;
  summary: { total: number; published: number; draft: number };
  videoLimits: VideoUploadLimits;
}

export interface CourseInput {
  title: string;
  description: string;
  categoryId: string;
  level?: CourseLevel;
  accessType?: CourseAccessType;
  price?: number;
  thumbnailUrl?: string;
}

export interface LessonInput {
  title: string;
  description?: string;
  order?: number;
  isPublished?: boolean;
  isFreePreview?: boolean;
}

// ── Revenue / payments ─────────────────────────────────────────────────────

export type RevenueRange = 'today' | '7d' | '30d' | '90d' | 'year' | 'custom';

export interface RevenueFilters {
  range: RevenueRange;
  from?: string;
  to?: string;
}

export interface RevenueOverview {
  period: { startDate: string; endDate: string; range: string };
  revenue: { total: number; monthly: number; today: number; growth: number; previous: number };
  transactions: {
    total: number;
    previous: number;
    growth: number;
    successful: number;
    failed: number;
    refunded: number;
    pending: number;
  };
  amounts: { successAmount: number; failedAmount: number; refundedAmount: number };
}

export interface PaymentItem {
  paymentId: string;
  type: string;
  status: string;
  amount: number;
  totalAmount: number;
  gstAmount: number;
  paymentMethod: string;
  paymentDate: string | null;
  createdAt: string;
  invoiceNumber?: string;
  user: { profile?: { firstName?: string; lastName?: string }; email?: string } | null;
}

export interface PaymentMetrics {
  period: { startDate: string; endDate: string };
  summary: {
    total: number;
    completed: number;
    failed: number;
    refunded: number;
    pending: number;
    successRate: number;
    failureRate: number;
    totalRevenue: number;
    avgTxValue: number;
  };
  byType: Array<{ type: string; count: number; amount: number }>;
  byMethod: Array<{ method: string; count: number; amount: number }>;
  payments: PaymentItem[];
  pagination: Pagination & { hasMore: boolean };
}

export interface InvoiceItem {
  _id: string;
  invoiceNumber: string;
  invoiceDate: string;
  status: string;
  grandTotal: number;
  gstTotal: number;
  buyer: { name: string; email: string; phone: string };
  user: { profile?: { firstName?: string; lastName?: string }; email?: string } | null;
  createdAt: string;
}

export interface InvoiceMetrics {
  period: { startDate: string; endDate: string };
  summary: {
    total: number;
    issued: number;
    draft: number;
    cancelled: number;
    grandTotal: number;
    subtotal: number;
    gstTotal: number;
    promoDiscount: number;
  };
  invoices: InvoiceItem[];
  pagination: Pagination & { hasMore: boolean };
}

export interface RevenueCharts {
  period: { startDate: string; endDate: string };
  daily: Array<{ date: string; revenue: number; transactions: number }>;
  monthly: Array<{ month: string; revenue: number; transactions: number }>;
  byType: Array<{ type: string; revenue: number; count: number }>;
  subscriptionDistribution: Array<{ plan: string; count: number }>;
  creditTrend: Array<{ date: string; unlocks: number }>;
}

export interface SubscriptionMetrics {
  period: { startDate: string; endDate: string };
  plans: {
    free: number;
    starter: number;
    professional: number;
    premium: number;
    totalActive: number;
  };
  activity: {
    newSubscriptions: number;
    cancelledSubscriptions: number;
    renewals: number;
    upgrades: number;
    upgradeRate: number;
    churnRate: number;
  };
  revenue: { total: number; count: number; avg: number };
}

export interface CreditMetrics {
  period: { startDate: string; endDate: string };
  summary: {
    creditsSold: number;
    creditsConsumed: number;
    creditsRefunded: number;
    netCredits: number;
    topPack: string;
    avgCreditsPurchased: number;
  };
  byType: { granted: number; unlocks: number; refunds: number; bonuses: number; upgrades: number };
  packBreakdown: Array<{ pack: string; purchases: number; totalCredits: number }>;
  revenue: { total: number; count: number };
}

// ── Refunds ────────────────────────────────────────────────────────────────

export interface RefundRequestRow {
  _id: string;
  refundId?: string;
  amount?: number;
  reason?: string;
  status: string;
  createdAt: string;
  processedAt?: string;
  adminNotes?: string;
  rejectionReason?: string;
  paymentId?: { paymentId?: string; totalAmount?: number; status?: string } | string | null;
  userId?: { profile?: { firstName?: string; lastName?: string }; email?: string } | string | null;
}

// ── Subscriptions & credits ────────────────────────────────────────────────

export type PlanName = 'free' | 'starter' | 'professional' | 'premium';
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'pending' | 'suspended';

export interface SubscriptionRow {
  _id: string;
  subscriptionId: string;
  planName: PlanName;
  status: SubscriptionStatus;
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  credits: { creditsRemaining: number; creditsUsed: number; creditResetDate: string };
  usage: {
    applicationsUsed: number;
    leadUnlocksUsed: number;
    periodStart: string;
    periodEnd: string;
  };
  teacher: {
    teacherId: string;
    fullName: string;
    email: string;
    phone: string;
    verificationStatus: string;
    profilePhoto?: string;
  };
}

export interface CreditBalanceRow {
  _id: string;
  subscriptionId: string;
  planName: string;
  status: string;
  credits: { creditsRemaining: number; creditsUsed: number; creditResetDate: string };
  usage: { applicationsUsed: number; leadUnlocksUsed: number };
  teacher: {
    teacherId: string;
    fullName: string;
    email: string;
    phone: string;
    profilePhoto?: string;
    verificationStatus: string;
  };
}

export interface CreditTransactionRow {
  _id: string;
  transactionId: string;
  teacherId: string;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
  teacher?: { basicDetails?: { fullName?: string } };
}

// ── KYC ────────────────────────────────────────────────────────────────────

export interface KycDocument {
  _id?: string;
  documentType: string;
  status: string;
  fileUrl?: string;
  documentNumber?: string;
  rejectionReason?: string;
  uploadedAt?: string;
}

export interface KycQueueRecord {
  _id: string;
  kycId: string;
  status: string;
  documents: KycDocument[];
  submittedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  verificationNotes?: string;
  teacherId: {
    _id: string;
    basicDetails?: { fullName: string; email: string; mobileNumber: string; profilePhoto?: string };
    verificationStatus: string;
    userId?: { profile?: { firstName: string; lastName: string }; email?: string; phoneNumber?: string };
  };
  createdAt: string;
  updatedAt: string;
}

export interface KycQueueResult {
  records: KycQueueRecord[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  counts: {
    all: number;
    submitted: number;
    under_review: number;
    approved: number;
    rejected: number;
    reupload_required: number;
  };
}

// ── Promo codes ────────────────────────────────────────────────────────────

export type DiscountType = 'flat' | 'percent';
export type PromoApplicableTo =
  | 'unlock_lead'
  | 'unlock_tutor'
  | 'subscription'
  | 'credit_pack'
  | 'all';

export interface PromoCode {
  _id: string;
  code: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscountAmount?: number;
  applicableTo: PromoApplicableTo;
  applicablePlans?: string[];
  applicablePacks?: string[];
  minOrderAmount: number;
  usageLimit: number;
  usageCount: number;
  perUserLimit: number;
  validFrom: string;
  validTo: string;
  isActive: boolean;
  totalDiscountGiven: number;
  createdAt: string;
  updatedAt: string;
}

// ── Notification campaigns ─────────────────────────────────────────────────

export type CampaignType =
  | 'broadcast'
  | 'scheduled'
  | 'triggered'
  | 'promotional'
  | 'system'
  | 'transactional';

export type CampaignAudience =
  | 'all_users'
  | 'all_teachers'
  | 'all_parents'
  | 'verified_teachers'
  | 'premium_teachers'
  | 'free_teachers'
  | 'kyc_pending'
  | 'active_parents'
  | 'inactive_users'
  | 'custom_segment';

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled';

export interface CampaignDeliveryStats {
  totalTargeted: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  failed: number;
  openRate: number;
  ctr: number;
}

export interface Campaign {
  _id: string;
  campaignId: string;
  title: string;
  message: string;
  imageUrl?: string;
  deepLinkScreen?: string;
  campaignType: CampaignType;
  targetAudience: CampaignAudience;
  status: CampaignStatus;
  scheduledAt?: string;
  sentAt?: string;
  deliveryStats: CampaignDeliveryStats;
  createdBy: { _id: string; name?: string; email?: string } | string;
  cancelReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignsSummary {
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  totals: {
    totalSent: number;
    totalDelivered: number;
    totalOpened: number;
    totalFailed: number;
    overallOpenRate: number;
  };
  total: number;
}

// ── Support tickets ────────────────────────────────────────────────────────

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketCategory =
  | 'payment_issue'
  | 'refund_request'
  | 'tutor_issue'
  | 'teacher_issue'
  | 'technical_issue'
  | 'account_issue'
  | 'lead_unlock_issue'
  | 'profile_verification'
  | 'application_issue'
  | 'other';

export interface TicketMessage {
  _id: string;
  sender: 'user' | 'admin' | 'staff';
  senderId: string;
  senderName: string;
  message: string;
  createdAt: string;
}

export interface Ticket {
  _id: string;
  ticketId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  userRole: UserRole;
  category: TicketCategory;
  priority: TicketPriority;
  subject: string;
  description: string;
  status: TicketStatus;
  assignedTo?: string;
  assignedToName?: string;
  messages: TicketMessage[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  closedAt?: string;
}

export interface TicketListResult {
  tickets: Ticket[];
  counts: Record<TicketStatus, number>;
  pagination: Pagination;
}

export interface TicketStats {
  open: number;
  in_progress: number;
  resolved: number;
  closed: number;
  urgent: number;
  pending24h: number;
  recentResolved: number;
  total: number;
}

// ── Notifications ──────────────────────────────────────────────────────────

export type NotificationCategory = 'payment' | 'application' | 'demo' | 'lead' | 'admin' | 'system';

export interface AppNotification {
  _id: string;
  userId: string;
  type: string;
  category: NotificationCategory;
  title: string;
  body: string;
  data?: Record<string, any>;
  isRead: boolean;
  readAt?: string;
  entityId?: string;
  entityType?: string;
  createdAt: string;
}

export interface NotificationListResult {
  notifications: AppNotification[];
  unreadCount: number;
  pagination: Pagination;
}

// ── Analytics ──────────────────────────────────────────────────────────────

export interface OverviewAnalytics {
  totalParents?: number;
  totalTeachers?: number;
  verifiedTeachers?: number;
  pendingTeachers?: number;
  totalRequirements?: number;
  activeRequirements?: number;
  totalApplications?: number;
  totalDemoClasses?: number;
  completedDemos?: number;
  conversionRate?: number;
  [key: string]: any;
}

export interface DemandAnalytics {
  topSubjects?: Array<{ subject: string; count: number }>;
  topGrades?: Array<{ grade: string; count: number }>;
  topBoards?: Array<{ board: string; count: number }>;
  topCities?: Array<{ city: string; count: number }>;
  byType?: Array<{ type: string; count: number }>;
  monthlyTrend?: Array<{ year: number; month: number; count: number }>;
  [key: string]: any;
}

export interface SupplyAnalytics {
  byCity?: Array<{ city?: string; count: number }>;
  bySubject?: Array<{ subject?: string; count: number }>;
  byStatus?: Array<{ status?: string; count: number }>;
  byMode?: Array<{ mode?: string; count: number }>;
  supplyVsDemand?: Array<{ subject: string; demand: number; supply: number; gap: number }>;
  cityRates?: Array<{ city: string; avgHourlyRate: number; teacherCount: number }>;
  monthlyTrend?: Array<{ year: number; month: number; count: number }>;
  [key: string]: any;
}

// ── Settings ───────────────────────────────────────────────────────────────

export interface MailService {
  key: string;
  label: string;
  enabled: boolean;
}

/** `GET /api/admin/smtp-config` — the password is never returned, only a flag. */
export interface SmtpConfig {
  isActive: boolean;
  fromEmail: string;
  fromName: string;
  replyToEmail: string;
  host: string;
  port: number;
  encryption: 'none' | 'SSL/TLS' | 'STARTTLS';
  authRequired: boolean;
  username: string;
  hasPassword: boolean;
  services: MailService[];
  updatedAt: string | null;
}

/** `GET /api/admin/location-config` — likewise, the API key is never returned. */
export interface LocationConfig {
  isActive: boolean;
  hasApiKey: boolean;
  updatedAt: string | null;
}

/** `GET /api/admin/aws-config` — the secret access key is never returned, only a flag. */
export interface AwsS3ConfigData {
  isActive: boolean;
  region: string;
  bucket: string;
  accessKeyId: string;
  hasSecretKey: boolean;
  updatedAt: string | null;
}
