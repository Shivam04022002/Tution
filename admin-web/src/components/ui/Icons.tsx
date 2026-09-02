import type { SVGProps } from 'react';

/**
 * Inline stroke icons. Kept local rather than pulling an icon package — the set
 * is small and this keeps the bundle and the dependency list lean.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 16, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconDashboard = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </Icon>
);

export const IconUsers = (p: IconProps) => (
  <Icon {...p}>
    <path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" />
    <circle cx="9" cy="7" r="3.2" />
    <path d="M22 20v-1.5a4 4 0 0 0-3-3.87" />
    <path d="M16 3.6a4 4 0 0 1 0 7.1" />
  </Icon>
);

export const IconUser = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </Icon>
);

export const IconBook = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 19.5V5a2 2 0 0 1 2-2h13v16H6.5A2.5 2.5 0 0 0 4 21.5z" />
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H19" />
  </Icon>
);

export const IconVideo = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2" y="5" width="14" height="14" rx="2.5" />
    <path d="m16 10 6-3.5v11L16 14z" />
  </Icon>
);

export const IconWallet = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a2 2 0 0 1 2 2v1" />
    <rect x="3" y="7.5" width="18" height="12.5" rx="2.5" />
    <circle cx="16.5" cy="14" r="1.2" />
  </Icon>
);

export const IconChart = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 3v17.5h18" />
    <path d="M7 15v-4" />
    <path d="M12 15V7" />
    <path d="M17 15v-6" />
  </Icon>
);

export const IconShield = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 2.5 4.5 5.6v6.1c0 4.7 3.1 8.4 7.5 9.8 4.4-1.4 7.5-5.1 7.5-9.8V5.6z" />
    <path d="m9.2 12 2 2 3.6-4" />
  </Icon>
);

export const IconBell = (p: IconProps) => (
  <Icon {...p}>
    <path d="M18 8.5a6 6 0 1 0-12 0c0 6-2 7.5-2 7.5h16s-2-1.5-2-7.5" />
    <path d="M13.7 20a2 2 0 0 1-3.4 0" />
  </Icon>
);

export const IconTicket = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 8.5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1.7a2.3 2.3 0 0 0 0 4.6v1.7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1.7a2.3 2.3 0 0 0 0-4.6z" />
    <path d="M14 7v10" strokeDasharray="2 2.4" />
  </Icon>
);

export const IconSettings = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 14.5a1.7 1.7 0 0 0 .35 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.35 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.14a1.7 1.7 0 0 0-1.1-1.56 1.7 1.7 0 0 0-1.87.35l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .35-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.14a1.7 1.7 0 0 0 1.56-1.1 1.7 1.7 0 0 0-.35-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.35H9a1.7 1.7 0 0 0 1-1.56V3a2 2 0 1 1 4 0v.14a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.35l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.35 1.87V9a1.7 1.7 0 0 0 1.56 1H21a2 2 0 1 1 0 4h-.14a1.7 1.7 0 0 0-1.46 1.5z" />
  </Icon>
);

export const IconSearch = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  </Icon>
);

export const IconPlus = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const IconClose = (p: IconProps) => (
  <Icon {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Icon>
);

export const IconChevronLeft = (p: IconProps) => (
  <Icon {...p}>
    <path d="m15 18-6-6 6-6" />
  </Icon>
);

export const IconChevronRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="m9 18 6-6-6-6" />
  </Icon>
);

export const IconChevronDown = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);

export const IconArrowUp = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Icon>
);

export const IconArrowDown = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </Icon>
);

export const IconEdit = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
  </Icon>
);

export const IconTrash = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 6h18M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6" />
    <path d="M6 6v13.5A1.5 1.5 0 0 0 7.5 21h9a1.5 1.5 0 0 0 1.5-1.5V6" />
    <path d="M10 11v6M14 11v6" />
  </Icon>
);

export const IconEye = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

export const IconUpload = (p: IconProps) => (
  <Icon {...p}>
    <path d="M21 15v3.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V15" />
    <path d="M7.5 8.5 12 4l4.5 4.5" />
    <path d="M12 4v12" />
  </Icon>
);

export const IconRefresh = (p: IconProps) => (
  <Icon {...p}>
    <path d="M21 12a9 9 0 1 1-2.6-6.4" />
    <path d="M21 4v5h-5" />
  </Icon>
);

export const IconLogout = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </Icon>
);

export const IconAlert = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v4.5M12 16h.01" />
  </Icon>
);

export const IconCheck = (p: IconProps) => (
  <Icon {...p}>
    <path d="m4 12.5 5 5L20 6.5" />
  </Icon>
);

export const IconInbox = (p: IconProps) => (
  <Icon {...p}>
    <path d="M21 13h-5l-1.5 2.5h-5L8 13H3" />
    <path d="M6.2 4.5h11.6a2 2 0 0 1 1.8 1.1L22 13v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-5l2.4-7.4a2 2 0 0 1 1.8-1.1" />
  </Icon>
);

export const IconMenu = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
);

export const IconLayers = (p: IconProps) => (
  <Icon {...p}>
    <path d="m12 3 9 5-9 5-9-5z" />
    <path d="m3 13 9 5 9-5" />
  </Icon>
);

export const IconGrip = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9" cy="6" r="1.3" fill="currentColor" />
    <circle cx="15" cy="6" r="1.3" fill="currentColor" />
    <circle cx="9" cy="12" r="1.3" fill="currentColor" />
    <circle cx="15" cy="12" r="1.3" fill="currentColor" />
    <circle cx="9" cy="18" r="1.3" fill="currentColor" />
    <circle cx="15" cy="18" r="1.3" fill="currentColor" />
  </Icon>
);

export const IconMegaphone = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 11v2a2 2 0 0 0 2 2h1l2 5h2.5l-1.5-5h1L18 19V5l-7.5 4H5a2 2 0 0 0-2 2" />
    <path d="M21 9.5v5" />
  </Icon>
);

export const IconTag = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20.5 12.5 12 21l-9-9V3h9z" />
    <circle cx="7.5" cy="7.5" r="1.4" />
  </Icon>
);

export const IconDoc = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </Icon>
);
