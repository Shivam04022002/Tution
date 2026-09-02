import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import type { Permission } from './permissions';
import { ErrorState, FullPageLoader } from '../components/common/States';

/** Gate for the whole console: an authenticated user whose role is `admin`. */
export function RequireAdmin() {
  const { user, token, restoring } = useAuth();
  const location = useLocation();

  if (restoring) return <FullPageLoader label="Restoring your session…" />;

  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  if (user.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

/**
 * Per-section gate. Purely a UX affordance — the matching backend route enforces
 * the real check, so a bypass here still hits a 403 from the server.
 */
export function RequirePermission({ permission }: { permission: Permission }) {
  const { can } = useAuth();

  if (!can(permission)) {
    return (
      <div className="page">
        <ErrorState
          title="You do not have access to this section"
          message="Your administrator account is not configured for this area. Contact a super admin if you believe this is a mistake."
        />
      </div>
    );
  }

  return <Outlet />;
}
