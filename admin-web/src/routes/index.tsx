import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAdmin, RequirePermission } from '../auth/ProtectedRoute';
import { PERMISSIONS } from '../auth/permissions';
import { AdminLayout } from '../layouts/AdminLayout';
import { LoginPage } from '../pages/LoginPage';
import { NotFoundPage } from '../pages/NotFoundPage';

/**
 * Routes are lazy-loaded per section so the login screen and shell stay small;
 * `<Suspense>` in `AdminLayout` covers the transition.
 */
const DashboardPage = lazy(() =>
  import('../pages/DashboardPage').then((m) => ({ default: m.DashboardPage }))
);
const ReportsPage = lazy(() =>
  import('../pages/ReportsPage').then((m) => ({ default: m.ReportsPage }))
);

const ParentsPage = lazy(() =>
  import('../pages/users/ParentsPage').then((m) => ({ default: m.ParentsPage }))
);
const ParentDetailPage = lazy(() =>
  import('../pages/users/ParentDetailPage').then((m) => ({ default: m.ParentDetailPage }))
);
const TutorsPage = lazy(() =>
  import('../pages/users/TutorsPage').then((m) => ({ default: m.TutorsPage }))
);
const TutorDetailPage = lazy(() =>
  import('../pages/users/TutorDetailPage').then((m) => ({ default: m.TutorDetailPage }))
);
const AccountsPage = lazy(() =>
  import('../pages/users/AccountsPage').then((m) => ({ default: m.AccountsPage }))
);
const AdminsPage = lazy(() =>
  import('../pages/users/AdminsPage').then((m) => ({ default: m.AdminsPage }))
);

const KycQueuePage = lazy(() =>
  import('../pages/verification/KycQueuePage').then((m) => ({ default: m.KycQueuePage }))
);

const CoursesPage = lazy(() =>
  import('../pages/marketplace/CoursesPage').then((m) => ({ default: m.CoursesPage }))
);
const CourseFormPage = lazy(() =>
  import('../pages/marketplace/CourseFormPage').then((m) => ({ default: m.CourseFormPage }))
);
const CourseDetailPage = lazy(() =>
  import('../pages/marketplace/CourseDetailPage').then((m) => ({ default: m.CourseDetailPage }))
);
const CourseContentPage = lazy(() =>
  import('../pages/marketplace/CourseContentPage').then((m) => ({ default: m.CourseContentPage }))
);
const CategoriesPage = lazy(() =>
  import('../pages/marketplace/CategoriesPage').then((m) => ({ default: m.CategoriesPage }))
);
const VideoLibraryPage = lazy(() =>
  import('../pages/marketplace/VideoLibraryPage').then((m) => ({ default: m.VideoLibraryPage }))
);
const EnrollmentsPage = lazy(() =>
  import('../pages/marketplace/EnrollmentsPage').then((m) => ({ default: m.EnrollmentsPage }))
);

const RevenuePage = lazy(() =>
  import('../pages/finance/RevenuePage').then((m) => ({ default: m.RevenuePage }))
);
const PaymentsPage = lazy(() =>
  import('../pages/finance/PaymentsPage').then((m) => ({ default: m.PaymentsPage }))
);
const SubscriptionsPage = lazy(() =>
  import('../pages/finance/SubscriptionsPage').then((m) => ({ default: m.SubscriptionsPage }))
);
const CreditsPage = lazy(() =>
  import('../pages/finance/CreditsPage').then((m) => ({ default: m.CreditsPage }))
);
const RefundsPage = lazy(() =>
  import('../pages/finance/RefundsPage').then((m) => ({ default: m.RefundsPage }))
);
const PromosPage = lazy(() =>
  import('../pages/finance/PromosPage').then((m) => ({ default: m.PromosPage }))
);

const CampaignsPage = lazy(() =>
  import('../pages/engagement/CampaignsPage').then((m) => ({ default: m.CampaignsPage }))
);
const TicketsPage = lazy(() =>
  import('../pages/support/TicketsPage').then((m) => ({ default: m.TicketsPage }))
);
const TicketDetailPage = lazy(() =>
  import('../pages/support/TicketDetailPage').then((m) => ({ default: m.TicketDetailPage }))
);

