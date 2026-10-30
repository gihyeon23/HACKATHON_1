import type { ReactNode } from "react";

// Reuses the existing TraceGuard icon vocabulary from tracing/web/components/Ui.
const paths: Record<string, ReactNode> = {
  doc: <path d="M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  arrow: <path d="M4.5 12h15M13.5 6l6 6-6 6" />,
  user: (
    <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c1-4 4-5.5 7.5-5.5s6.5 1.5 7.5 5.5" />
  ),
  building: <path d="M5 21V4h9v17M14 10h5v11M3 21h18M8 8h3M8 12h3M8 16h3" />,
  lock: <path d="M6 11h12v9.5H6zM8.5 11V7.5a3.5 3.5 0 0 1 7 0V11" />,
  alert: <path d="M12 4 2.8 20h18.4zM12 10v4.5M12 17.3v.2" />,
  layers: <path d="m12 3 10 6-10 6L2 9l10-6ZM2 14l10 6 10-6M2 19l10 5 10-5" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  chevronDown: <path d="m5 9 7 7 7-7" />,
  refresh: <path d="M20 8a8 8 0 1 0 0 8M20 3v6h-6" />,
  external: <path d="M14 3h7v7m0-7L10 14M11 5H4v16h16v-7" />,
  expand: <path d="M9 3H3v6m12-6h6v6M3 15v6h6m6 0h6v-6" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6m0-10v1" />
    </>
  ),
};

export function Icon({ name, size = 22 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.doc}
    </svg>
  );
}
