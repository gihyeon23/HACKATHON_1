/** 랜딩 예시 화면용 도면 그림 */
export default function Blueprint() {
  return (
    <svg className="blueprint" viewBox="0 0 320 190" role="img" aria-label="도면 예시">
      <rect x="8" y="8" width="304" height="174" fill="#fff" stroke="#3c4a63" strokeWidth="1.5" />
      {[60, 112, 164, 216, 268].map((x) => <line key={x} x1={x} y1="8" x2={x} y2="182" stroke="#dfe4ee" />)}
      {[50, 92, 134].map((y) => <line key={y} x1="8" y1={y} x2="312" y2={y} stroke="#dfe4ee" />)}
      <rect x="44" y="34" width="60" height="42" fill="none" stroke="#3c4a63" strokeWidth="1.5" />
      <circle cx="170" cy="82" r="38" fill="none" stroke="#3c4a63" strokeWidth="1.5" />
      <circle cx="98" cy="120" r="17" fill="none" stroke="#3c4a63" strokeWidth="1.5" />
      <circle cx="236" cy="134" r="14" fill="none" stroke="#3c4a63" strokeWidth="1.5" />
    </svg>
  );
}
