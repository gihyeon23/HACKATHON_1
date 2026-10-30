import type { SVGProps } from "react";

const PATHS = {
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowDown: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v8.5M8.5 12.5 12 16l3.5-3.5" />
    </>
  ),
  upload: <path d="M12 19V5M6 11l6-6 6 6" />,
  cloudUpload: (
    <>
      <path d="M7 18H6.5a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 17.6 8.1 4.5 4.5 0 0 1 17.5 18H17" />
      <path d="M12 21v-9M8.5 15.5 12 12l3.5 3.5" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.3 2.8 2.8L16.2 9.6" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="m21 16-5-5-9 9" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  scan: (
    <>
      <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
      <path d="M7 12s2-3.5 5-3.5 5 3.5 5 3.5-2 3.5-5 3.5S7 12 7 12z" />
      <circle cx="12" cy="12" r="1.2" />
    </>
  ),
  share: (
    <>
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="m8.2 10.8 7.6-4.6M8.2 13.2l7.6 4.6" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </>
  ),
  chevronRight: <path d="m9 6 6 6-6 6" />,
  chevronLeft: <path d="m15 6-6 6 6 6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  building: (
    <>
      <path d="M4 21V9l8-5 8 5v12z" />
      <path d="M10 21v-5h4v5M9 11h.01M15 11h.01" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5z" />
      <path d="m3 13 9 5 9-5" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <path d="M20 4v5h-5" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
    </>
  ),
  expand: <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.5h.01" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  download: (
    <>
      <path d="M12 4v11M7 10.5 12 15.5l5-5" />
      <path d="M5 20h14" />
    </>
  ),
  square: <rect x="5" y="5" width="14" height="14" rx="3" />,
  circle: <circle cx="12" cy="12" r="7" />,
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

/** 장식용 선 아이콘. 의미가 있으면 감싸는 버튼에 aria-label 을 준다 */
export function Icon({ name, size = 20, strokeWidth = 1.8, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}

export function ShieldLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 2.5 4 5.5v6c0 5 3.4 8.9 8 10 4.6-1.1 8-5 8-10v-6z" fill="currentColor" />
      <path d="M12 7.2 8 8.7v3.1c0 2.5 1.7 4.5 4 5.1 2.3-.6 4-2.6 4-5.1V8.7z" fill="var(--logo-inner, #fff)" />
    </svg>
  );
}

/** 랜딩 일러스트와 썸네일 자리 표시용 설계도 그림 */
export function Blueprint({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 240 150" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="238" height="148" fill="#fff" stroke="#c7cfdc" />
      <g stroke="#e3e8f0" strokeWidth="1">
        {[30, 60, 90, 120].map((y) => (
          <line key={`h${y}`} x1="1" y1={y} x2="239" y2={y} />
        ))}
        {[40, 80, 120, 160, 200].map((x) => (
          <line key={`v${x}`} x1={x} y1="1" x2={x} y2="149" />
        ))}
      </g>
      <g fill="none" stroke="#6b7486" strokeWidth="1.2">
        <rect x="26" y="22" width="48" height="28" />
        <circle cx="132" cy="62" r="32" />
        <circle cx="70" cy="98" r="13" />
        <circle cx="182" cy="110" r="11" />
      </g>
    </svg>
  );
}
