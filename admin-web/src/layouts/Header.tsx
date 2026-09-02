import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import * as notificationsApi from '../api/notifications';
import { Avatar } from '../components/ui/Primitives';
import { IconBell, IconChevronDown, IconLogout, IconMenu, IconSettings } from '../components/ui/Icons';
import { useDismissable } from '../hooks';
import { fullName } from '../utils/format';

export function Header({
  crumbs,
  onOpenSidebar,
  onOpenNotifications,
}: {
  crumbs: string[];
  onOpenSidebar: () => void;
  onOpenNotifications: () => void;
}) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useDismissable<HTMLDivElement>(() => setMenuOpen(false), menuOpen);

  // Polls the same unread counter the mobile bell uses. One minute is frequent
  // enough for an admin console without hammering the API.
  const unread = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: notificationsApi.getUnreadCount,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const unreadCount = unread.data?.unreadCount ?? 0;
  const name = fullName(user?.profile);

  return (
    <header className="header">
      <button
        type="button"
        className="icon-btn menu-toggle"
        onClick={onOpenSidebar}
        aria-label="Open navigation"
      >
        <IconMenu size={18} />
      </button>

      <nav className="crumbs" aria-label="Breadcrumb">
        {crumbs.map((crumb, index) => (
          <span key={`${crumb}-${index}`} className="row gap-1">
            {index > 0 && <span className="sep">/</span>}
            <span className={index === crumbs.length - 1 ? 'current' : undefined}>{crumb}</span>
          </span>
        ))}
      </nav>

      <div className="header-actions">
        <button
          type="button"
          className="icon-btn"
          onClick={onOpenNotifications}
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        >
          <IconBell size={17} />
          {unreadCount > 0 && <span className="pip">{unreadCount > 99 ? '99+' : unreadCount}</span>}
        </button>

        <div className="menu-anchor" ref={menuRef}>
          <button
            type="button"
            className="userbtn"
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <Avatar name={name} src={user?.profile?.profileImage} />
            <span className="userbtn-name truncate">{name}</span>
            <IconChevronDown size={13} />
          </button>

          {menuOpen && (
            <div className="menu" role="menu">
              <div className="menu-head">
                <p className="strong text-sm truncate">{name}</p>
                <p className="muted text-xs truncate">{user?.email}</p>
                <p className="dim text-xs" style={{ marginTop: 2 }}>
                  Role: {user?.role}
                  {user?.staffRole ? ` · ${user.staffRole}` : ''}
                </p>
              </div>

              <Link
                to="/settings"
                role="menuitem"
                className="menu-item"
                onClick={() => setMenuOpen(false)}
              >
                <IconSettings size={15} />
                Settings & profile
              </Link>

              <button
                type="button"
                role="menuitem"
                className="menu-item danger"
                onClick={() => {
                  setMenuOpen(false);
                  signOut();
                  navigate('/login', { replace: true });
                }}
              >
                <IconLogout size={15} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
