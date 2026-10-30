import type { ReactNode } from "react";

const paths: Record<string, ReactNode> = {
  home: <path d="M3 11.5 12 4l9 7.5M5.5 10v10h13V10M10 20v-6h4v6" />,
  doc: <path d="M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6" />,
  search: <path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4" />,
  route: <path d="M6 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 7v5a4 4 0 0 0 4 4h4a4 4 0 0 1 4 1" />,
  report: <path d="M5 3h14v18H5zM9 8h6M9 12h6M9 16h3" />,
  gear: <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />,
  eye: <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" />,
  upload: <path d="M12 16V5M7.5 9.5 12 5l4.5 4.5M4.5 15v4.5h15V15" />,
  arrow: <path d="M4.5 12h15M13.5 6l6 6-6 6" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  alert: <path d="M12 4 2.8 20h18.4zM12 10v4.5M12 17.3v.2" />,
  user: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c1-4 4-5.5 7.5-5.5s6.5 1.5 7.5 5.5" />,
  building: <path d="M5 21V4h9v17M14 10h5v11M3 21h18M8 8h3M8 12h3M8 16h3" />,
  lock: <path d="M6 11h12v9.5H6zM8.5 11V7.5a3.5 3.5 0 0 1 7 0V11" />,
  unlink: <path d="M9.5 14.5 6.7 17.3a3.2 3.2 0 0 1-4.5-4.5L5 10M14.5 9.5l2.8-2.8a3.2 3.2 0 0 1 4.5 4.5L19 14M4 4l16 16" />,
  bell: <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15zM10 21h4" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  right: <path d="m9 6 6 6-6 6" />,
  cloud: <path d="M7 19a4.5 4.5 0 0 1-.8-8.9 6 6 0 0 1 11.6 0A4.5 4.5 0 0 1 17 19M12 20v-8M8.8 15 12 11.8l3.2 3.2" />,
  scan: <path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" />,
  share: <path d="M18 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM6 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM18 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM8.2 10.8l7.6-4.5M8.2 13.2l7.6 4.5" />,
  layers: <path d="m12 3 9 5-9 5-9-5zM3 13l9 5 9-5" />,
  refresh: <path d="M20 12a8 8 0 1 1-2.5-5.8L20 8.5M20 3.5v5h-5" />,
  external: <path d="M18 14v6H5V7h6M14 4h6v6M20 4l-9 9" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  expand: <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />,
  image: <path d="M4 5h16v14H4zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM4 16l5-4 4 3 3-2 4 3" />,
  database: <path d="M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />,
};

export function Icon({ name, size = 20 }: { name: keyof typeof paths | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <a href="#/" className={`logo ${light ? "logo-light" : ""}`}>
      <svg width="26" height="28" viewBox="0 0 26 28" aria-hidden="true">
        <path d="M13 1 2 5v8.5C2 20.5 6.8 25 13 27c6.2-2 11-6.5 11-13.5V5z" fill="currentColor" />
        <path d="M8 13.5h10M13 8.5v10" stroke={light ? "#2257d6" : "#fff"} strokeWidth="2.6" strokeLinecap="round" />
      </svg>
      TraceGuard
    </a>
  );
}

export function Notice({ tone, title, children }: { tone: "error" | "warn" | "ok" | "info"; title: string; children?: ReactNode }) {
  return (
    <div className={`notice notice-${tone}`} role={tone === "error" ? "alert" : "status"}>
      <Icon name={tone === "ok" ? "check" : tone === "info" ? "lock" : "alert"} size={20} />
      <div>
        <strong>{title}</strong>
        {children && <div className="notice-body">{children}</div>}
      </div>
    </div>
  );
}

