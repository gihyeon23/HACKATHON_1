import Blueprint from "../components/Blueprint";
import { Icon } from "../components/Ui";

const NAV = ["제품 소개", "주요 기능", "도입 효과", "보안 기술", "고객사례"];

function Shield({ small = false }: { small?: boolean }) {
  return (
    <svg width={small ? 13 : 24} height={small ? 15 : 28} viewBox="0 0 26 28" aria-hidden="true">
      <path d="M13 1 2 5v8.5C2 20.5 6.8 25 13 27c6.2-2 11-6.5 11-13.5V5z" fill={small ? "#3563e9" : "#fff"} />
      <path d="M13 7 7.5 9v4.5c0 3.3 2.2 5.5 5.5 6.5 3.3-1 5.5-3.2 5.5-6.500V9z" fill={small ? "#fff" : "#3563e9"} />
    </svg>
  );
}

function ProductMock() {
  return (
    <div className="mock" aria-label="제품 화면 예시">
      <aside>
        <b><Shield small /> TraceGuard</b>
        <span><Icon name="home" size={13} />대시보드</span>
        <span><Icon name="doc" size={13} />문서 관리</span>
        <span className="mock-on"><Icon name="search" size={13} />유출 조사</span>
        <span><Icon name="route" size={13} />경로 추적</span>
        <span><Icon name="report" size={13} />보고서</span>
        <span><Icon name="gear" size={13} />설정</span>
      </aside>
      <div className="mock-main">
        <p className="mock-crumb">유출 조사 &gt; OLED_설계도.png</p>
        <div className="mock-card">
          <div className="mock-head">
            <i><Icon name="check" size={18} /></i>
            <div><b>분석이 완료되었습니다.</b><small>업로드한 파일에서 사본이 식별되었으며, 배포 경로를 추적할 수 있습니다.</small></div>
          </div>
          <div className="mock-doc">
            <Blueprint />
            <dl>
              <b>OLED_설계도.png</b>
              <div><dt>사본 ID</dt><dd>COPY-C203</dd></div>
              <div><dt>등록일</dt><dd>2024. 11. 28. 14:32</dd></div>
              <div><dt>식별 신뢰도</dt><dd>높음</dd></div>
            </dl>
            <span className="mock-btn">원본 보기</span>
          </div>
          <div className="mock-tabs"><b>배포 경로</b><span>검출 결과</span><span>상세 정보</span><span>관련 문서</span></div>
          <div className="mock-path">
            <div className="mock-leak"><i><Icon name="building" size={15} /></i><p><b>협력사 C</b><small>(COPY-C203)</small><small>2024. 11. 28. 14:32</small></p></div>
            <Icon name="arrow" size={15} />
            <div><i><Icon name="user" size={15} /></i><p><b>직원 B</b><small>(COPY-B102)</small><small>2024. 11. 25. 09:14</small></p></div>
            <Icon name="arrow" size={15} />
            <div><i><Icon name="doc" size={15} /></i><p><b>원본 문서</b><small>(DOC-A001)</small><small>2024. 11. 20. 10:33</small></p></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="landing">
      <section className="lhero">
        <svg className="lhero-wave" viewBox="0 0 1440 620" preserveAspectRatio="none" aria-hidden="true">
          <path d="M860 0c80 120 300 170 580 120V0z" fill="rgb(255 255 255 / 7%)" />
          <path d="M1040 0c60 70 200 90 400 60V0z" fill="rgb(255 255 255 / 7%)" />
        </svg>
        <header className="lnav">
          <a className="logo logo-light" href="#/"><Shield /> TraceGuard</a>
          <nav aria-label="제품 메뉴">{NAV.map((n) => <span key={n}>{n}</span>)}</nav>
          <span className="lnav-login">로그인</span>
          <a className="lnav-cta" href="#/investigate">무료로 시작하기 <Icon name="arrow" size={15} /></a>
        </header>
        <div className="lhero-body">
          <div className="lhero-text">
            <p className="eyebrow">DOCUMENT SECURITY &amp; TRACEABILITY</p>
            <h1>문서가 어디서 왔는지,<br />이제 추적할 수 있습니다.</h1>
            <p className="lhero-sub">유출된 문서의 워터마크를 분석하고,<br />확인된 배포 경로를 역추적하는 기업용 문서 보안 솔루션입니다.</p>
            <a className="hero-cta" href="#/investigate">
              <span className="drop-icon"><Icon name="upload" size={26} /></span>
              <span className="drop-text"><strong>유출 문서 분석 시작</strong><small>이미지 파일을 업로드해 사본 식별과 배포 경로를 확인하세요.</small></span>
              <span className="drop-go"><Icon name="arrow" size={20} /></span>
            </a>
            <ul className="hero-points">
              <li><Icon name="check" size={15} /> 이미지 (JPG, PNG) 지원</li>
              <li><Icon name="check" size={15} /> 워터마크 자동 검출</li>
              <li><Icon name="check" size={15} /> 배포 경로 시각화</li>
            </ul>
          </div>
          <ProductMock />
        </div>
      </section>

      <section className="how" id="how">
        <p className="how-eyebrow">HOW IT WORKS</p>
        <h2>복잡한 유출 조사, 세 단계로 간단하게.</h2>
        <p className="how-sub">유출 문서를 업로드하면, 워터마크를 분석하여 사본을 식별하고 배포 경로를 추적합니다.</p>
        <div className="how-grid">
          <article>
            <header><b>01</b><div><h3>유출 파일 업로드</h3><p>이미지 파일을 업로드하여<br />워터마크를 분석합니다.</p></div></header>
            <div className="how-art how-art-upload">
              <span><Icon name="image" size={30} /></span>
              <div><i><Icon name="check" size={13} /></i><p><b>OLED_설계도.png</b><small>2.4MB</small></p></div>
            </div>
          </article>
          <article>
            <header><b>02</b><div><h3>사본 식별 및 검출</h3><p>파일에 삽입된 식별 정보를<br />분석하여 문서와 사본을 식별합니다.</p></div></header>
            <div className="how-art how-art-scan">
              <Blueprint />
              <div><small>사본 ID</small><b>COPY-C203</b><small>식별 신뢰도</small><b>높음</b></div>
            </div>
          </article>
          <article>
            <header><b>03</b><div><h3>배포 경로 역추적</h3><p>식별된 사본의 배포 계보를 따라<br />문서의 전달 경로를 시각화합니다.</p></div></header>
            <div className="how-art how-art-path">
              <div><i className="how-c">C</i><b>협력사</b><small>2024.11.28</small></div>
              <span className="how-leak" />
              <div><i className="how-b">B</i><b>직원</b><small>2024.11.25</small></div>
              <span />
              <div><i className="how-a">A</i><b>원본</b><small>2024.11.20</small></div>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