const SettingsLayout = lazy(() =>
  import('../pages/settings/SettingsLayout').then((m) => ({ default: m.SettingsLayout }))
);
const ProfileSettings = lazy(() =>
  import('../pages/settings/ProfileSettings').then((m) => ({ default: m.ProfileSettings }))
);
const EmailSettings = lazy(() =>
  import('../pages/settings/EmailSettings').then((m) => ({ default: m.EmailSettings }))
);
const LocationSettings = lazy(() =>
  import('../pages/settings/LocationSettings').then((m) => ({ default: m.LocationSettings }))
);
const AwsSettings = lazy(() =>
  import('../pages/settings/AwsSettings').then((m) => ({ default: m.AwsSettings }))
);
const ActivityLogPage = lazy(() =>
  import('../pages/settings/ActivityLogPage').then((m) => ({ default: m.ActivityLogPage }))
);
const DataImportPage = lazy(() =>
  import('../pages/settings/DataImportPage').then((m) => ({ default: m.DataImportPage }))
);

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAdmin />}>
        <Route element={<AdminLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />

          <Route element={<RequirePermission permission={PERMISSIONS.dashboard} />}>
            <Route path="/dashboard" element={<DashboardPage />} />
          </Route>

          <Route element={<RequirePermission permission={PERMISSIONS.reports} />}>
            <Route path="/reports" element={<ReportsPage />} />
          </Route>

          {/* ── People ──────────────────────────────────────────────────── */}
          <Route path="/users" element={<Navigate to="/users/parents" replace />} />

          <Route element={<RequirePermission permission={PERMISSIONS.users} />}>
            <Route path="/users/parents" element={<ParentsPage />} />
            <Route path="/users/parents/:id" element={<ParentDetailPage />} />
            <Route path="/users/accounts" element={<AccountsPage />} />
          </Route>

          <Route element={<RequirePermission permission={PERMISSIONS.tutors} />}>
            <Route path="/users/tutors" element={<TutorsPage />} />
            <Route path="/users/tutors/:id" element={<TutorDetailPage />} />
          </Route>

          <Route element={<RequirePermission permission={PERMISSIONS.settings} />}>
            <Route path="/users/admins" element={<AdminsPage />} />
          </Route>

          <Route element={<RequirePermission permission={PERMISSIONS.verification} />}>
            <Route path="/verification" element={<KycQueuePage />} />
          </Route>

          {/* ── Marketplace ─────────────────────────────────────────────── */}
          <Route path="/marketplace" element={<Navigate to="/marketplace/courses" replace />} />

          <Route element={<RequirePermission permission={PERMISSIONS.marketplace} />}>
            <Route path="/marketplace/courses" element={<CoursesPage />} />
            <Route path="/marketplace/courses/new" element={<CourseFormPage />} />
            <Route path="/marketplace/courses/:id" element={<CourseDetailPage />} />
            <Route path="/marketplace/courses/:id/edit" element={<CourseFormPage />} />
            <Route path="/marketplace/courses/:id/content" element={<CourseContentPage />} />
            <Route path="/marketplace/categories" element={<CategoriesPage />} />
            <Route path="/marketplace/videos" element={<VideoLibraryPage />} />
            <Route path="/marketplace/enrollments" element={<EnrollmentsPage />} />
          </Route>

          {/* ── Finance ─────────────────────────────────────────────────── */}
          <Route path="/finance" element={<Navigate to="/finance/revenue" replace />} />

          <Route element={<RequirePermission permission={PERMISSIONS.finance} />}>
            <Route path="/finance/revenue" element={<RevenuePage />} />
            <Route path="/finance/payments" element={<PaymentsPage />} />
            <Route path="/finance/subscriptions" element={<SubscriptionsPage />} />
            <Route path="/finance/credits" element={<CreditsPage />} />
            <Route path="/finance/refunds" element={<RefundsPage />} />
            <Route path="/finance/promos" element={<PromosPage />} />
          </Route>

          {/* ── Engagement & support ────────────────────────────────────── */}
          <Route element={<RequirePermission permission={PERMISSIONS.engagement} />}>
            <Route path="/engagement/campaigns" element={<CampaignsPage />} />
          </Route>

          <Route element={<RequirePermission permission={PERMISSIONS.support} />}>
            <Route path="/support/tickets" element={<TicketsPage />} />
            <Route path="/support/tickets/:id" element={<TicketDetailPage />} />
          </Route>

          {/* ── Settings ────────────────────────────────────────────────── */}
          <Route element={<RequirePermission permission={PERMISSIONS.settings} />}>
            <Route path="/settings" element={<SettingsLayout />}>
              <Route index element={<ProfileSettings />} />
              <Route path="email" element={<EmailSettings />} />
              <Route path="location" element={<LocationSettings />} />
              <Route path="aws" element={<AwsSettings />} />
              <Route path="activity" element={<ActivityLogPage />} />
              <Route path="import" element={<DataImportPage />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
