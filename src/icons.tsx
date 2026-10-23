import { CSSProperties } from "react";
const paths: Record<string, React.ReactNode> = {
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  down: <path d="m6 9 6 6 6-6" />,
  volume: (
    <>
      <path d="m11 4-6 5H2v6h3l6 5Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
    </>
  ),
  muted: (
    <>
      <path d="m11 4-6 5H2v6h3l6 5Zm5 5 5 6m0-6-5 6" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  lock: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" />
    </>
  ),
  transition: (
    <>
      <rect x="3" y="4" width="11" height="16" rx="2" />
      <path d="M10 4h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-9M8 9l3 3-3 3m3-3h6" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5" />
    </>
  ),
  download: <path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4" />,
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8" cy="8" r="1.5" />
      <path d="m3 17 6-6 4 4 3-3 5 5" />
    </>
  ),
  text: <path d="M4 5h16M12 5v15m-4 0h8" />,
  voice: (
    <>
      <rect x="9" y="2" width="6" height="13" rx="3" />
      <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8" />
    </>
  ),
  play: <path d="m8 4 12 8-12 8Z" />,
  pause: (
    <>
      <path d="M8 4v16M16 4v16" />
    </>
  ),
  back: <path d="m14 6-6 6 6 6" />,
  next: <path d="m10 6 6 6-6 6" />,
  rewind: (
    <>
      <path d="M5 5v14m13-14L7 12l11 7Z" />
    </>
  ),
  undo: (
    <>
      <path d="M4 10h10a6 6 0 0 1 0 12M4 10l5-5M4 10l5 5" />
    </>
  ),
  redo: (
    <>
      <path d="M20 10H10a6 6 0 0 0 0 12m10-12-5-5m5 5-5 5" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="13" height="13" rx="2" />
      <path d="M16 8V3H3v13h5" />
    </>
  ),
  scissors: (
    <>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="m8 8 13 13M8 16 21 3" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  folder: <path d="M3 6V4h6l3 3h9v13H3Z" />,
  settings: (
    <>
      <path d="M4 7h16M4 17h16" />
      <circle cx="9" cy="7" r="3" />
      <circle cx="15" cy="17" r="3" />
    </>
  ),
  motion: (
    <>
      <path d="M3 8h8M3 12h5M3 16h8m3-11 7 7-7 7" />
    </>
  ),
  effect: (
    <>
      <path d="m13 2-3 8H3l7 5-2 7 7-6 6 1-4-7 3-5-7 1Z" />
    </>
  ),
  expand: <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />,
  save: (
    <>
      <path d="M4 3h13l4 4v14H3V3Zm3 0v7h10V3M7 21v-8h10v8" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9a3 3 0 1 1 4 3v2m-1 3h.01" />
    </>
  ),
  flip: (
    <>
      <path d="M12 3v18M9 5 3 18h6Zm6 0 6 13h-6Z" />
    </>
  ),
  film: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M7 3v18M17 3v18M3 8h4m10 0h4M3 16h4m10 0h4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
};
export const Icon = ({
  name,
  size = 18,
  style,
}: {
  name: string;
  size?: number;
  style?: CSSProperties;
}) => (
  <svg
    width={size}
    height={size}
    style={style}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {paths[name] ?? paths.image}
  </svg>
);
