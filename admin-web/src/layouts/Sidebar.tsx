import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ENVIRONMENT } from '../config/env';
import { IconChevronLeft, IconChevronRight } from '../components/ui/Icons';
import { NAV_GROUPS } from './navigation';

export function Sidebar({
  collapsed,
  mobileOpen,
  onToggleCollapsed,
  onNavigate,
}: {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapsed: () => void;
  onNavigate: () => void;
}) {
  const { can } = useAuth();
  const { pathname } = useLocation();

  const classes = ['sidebar', collapsed ? 'collapsed' : '', mobileOpen ? 'mobile-open' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <aside className={classes}>
      <div className="brand">
        <span className="brand-mark">HT</span>
        <span className="brand-text">
          <span className="brand-name">Home Tuition</span>
          <span className="brand-sub">Admin console</span>
        </span>
      </div>

      <nav className="nav" aria-label="Main">
        {NAV_GROUPS.map((group) => {
          const visible = group.entries.filter((entry) => can(entry.permission));
          if (visible.length === 0) return null;

          return (
            <div key={group.label}>
              <p className="nav-group-label">{group.label}</p>
              {visible.map((entry) => {
                // `match` lets a parent entry stay highlighted on detail routes.
                const active = entry.match
                  ? pathname === entry.match || pathname.startsWith(`${entry.match}/`)
                  : pathname === entry.to || pathname.startsWith(`${entry.to}/`);

                return (
                  <NavLink
                    key={entry.to}
                    to={entry.to}
                    onClick={onNavigate}
                    className={`nav-item${active ? ' active' : ''}`}
                    title={collapsed ? entry.label : undefined}
                  >
                    {entry.icon}
                    <span className="nav-label">{entry.label}</span>
                  </NavLink>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="side-foot">
        <span className="side-foot-text">
          {ENVIRONMENT === 'production' ? 'Production' : ENVIRONMENT}
        </span>
        <button
          type="button"
          className="collapse-btn"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <IconChevronRight size={14} /> : <IconChevronLeft size={14} />}
        </button>
      </div>
    </aside>
  );
}
