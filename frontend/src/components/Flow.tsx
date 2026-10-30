import type { ReactNode } from "react";
import { Icon } from "./Ui";

const STEPS = ["파일 업로드", "분석 진행", "결과 확인"];

/** 유출 조사 화면 공통 틀: 회색 바탕 위 흰 패널 + 아래 물결 */
export function FlowPage({ children }: { children: ReactNode }) {
  return (
    <div className="flow-page">
      <div className="flow-panel">
        <svg className="flow-wave" viewBox="0 0 1440 240" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 150c240-70 420-40 700-10s500 10 740-90v190H0z" fill="#eef3fd" />
        </svg>
        <div className="flow-wrap">{children}</div>
      </div>
    </div>
  );
}

export function FlowHeader({ crumbs }: { crumbs: string[] }) {
  return (
    <header className="fhead">
      <nav aria-label="현재 위치">
        <span>유출 조사</span>
        {crumbs.map((c, i) => (
          <span key={c} className={i === crumbs.length - 1 ? "fhead-now" : ""}><Icon name="right" size={13} />{c}</span>
        ))}
      </nav>
      <span className="fhead-bell" aria-hidden="true"><Icon name="bell" size={21} /></span>
      <details className="fhead-menu">
        <summary aria-label="계정 메뉴"><i>TC</i><Icon name="chevron" size={15} /></summary>
        <div>
          <a href="#/">홈으로</a>
          <a href="#/investigate">새 조사 시작</a>
        </div>
      </details>
    </header>
  );
}

/** step: 0 파일 업로드 · 1 분석 진행 · 2 결과 확인 */
export function Stepper({ step }: { step: number }) {
  return (
    <ol className="stepper">
      {STEPS.map((label, i) => (
        <li key={label} className={i < step ? "step-done" : i === step ? "step-now" : ""}>
          <i>{i < step ? <Icon name="check" size={15} /> : i + 1}</i>
          <span>{label}</span>
        </li>
      ))}
    </ol>
  );
}
