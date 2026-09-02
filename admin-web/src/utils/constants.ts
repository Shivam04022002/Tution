/**
 * Values copied from the existing app so the console speaks the same language.
 * Course categories in particular are a hard-coded constant in the mobile app
 * (`tuition-mobile/src/constants/courseCategories.ts`) — there is no category
 * API — so the same eight ids are mirrored here. Changing this list without
 * changing the mobile constant would desynchronise `categoryId` values.
 */

export interface CourseCategory {
  id: string;
  name: string;
  emoji: string;
}

export const COURSE_CATEGORIES: CourseCategory[] = [
  { id: 'math', name: 'Mathematics', emoji: '📐' },
  { id: 'science', name: 'Science', emoji: '🔬' },
  { id: 'english', name: 'English', emoji: '📖' },
  { id: 'coding', name: 'Coding', emoji: '💻' },
  { id: 'olympiad', name: 'Olympiad Prep', emoji: '🏆' },
  { id: 'competitive', name: 'Competitive Exams', emoji: '🎯' },
  { id: 'spoken', name: 'Spoken English', emoji: '🎤' },
  { id: 'personality', name: 'Personality Dev.', emoji: '🌟' },
];

export const categoryName = (id: string) =>
  COURSE_CATEGORIES.find((category) => category.id === id)?.name ?? id;

export const categoryEmoji = (id: string) =>
  COURSE_CATEGORIES.find((category) => category.id === id)?.emoji ?? '🎓';

export const COURSE_LEVELS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

export const SUBSCRIPTION_PLANS = ['free', 'starter', 'professional', 'premium'] as const;

export const TICKET_CATEGORY_LABELS: Record<string, string> = {
  payment_issue: 'Payment Issue',
  refund_request: 'Refund Request',
  tutor_issue: 'Tutor Issue',
  teacher_issue: 'Teacher Issue',
  technical_issue: 'Technical Issue',
  account_issue: 'Account Issue',
  lead_unlock_issue: 'Lead Unlock Issue',
  profile_verification: 'Profile Verification',
  application_issue: 'Application Issue',
  other: 'Other',
};

export const CAMPAIGN_AUDIENCES = [
  { value: 'all_users', label: 'All users' },
  { value: 'all_teachers', label: 'All tutors' },
  { value: 'all_parents', label: 'All parents' },
  { value: 'verified_teachers', label: 'Verified tutors' },
  { value: 'premium_teachers', label: 'Premium tutors' },
  { value: 'free_teachers', label: 'Free-plan tutors' },
  { value: 'kyc_pending', label: 'KYC pending' },
  { value: 'active_parents', label: 'Active parents' },
  { value: 'inactive_users', label: 'Inactive users' },
];

export const CAMPAIGN_TYPES = [
  { value: 'broadcast', label: 'Broadcast' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'promotional', label: 'Promotional' },
  { value: 'system', label: 'System' },
  { value: 'transactional', label: 'Transactional' },
];

/** Chart palette derived from the brand ramp; consistent across every report. */
export const CHART_COLORS = [
  '#2D0A7D',
  '#5B21B6',
  '#7C3AED',
  '#EC4899',
  '#F59E0B',
  '#10B981',
  '#3B82F6',
  '#94A3B8',
];

export const REVENUE_RANGES = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'year', label: 'This year' },
];
