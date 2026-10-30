import type { ReactNode } from "react";
import { Icon } from "./Icon";

export function InvestigationLayout({
  step,
  children,
  mock = false,
  onUpload,
}: {
  step: 2 | 3;
  children: ReactNode;
  mock?: boolean;
  onUpload: () => void;
}) {
  return (
    <main className="investigation-shell">
      <header className="investigation-header">
        <nav aria-label="현재 위치">
          <span>유출 조사</span>
          <Icon name="chevron" size={15} />
          <button type="button" onClick={onUpload}>
            새 조사 시작
          </button>
          {step === 3 && (
            <>
              <Icon name="chevron" size={15} />
              <strong>분석 결과</strong>
            </>
          )}
        </nav>
        <div className="header-account">
          {mock && <span className="mock-tag">DEMO · 샘플 데이터</span>}
          <span className="account-avatar" aria-label="TraceGuard">
            TC
          </span>
        </div>
      </header>
      <ol className="stepper" aria-label="분석 단계">
        {["파일 업로드", "분석 진행", "결과 확인"].map((label, index) => {
          const number = index + 1,
            past = number < step;
          return (
            <li
              key={label}
              className={number <= step ? "step-active" : ""}
              aria-current={number === step ? "step" : undefined}
            >
              <span className="step-marker">
                {past ? <Icon name="check" size={19} /> : number}
              </span>
              <span>{label}</span>
            </li>
          );
        })}
      </ol>
      {children}
    </main>
  );
}
