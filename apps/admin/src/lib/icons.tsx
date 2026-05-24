import type { ReactElement, ReactNode, SVGProps } from 'react';

/**
 * Single stroke-based icon set (20×20 grid) used across the admin shell and
 * pages. Keeping every icon in one registry lets navigation config reference
 * an icon by name without importing component files everywhere.
 */

export type IconName =
  | 'home'
  | 'activity'
  | 'alert'
  | 'building'
  | 'inbox'
  | 'store'
  | 'chart'
  | 'menu'
  | 'megaphone'
  | 'bag'
  | 'truck'
  | 'clock'
  | 'timeline'
  | 'card'
  | 'payout'
  | 'percent'
  | 'refund'
  | 'report'
  | 'users'
  | 'shield'
  | 'flag'
  | 'plug'
  | 'webhook'
  | 'logs'
  | 'sparkles'
  | 'bolt'
  | 'lightbulb'
  | 'terminal'
  | 'checklist'
  | 'heart'
  | 'bell'
  | 'gift'
  | 'ticket'
  | 'globe'
  | 'map'
  | 'wallet'
  | 'layers'
  | 'settings'
  | 'search'
  | 'command'
  | 'chevronDown'
  | 'chevronRight'
  | 'chevronLeft'
  | 'sidebar'
  | 'close'
  | 'plus'
  | 'signout'
  | 'check'
  | 'external'
  | 'filter'
  | 'download'
  | 'dots'
  | 'arrowUp'
  | 'arrowDown'
  | 'sun';

type IconProps = SVGProps<SVGSVGElement>;

function Svg({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={18}
      height={18}
      {...props}
    >
      {children}
    </svg>
  );
}

