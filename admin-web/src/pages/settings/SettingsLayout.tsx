import { NavLink, Outlet } from 'react-router-dom';
import { PageHeader } from '../../components/common/ListToolbar';

const SECTIONS = [
  { to: '/settings', label: 'Profile', end: true },
  { to: '/settings/email', label: 'Email (SMTP)', end: false },
  { to: '/settings/location', label: 'Location services', end: false },
  { to: '/settings/aws', label: 'AWS / Storage', end: false },
  { to: '/settings/activity', label: 'Activity log', end: false },
  { to: '/settings/import', label: 'Data import', end: false },
];

export function SettingsLayout() {
  return (
    <div className="page">
      <PageHeader
        title="Settings"
        subtitle="Your administrator profile and the platform configuration this backend exposes."
      />

      <div className="tabs mb-4">
        {SECTIONS.map((section) => (
          <NavLink
            key={section.to}
            to={section.to}
            end={section.end}
            className={({ isActive }) => `tab${isActive ? ' active' : ''}`}
          >
            {section.label}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  );
}
