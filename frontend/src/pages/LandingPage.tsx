import { Blueprint, Icon, ShieldLogo, type IconName } from "../components/Icon";

// 제품소개 등은 버튼이 아닌 텍스트로만 둔다 (AGENTS.md 3장)
const NAV = ["제품 소개", "주요 기능", "도입 효과", "보안 기술", "고객사례"];

const HOW_IT_WORKS = [
  { no: "01", title: "배포본 발급", desc: ["원본을 등록하고 받는 사람마다", "고유한 워터마크 사본을 만듭니다."] },
  { no: "02", title: "유출 이미지 분석", desc: ["유출된 이미지를 업로드하면", "워터마크로 사본을 식별합니다."] },
  { no: "03", title: "배포 경로 역추적", desc: ["식별된 사본에서 원본까지의", "배포 계보를 시각화합니다."] },
];

interface LandingPageProps {
  /** 유출 조사 (업로드) */
  onStart: () => void;
  /** 배포본 발급 (문서 등록) */
  onIssue: () => void;
}

export function LandingPage({ onStart, onIssue }: LandingPageProps) {
  return (
    <div className="landing">
      <section className="hero">
        <div className="hero-inner">
          <header className="hero-nav">
            <span className="brand">
              <ShieldLogo />
              TraceGuard
            </span>
            <ul className="hero-menu">
              {NAV.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <button type="button" className="hero-cta" onClick={onStart}>
              무료로 시작하기
              <Icon name="arrowRight" size={16} strokeWidth={2.2} />
            </button>
          </header>

          <div className="hero-body">
            <div className="hero-copy">
              <p className="hero-eyebrow">DOCUMENT SECURITY &amp; TRACEABILITY</p>
              <h1>
                문서가 어디서 왔는지,
                <br />
                이제 추적할 수 있습니다.
              </h1>
              <p className="hero-lead">
                배포하는 문서마다 보이지 않는 워터마크를 넣고,{" "}
                <br />
                유출되면 확인된 배포 경로를 역추적하는 기업용 문서 보안 솔루션입니다.
              </p>

              <div className="start-card">
                <span className="start-card-icon">
                  <Icon name="upload" size={28} />
                </span>
                <div className="start-card-text">
                  <strong>유출 문서 분석 시작</strong>
                  <span>이미지 파일을 업로드해 사본 식별과 배포 경로를 확인하세요.</span>
                </div>
                <button type="button" className="start-card-go" onClick={onStart} aria-label="유출 문서 분석 시작">
                  <Icon name="arrowRight" size={26} strokeWidth={2.2} />
                </button>
              </div>

              <div className="start-card is-secondary">
                <span className="start-card-icon">
                  <Icon name="file" size={26} />
                </span>
                <div className="start-card-text">
                  <strong>
                    배포본 발급하기 <span className="badge-new">NEW</span>
                  </strong>
                  <span>원본을 등록하고 받는 사람별 워터마크 사본을 만드세요.</span>
                </div>
                <button type="button" className="start-card-go" onClick={onIssue} aria-label="배포본 발급하기">
                  <Icon name="arrowRight" size={26} strokeWidth={2.2} />
                </button>
              </div>

              <ul className="hero-checks">
                {["이미지 (JPG, PNG) 지원", "받는 사람별 사본 발급", "배포 경로 시각화"].map((t) => (
                  <li key={t}>
                    <Icon name="checkCircle" size={18} />
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            <ProductPreview />
          </div>
        </div>
      </section>

      <section className="how" aria-labelledby="how-title">
        <p className="eyebrow">HOW IT WORKS</p>
        <h2 id="how-title">복잡한 유출 조사, 세 단계로 간단하게.</h2>
        <p className="how-lead">유출 문서를 업로드하면, 워터마크를 분석하여 사본을 식별하고 배포 경로를 추적합니다.</p>
        <ol className="how-grid">
          {HOW_IT_WORKS.map((item, i) => (
            <li key={item.no} className="how-card">
              <div className="how-card-head">
                <span className="how-no">{item.no}</span>
                <div>
                  <h3>{item.title}</h3>
                  <p>
                    {item.desc[0]}
                    <br />
                    {item.desc[1]}
                  </p>
                </div>
              </div>
              <div className="how-visual" aria-hidden="true">
                {i === 0 && <HowIssue />}
                {i === 1 && <HowDetect />}
                {i === 2 && <HowTrace />}
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

const SIDEBAR: { icon: IconName; label: string; active?: boolean }[] = [
  { icon: "square", label: "대시보드" },
  { icon: "square", label: "문서 관리" },
  { icon: "search", label: "유출 조사", active: true },
  { icon: "square", label: "경로 추적" },
  { icon: "square", label: "보고서" },
  { icon: "circle", label: "설정" },
];

/** 히어로 오른쪽 제품 화면 일러스트 (장식). 신뢰도 % · 배포 시각은 넣지 않는다 */
function ProductPreview() {
  const nodes: { icon: IconName; name: string; code: string; hl?: boolean }[] = [
    { icon: "building", name: "협력사 C", code: "COPY-C203", hl: true },
    { icon: "user", name: "직원 B", code: "COPY-B102" },
    { icon: "file", name: "원본 문서", code: "DOC-A001" },
  ];
  return (
    <div className="preview" aria-hidden="true">
      <aside className="preview-side">
        <span className="preview-brand">
          <ShieldLogo size={18} />
          TraceGuard
        </span>
        <ul>
          {SIDEBAR.map((s) => (
            <li key={s.label} className={s.active ? "is-active" : undefined}>
              <Icon name={s.icon} size={14} />
              {s.label}
            </li>
          ))}
        </ul>
      </aside>
      <div className="preview-main">
        <p className="preview-crumb">
          유출 조사 &gt; <b>OLED_설계도.png</b>
        </p>
        <div className="preview-done">
          <span className="preview-done-icon">
            <Icon name="check" size={18} strokeWidth={3} />
          </span>
          <div>
            <strong>분석이 완료되었습니다.</strong>
            <span>업로드한 파일에서 사본이 식별되었으며, 배포 경로를 추적할 수 있습니다.</span>
          </div>
        </div>
        <div className="preview-file">
          <Blueprint className="preview-thumb" />
          <dl>
            <dt className="preview-file-name">OLED_설계도.png</dt>
            <dd>
              <span>사본 ID</span>COPY-C203
            </dd>
            <dd>
              <span>원본 문서</span>DOC-A001
            </dd>
            <dd>
              <span>검출 등급</span>높음
            </dd>
          </dl>
          <span className="preview-btn">원본 보기</span>
        </div>
        <ul className="preview-tabs">
          <li className="is-active">배포 경로</li>
          <li>검출 결과</li>
          <li>상세 정보</li>
          <li>관련 문서</li>
        </ul>
        <div className="preview-path">
          {nodes.map((n, i) => (
            <div key={n.code} className="preview-path-item">
              {i > 0 && <Icon name="arrowRight" size={18} className="preview-arrow" />}
              <div className={`preview-node${n.hl ? " is-hl" : ""}`}>
                <span className="preview-node-icon">
                  <Icon name={n.icon} size={16} />
                </span>
                <div>
                  <b>{n.name}</b>
                  <span>({n.code})</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HowIssue() {
  return (
    <div className="how-issue">
      <Blueprint className="how-issue-doc" />
      <Icon name="arrowRight" size={22} className="how-issue-arrow" />
      <ul>
        <li>
          <span>
            <Icon name="user" size={14} />
          </span>
          <b>직원 B</b>
          <em>COPY-B102</em>
        </li>
        <li>
          <span>
            <Icon name="building" size={14} />
          </span>
          <b>협력사 C</b>
          <em>COPY-C203</em>
        </li>
      </ul>
    </div>
  );
}

function HowDetect() {
  return (
    <div className="how-detect">
      <div className="how-detect-doc">
        <Blueprint className="how-detect-bp" />
        <span className="how-detect-scan" />
      </div>
      <div className="how-detect-info">
        <span>사본 ID</span>
        <b>COPY-C203</b>
        <span>검출 등급</span>
        <b>높음</b>
      </div>
    </div>
  );
}

function HowTrace() {
  const items = [
    { letter: "C", label: "협력사", tone: "red" },
    { letter: "B", label: "직원", tone: "blue" },
    { letter: "A", label: "원본", tone: "gray" },
  ];
  return (
    <div className="how-trace">
      {items.map((it, i) => (
        <div key={it.letter} className="how-trace-item">
          {i > 0 && <span className="how-trace-line" />}
          <span className={`how-trace-dot tone-${it.tone}`}>{it.letter}</span>
          <b>{it.label}</b>
        </div>
      ))}
    </div>
  );
}