export const Icon: Record<IconName, (p: IconProps) => ReactElement> = {
  home: (p) => (
    <Svg {...p}>
      <path d="M3 9.5 10 4l7 5.5V16a1 1 0 0 1-1 1h-3v-5H8v5H5a1 1 0 0 1-1-1V9.5Z" />
    </Svg>
  ),
  activity: (p) => (
    <Svg {...p}>
      <path d="M3 10.5h3l2-5 4 10 2-5h3" />
    </Svg>
  ),
  alert: (p) => (
    <Svg {...p}>
      <path d="M10 3.5 17 16H3l7-12.5Z" />
      <path d="M10 8.5v3.5M10 14.2v.2" />
    </Svg>
  ),
  building: (p) => (
    <Svg {...p}>
      <path d="M5 17V4a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v13" />
      <path d="M12 9h2.5a1 1 0 0 1 1 1v7" />
      <path d="M3.5 17h13M7.5 6h2M7.5 9h2M7.5 12h2" />
    </Svg>
  ),
  inbox: (p) => (
    <Svg {...p}>
      <path d="M3 12.5V5a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v7.5" />
      <path d="M3 12.5h4.5a2 2 0 0 0 4 0H17V15a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2.5Z" />
    </Svg>
  ),
  store: (p) => (
    <Svg {...p}>
      <path d="M4 8.5V16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8.5" />
      <path d="M3 8.5 4.5 4h11L17 8.5a2.2 2.2 0 0 1-4.3 0 2.2 2.2 0 0 1-4.3 0 2.2 2.2 0 0 1-4.3 0Z" />
      <path d="M8.5 17v-4h3v4" />
    </Svg>
  ),
  chart: (p) => (
    <Svg {...p}>
      <path d="M3 17h14" />
      <path d="M6 17v-5M10 17V6M14 17v-8" />
    </Svg>
  ),
  menu: (p) => (
    <Svg {...p}>
      <path d="M4 4.5h12v11H4z" />
      <path d="M7 8h6M7 11h6" />
    </Svg>
  ),
  megaphone: (p) => (
    <Svg {...p}>
      <path d="M4 8v4l8 3.5V4.5L4 8Z" />
      <path d="M4 8H3.2A.7.7 0 0 0 2.5 8.7v2.6c0 .4.3.7.7.7H4" />
      <path d="M12 6.5c2 .5 3.5 1.7 3.5 3.5S14 13 12 13.5M6 12.5v3a1 1 0 0 0 1 1h1" />
    </Svg>
  ),
  bag: (p) => (
    <Svg {...p}>
      <path d="M5 6.5h10l-.8 9.2a1 1 0 0 1-1 .9H6.8a1 1 0 0 1-1-.9L5 6.5Z" />
      <path d="M7.5 8.5V6a2.5 2.5 0 0 1 5 0v2.5" />
    </Svg>
  ),
  truck: (p) => (
    <Svg {...p}>
      <path d="M2.5 6h8v8h-8z" />
      <path d="M10.5 8.5h3l2.5 2.5V14h-5.5" />
      <circle cx="6" cy="14.5" r="1.6" />
      <circle cx="13.5" cy="14.5" r="1.6" />
    </Svg>
  ),
  clock: (p) => (
    <Svg {...p}>
      <circle cx="10" cy="10" r="6.5" />
      <path d="M10 6.5V10l2.5 1.8" />
    </Svg>
  ),
  timeline: (p) => (
    <Svg {...p}>
      <path d="M6 4v12" />
      <circle cx="6" cy="6.5" r="1.6" />
      <circle cx="6" cy="13.5" r="1.6" />
      <path d="M9.5 6.5h6M9.5 13.5h4" />
    </Svg>
  ),
  card: (p) => (
    <Svg {...p}>
      <rect x="3" y="5" width="14" height="10" rx="1.6" />
      <path d="M3 8.5h14M6 12h3" />
    </Svg>
  ),
  payout: (p) => (
    <Svg {...p}>
      <circle cx="10" cy="10" r="6.5" />
      <path d="M10 13.5V6.5M10 6.5 7.5 9M10 6.5 12.5 9" />
    </Svg>
  ),
  percent: (p) => (
    <Svg {...p}>
      <path d="M5 15 15 5" />
      <circle cx="7" cy="7" r="1.8" />
      <circle cx="13" cy="13" r="1.8" />
    </Svg>
  ),
  refund: (p) => (
    <Svg {...p}>
      <path d="M5 9a5.5 5.5 0 1 1 1 5" />
      <path d="M3 5v4h4" />
    </Svg>
  ),
  report: (p) => (
    <Svg {...p}>
      <path d="M5 3h7l4 4v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M12 3v4h4" />
      <path d="M7.5 14v-2M10 14v-4M12.5 14v-3" />
    </Svg>
  ),
  users: (p) => (
    <Svg {...p}>
      <circle cx="8" cy="7.5" r="2.6" />
      <path d="M3.5 16c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5" />
      <circle cx="14" cy="8" r="2.1" />
      <path d="M12.8 12.4c2.2.2 3.7 1.8 3.7 3.6" />
    </Svg>
  ),
  shield: (p) => (
    <Svg {...p}>
      <path d="M10 3 5 5v4.5c0 4 2.2 6 5 7.5 2.8-1.5 5-3.5 5-7.5V5l-5-2Z" />
      <path d="m8 10 1.6 1.6L13 8.2" />
    </Svg>
  ),
  flag: (p) => (
    <Svg {...p}>
      <path d="M5 3v14" />
      <path d="M5 4h9l-2 2.8L14 9.5H5" />
    </Svg>
  ),
  plug: (p) => (
    <Svg {...p}>
      <path d="M8 3v3.5M12 3v3.5" />
      <path d="M6 6.5h8v3a4 4 0 0 1-8 0v-3Z" />
      <path d="M10 13.5V17" />
    </Svg>
  ),
  webhook: (p) => (
    <Svg {...p}>
      <circle cx="7" cy="6.5" r="2.4" />
      <path d="M7 9 4.5 14h5" />
      <path d="m9.5 14 3 2.5M15.5 11.5 13 14" />
      <circle cx="15.5" cy="10" r="2.4" />
    </Svg>
  ),
  logs: (p) => (
    <Svg {...p}>
      <rect x="3.5" y="4" width="13" height="12" rx="1.6" />
      <path d="M6.5 8h2M11 8h2.5M6.5 11h2M11 11h2.5M6.5 14h2" />
    </Svg>
  ),
  sparkles: (p) => (
    <Svg {...p}>
      <path d="M10 3.5 11.4 8 16 9.4 11.4 10.8 10 15.5 8.6 10.8 4 9.4 8.6 8 10 3.5Z" />
      <path d="M15.5 3.5v2.5M14.2 4.7h2.6" />
    </Svg>
  ),
  bolt: (p) => (
    <Svg {...p}>
      <path d="M11 3 5 11h4l-1 6 6-8h-4l1-6Z" />
    </Svg>
  ),
  lightbulb: (p) => (
    <Svg {...p}>
      <path d="M7 12.5A4.5 4.5 0 1 1 13 12.5c-.7.7-1 1.3-1 2.2H8c0-.9-.3-1.5-1-2.2Z" />
      <path d="M8.2 17h3.6M8.6 14.7h2.8" />
    </Svg>
  ),
  terminal: (p) => (
    <Svg {...p}>
      <rect x="3" y="4.5" width="14" height="11" rx="1.6" />
      <path d="m6.5 9 2 1.7-2 1.7M10.5 12.4h3" />
    </Svg>
  ),
  checklist: (p) => (
    <Svg {...p}>
      <path d="M9 6h7M9 10h7M9 14h7" />
      <path d="m3.5 5.6 1.3 1.3 1.8-2.2M3.5 9.6l1.3 1.3 1.8-2.2M3.5 13.6l1.3 1.3 1.8-2.2" />
    </Svg>
  ),
  heart: (p) => (
    <Svg {...p}>
      <path d="M10 16C5 12.5 3.5 10 3.5 7.6A3.1 3.1 0 0 1 10 6a3.1 3.1 0 0 1 6.5 1.6C16.5 10 15 12.5 10 16Z" />
    </Svg>
  ),
  bell: (p) => (
    <Svg {...p}>
      <path d="M6 13V9a4 4 0 0 1 8 0v4l1.3 1.6H4.7L6 13Z" />
      <path d="M8.4 16.5a1.8 1.8 0 0 0 3.2 0" />
    </Svg>
  ),
  gift: (p) => (
    <Svg {...p}>
      <rect x="4" y="8.5" width="12" height="7.5" rx="1" />
      <path d="M3.5 8.5h13V11h-13zM10 8.5V16" />
      <path d="M10 8.5C8 8.5 6.5 7.5 6.5 6S8.5 4 10 8.5ZM10 8.5C12 8.5 13.5 7.5 13.5 6S11.5 4 10 8.5Z" />
    </Svg>
  ),
  ticket: (p) => (
    <Svg {...p}>
      <path d="M4 7a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1.5a1.5 1.5 0 0 0 0 3V13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-1.5a1.5 1.5 0 0 0 0-3V7Z" />
      <path d="M11 6v8" />
    </Svg>
  ),
  globe: (p) => (
    <Svg {...p}>
      <circle cx="10" cy="10" r="6.5" />
      <path d="M3.5 10h13M10 3.5c2 2.2 2 10.8 0 13M10 3.5c-2 2.2-2 10.8 0 13" />
    </Svg>
  ),
  map: (p) => (
    <Svg {...p}>
      <path d="M3.5 6 8 4.5l4 1.5 4.5-1.5v9.5L12 15.5l-4-1.5-4.5 1.5V6Z" />
      <path d="M8 4.5v9.5M12 6v9.5" />
    </Svg>
  ),
  wallet: (p) => (
    <Svg {...p}>
      <path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h9.5v2.5" />
      <rect x="3.5" y="6.5" width="13" height="9" rx="1.5" />
      <circle cx="13" cy="11" r="1.1" />
    </Svg>
  ),
  layers: (p) => (
    <Svg {...p}>
      <path d="M10 3.5 17 7l-7 3.5L3 7l7-3.5Z" />
      <path d="M3 11l7 3.5L17 11" />
    </Svg>
  ),
  settings: (p) => (
    <Svg {...p}>
      <circle cx="10" cy="10" r="2.4" />
      <path d="M10 3v2M10 15v2M3 10h2M15 10h2M5 5l1.4 1.4M13.6 13.6 15 15M15 5l-1.4 1.4M6.4 13.6 5 15" />
    </Svg>
  ),
  search: (p) => (
    <Svg {...p}>
      <circle cx="9" cy="9" r="5" />
      <path d="m13 13 3.5 3.5" />
    </Svg>
  ),
  command: (p) => (
    <Svg {...p}>
      <path d="M7.5 4.5A1.5 1.5 0 1 1 6 6h8a1.5 1.5 0 1 1-1.5 1.5v5A1.5 1.5 0 1 1 14 14H6a1.5 1.5 0 1 1 1.5-1.5v-5Z" />
    </Svg>
  ),
  chevronDown: (p) => (
    <Svg {...p}>
      <path d="m5 8 5 5 5-5" />
    </Svg>
  ),
  chevronRight: (p) => (
    <Svg {...p}>
      <path d="m8 5 5 5-5 5" />
    </Svg>
  ),
  chevronLeft: (p) => (
    <Svg {...p}>
      <path d="m12 5-5 5 5 5" />
    </Svg>
  ),
  sidebar: (p) => (
    <Svg {...p}>
      <rect x="3.5" y="4" width="13" height="12" rx="1.6" />
      <path d="M8 4v12" />
    </Svg>
  ),
  close: (p) => (
    <Svg {...p}>
      <path d="m5 5 10 10M15 5 5 15" />
    </Svg>
  ),
  plus: (p) => (
    <Svg {...p}>
      <path d="M10 4v12M4 10h12" />
    </Svg>
  ),
  signout: (p) => (
    <Svg {...p}>
      <path d="M13 5V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1" />
      <path d="M17 10H8m6-3 3 3-3 3" />
    </Svg>
  ),
  check: (p) => (
    <Svg {...p}>
      <path d="m4 10.5 4 4 8-9" />
    </Svg>
  ),
  external: (p) => (
    <Svg {...p}>
      <path d="M8 4H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3" />
      <path d="M11 4h5v5M16 4l-7 7" />
    </Svg>
  ),
  filter: (p) => (
    <Svg {...p}>
      <path d="M3.5 5h13l-5 6v4l-3 1.5V11l-5-6Z" />
    </Svg>
  ),
  download: (p) => (
    <Svg {...p}>
      <path d="M10 3.5v9M6.5 9 10 12.5 13.5 9M4 16h12" />
    </Svg>
  ),
  dots: (p) => (
    <Svg {...p}>
      <circle cx="5" cy="10" r="1.3" />
      <circle cx="10" cy="10" r="1.3" />
      <circle cx="15" cy="10" r="1.3" />
    </Svg>
  ),
  arrowUp: (p) => (
    <Svg {...p}>
      <path d="M10 16V4M5 9l5-5 5 5" />
    </Svg>
  ),
  arrowDown: (p) => (
    <Svg {...p}>
      <path d="M10 4v12M5 11l5 5 5-5" />
    </Svg>
  ),
  sun: (p) => (
    <Svg {...p}>
      <circle cx="10" cy="10" r="3.2" />
      <path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7 6 6M14 14l1.3 1.3M15.3 4.7 14 6M6 14l-1.3 1.3" />
    </Svg>
  ),
};
