import type { ReactNode } from "react";
import { Icon } from "./Icon";

const STEPS = ["파일 업로드", "분석 진행", "결과 확인"];

interface AppShellProps {
  /** 1 · 2 · 3 — 현재 단계 */
  step: 1 | 2 | 3;
  breadcrumb: string[];
  children: ReactNode;
}

/** 업로드 · 진행 · 결과 화면 공통 틀: 브레드크럼, 상단 아이콘, 3단계 스테퍼 */
export function AppShell({ step, breadcrumb, children }: AppShellProps) {
  return (
    <div className="app-bg">
      <div className="app-panel">
        <header className="app-top">
          <nav aria-label="현재 위치" className="breadcrumb">
            <ol>
              {breadcrumb.map((label, i) => (
                <li key={label} aria-current={i === breadcrumb.length - 1 ? "page" : undefined}>
                  {i > 0 && <Icon name="chevronRight" size={14} className="breadcrumb-sep" />}
                  {label}
                </li>
              ))}
            </ol>
          </nav>
          <div className="app-top-icons" aria-hidden="true">
            <Icon name="bell" size={22} />
            <span className="avatar">TC</span>
            <Icon name="chevronDown" size={16} />
          </div>
        </header>

        <ol className="stepper" aria-label="진행 단계">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const state = n < step ? "done" : n === step ? "current" : "todo";
            return (
              <li key={label} className={`stepper-item is-${state}`} aria-current={state === "current" ? "step" : undefined}>
                <span className="stepper-dot">{state === "done" ? <Icon name="check" size={14} strokeWidth={2.6} /> : n}</span>
                <span className="stepper-label">{label}</span>
                {i < STEPS.length - 1 && <span className="stepper-line" />}
              </li>
            );
          })}
        </ol>

        <main className="app-main">{children}</main>
      </div>
    </div>
  );
}
