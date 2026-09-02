import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { NotificationDrawer } from './NotificationDrawer';
import { breadcrumbsFor } from './navigation';
import { FullPageLoader } from '../components/common/States';
import { usePersistentFlag } from '../hooks';

export function AdminLayout() {
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = usePersistentFlag('tuition.admin.sidebarCollapsed', false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const crumbs = breadcrumbsFor(pathname);

  useEffect(() => {
    document.title = `${crumbs[crumbs.length - 1]} · Home Tuition Admin`;
  }, [crumbs]);

  // A route change closes the mobile drawer and returns focus to the top.
  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="shell">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggleCollapsed={() => setCollapsed(!collapsed)}
        onNavigate={() => setMobileOpen(false)}
      />

      {mobileOpen && <div className="sidebar-scrim" onClick={() => setMobileOpen(false)} />}

      <div className="main">
        <Header
          crumbs={crumbs}
          onOpenSidebar={() => setMobileOpen(true)}
          onOpenNotifications={() => setNotificationsOpen(true)}
        />

        <main className="content">
          <Suspense fallback={<FullPageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      <NotificationDrawer open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
    </div>
  );
}
