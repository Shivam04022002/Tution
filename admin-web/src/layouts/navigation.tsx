import type { ReactNode } from 'react';
import { PERMISSIONS, type Permission } from '../auth/permissions';
import {
  IconBook,
  IconChart,
  IconDashboard,
  IconLayers,
  IconMegaphone,
  IconSettings,
  IconShield,
  IconTag,
  IconTicket,
  IconUser,
  IconUsers,
  IconVideo,
  IconWallet,
} from '../components/ui/Icons';

export interface NavEntry {
  to: string;
  label: string;
  icon: ReactNode;
  permission: Permission;
  /** Matches nested routes as well (e.g. `/marketplace/courses/:id`). */
  match?: string;
}

export interface NavGroup {
  label: string;
  entries: NavEntry[];
}

/**
 * Sidebar structure. Section names reuse the platform's existing vocabulary —
 * "Tutors" for teachers, "Marketplace" for the course catalogue, "Credits" and
 * "Subscriptions" as the mobile admin app names them.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    entries: [
      {
        to: '/dashboard',
        label: 'Dashboard',
        icon: <IconDashboard size={17} />,
        permission: PERMISSIONS.dashboard,
      },
      {
        to: '/reports',
        label: 'Reports',
        icon: <IconChart size={17} />,
        permission: PERMISSIONS.reports,
      },
    ],
  },
  {
    label: 'People',
    entries: [
      {
        to: '/users/parents',
        label: 'Parents',
        icon: <IconUsers size={17} />,
        permission: PERMISSIONS.users,
        match: '/users/parents',
      },
      {
        to: '/users/tutors',
        label: 'Tutors',
        icon: <IconUser size={17} />,
        permission: PERMISSIONS.tutors,
        match: '/users/tutors',
      },
      {
        to: '/users/accounts',
        label: 'All accounts',
        icon: <IconLayers size={17} />,
        permission: PERMISSIONS.users,
        match: '/users/accounts',
      },
      {
        to: '/users/admins',
        label: 'Admins & staff',
        icon: <IconShield size={17} />,
        permission: PERMISSIONS.settings,
        match: '/users/admins',
      },
      {
        to: '/verification',
        label: 'KYC queue',
        icon: <IconShield size={17} />,
        permission: PERMISSIONS.verification,
      },
    ],
  },
  {
    label: 'Marketplace',
    entries: [
      {
        to: '/marketplace/courses',
        label: 'Courses',
        icon: <IconBook size={17} />,
        permission: PERMISSIONS.marketplace,
        match: '/marketplace/courses',
      },
      {
        to: '/marketplace/categories',
        label: 'Categories',
        icon: <IconTag size={17} />,
        permission: PERMISSIONS.marketplace,
      },
      {
        to: '/marketplace/videos',
        label: 'Video library',
        icon: <IconVideo size={17} />,
        permission: PERMISSIONS.marketplace,
      },
      {
        to: '/marketplace/enrollments',
        label: 'Enrollments',
        icon: <IconLayers size={17} />,
        permission: PERMISSIONS.marketplace,
      },
    ],
  },
  {
    label: 'Finance',
    entries: [
      {
        to: '/finance/revenue',
        label: 'Revenue',
        icon: <IconChart size={17} />,
        permission: PERMISSIONS.finance,
      },
      {
        to: '/finance/payments',
        label: 'Payments',
        icon: <IconWallet size={17} />,
        permission: PERMISSIONS.finance,
      },
      {
        to: '/finance/subscriptions',
        label: 'Subscriptions',
        icon: <IconLayers size={17} />,
        permission: PERMISSIONS.finance,
      },
      {
        to: '/finance/credits',
        label: 'Credits',
        icon: <IconWallet size={17} />,
        permission: PERMISSIONS.finance,
      },
      {
        to: '/finance/refunds',
        label: 'Refunds',
        icon: <IconWallet size={17} />,
        permission: PERMISSIONS.finance,
      },
      {
        to: '/finance/promos',
        label: 'Promo codes',
        icon: <IconTag size={17} />,
        permission: PERMISSIONS.finance,
      },
    ],
  },
  {
    label: 'Engagement',
    entries: [
      {
        to: '/engagement/campaigns',
        label: 'Campaigns',
        icon: <IconMegaphone size={17} />,
        permission: PERMISSIONS.engagement,
        match: '/engagement/campaigns',
      },
      {
        to: '/support/tickets',
        label: 'Support tickets',
        icon: <IconTicket size={17} />,
        permission: PERMISSIONS.support,
        match: '/support/tickets',
      },
    ],
  },
  {
    label: 'System',
    entries: [
      {
        to: '/settings',
        label: 'Settings',
        icon: <IconSettings size={17} />,
        permission: PERMISSIONS.settings,
        match: '/settings',
      },
    ],
  },
];

/** Human page titles used for breadcrumbs and the document title. */
export const ROUTE_TITLES: Array<[RegExp, string[]]> = [
  [/^\/dashboard$/, ['Dashboard']],
  [/^\/reports$/, ['Reports']],
  [/^\/users\/parents\/[^/]+$/, ['People', 'Parents', 'Parent profile']],
  [/^\/users\/parents$/, ['People', 'Parents']],
  [/^\/users\/tutors\/[^/]+$/, ['People', 'Tutors', 'Tutor profile']],
  [/^\/users\/tutors$/, ['People', 'Tutors']],
  [/^\/users\/accounts$/, ['People', 'All accounts']],
  [/^\/users\/admins$/, ['People', 'Admins & staff']],
  [/^\/verification\/[^/]+$/, ['People', 'KYC queue', 'Verification']],
  [/^\/verification$/, ['People', 'KYC queue']],
  [/^\/marketplace\/courses\/new$/, ['Marketplace', 'Courses', 'New course']],
  [/^\/marketplace\/courses\/[^/]+\/content$/, ['Marketplace', 'Courses', 'Content']],
  [/^\/marketplace\/courses\/[^/]+\/edit$/, ['Marketplace', 'Courses', 'Edit']],
  [/^\/marketplace\/courses\/[^/]+$/, ['Marketplace', 'Courses', 'Course']],
  [/^\/marketplace\/courses$/, ['Marketplace', 'Courses']],
  [/^\/marketplace\/categories$/, ['Marketplace', 'Categories']],
  [/^\/marketplace\/videos$/, ['Marketplace', 'Video library']],
  [/^\/marketplace\/enrollments$/, ['Marketplace', 'Enrollments']],
  [/^\/finance\/revenue$/, ['Finance', 'Revenue']],
  [/^\/finance\/payments$/, ['Finance', 'Payments']],
  [/^\/finance\/subscriptions$/, ['Finance', 'Subscriptions']],
  [/^\/finance\/credits$/, ['Finance', 'Credits']],
  [/^\/finance\/refunds$/, ['Finance', 'Refunds']],
  [/^\/finance\/promos$/, ['Finance', 'Promo codes']],
  [/^\/engagement\/campaigns\/[^/]+$/, ['Engagement', 'Campaigns', 'Campaign']],
  [/^\/engagement\/campaigns$/, ['Engagement', 'Campaigns']],
  [/^\/support\/tickets\/[^/]+$/, ['Support', 'Tickets', 'Ticket']],
  [/^\/support\/tickets$/, ['Support', 'Tickets']],
  [/^\/settings\/activity$/, ['Settings', 'Activity log']],
  [/^\/settings\/import$/, ['Settings', 'Data import']],
  [/^\/settings\/email$/, ['Settings', 'Email (SMTP)']],
  [/^\/settings\/location$/, ['Settings', 'Location services']],
  [/^\/settings$/, ['Settings']],
];

export function breadcrumbsFor(pathname: string): string[] {
  for (const [pattern, crumbs] of ROUTE_TITLES) {
    if (pattern.test(pathname)) return crumbs;
  }
  return ['Admin'];
}
