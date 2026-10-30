---
name: hck-format
description: 경로를 스스로 기억하는 전용 보호 파일 형식(.hck)을 만들고, 열고, 추적하는 스킬. 암호화된 이미지 + 이동 장부(해시 체인 + 서버 HMAC 서명)로, 파일이 카톡·USB 등 어떤 경로로 회사 밖에 나가도 여는 사람마다 기록되어 A→B→C→D 경로와 초 단위 시간을 복원한다. .hck, 전용 확장자, 보호 파일, 이동 장부, 열람 기록, 유출 경로 추적, 위조 탐지, 뷰어에서 파일 다시 저장하기 이야기가 나오면 반드시 이 스킬을 사용할 것.
---

# .hck 보호 파일 형식

## 한 줄 요약
내용은 우리 서버 없이는 못 연다 → 여는 순간 서버가 "누가·언제·누구한테 받은 사본인지"를 파일 안 장부에 서명해서 적는다 → 파일이 밖으로 몇 번을 넘어가도 마지막 파일 하나에 경로 전체가 남는다.

## 파일 구조 (zip)
| 파일 | 내용 |
|---|---|
| `manifest.json` | format="hck", version, doc_id, title, created_by, created_at |
| `payload.enc` | AES-256-GCM 암호문 (앞 12바이트 nonce). 키는 서버 DB에만 |
| `ledger.json` | 이동 장부 배열 |

장부 한 줄:
```json
{"seq":2,"event":"open","actor":{"id":"C","name":"이OO","org":"외부","phone":"010-****-1234","device":"MAC-C3"},
 "at":"2026-10-31T04:07:55+00:00","parent_hash":"…B의 hash…","hash":"…","sig":"…"}
```
- `hash = SHA256(parent_hash + 본문 JSON)` → 이전 줄과 사슬로 연결 (삭제·순서 변경 탐지)
- `sig = HMAC-SHA256(서버비밀키, hash)` → 서버만 만들 수 있음 (가짜 줄 추가·내용 변경 탐지)
- **부모 = 바로 앞 줄** → C의 앞 줄이 B면 "C는 B에게서 받았다"가 확정

## 코드: `scripts/hck.py` (검증 완료)
| 함수 | 쓰는 곳 | 설명 |
|---|---|---|
| `create(image_bytes, doc_id, title, creator)` | 업로드 API | 키 생성·암호화, 장부 첫 줄(create) |
| `open_file(hck_bytes, actor)` | 열람 API | 장부 검증 → 실패 시 거부, 성공 시 새 줄 추가 → `(새 .hck, 이미지, 부모 줄)` |
| `trace(hck_bytes)` | 추적 API | 장부만으로 경로·시간 복원, 깨진 지점 이전까지만 신뢰 |
| `verify_ledger(ledger)` | 공통 | `{ok, broken_at, reasons}` |

`python hck.py demo` 결과 (실측):
```
김OO(03:12:07) → 박OO(03:42:31) → 이OO(04:07:55) → 최OO(04:31:10)   무결성 OK
C 기록 삭제 → 연결 끊김 / B 이름 바꿔치기 → 내용 변경 / 가짜 기록 추가 → 탐지 / 깨진 파일 열기 → 거부
```

## 서버에 붙일 때 바꿀 것
- `KEY_STORE` 딕셔너리 → SQLite 테이블 `keys(doc_id, key)` 로 (서버 재시작해도 유지)
- `SERVER_SECRET` → 환경변수 `HCK_SERVER_SECRET`
- `open_file` 호출할 때마다 서버 로그 테이블에도 같은 줄 저장 (부모 hash 포함) → 서버 쪽에서는 **트리**로도 볼 수 있음 (한 사본을 두 사람이 열면 가지가 갈라짐)

## 웹 뷰어 (React, 크롬)
뷰어는 zip을 직접 다룰 필요 없다. **파일을 통째로 서버에 보내고, 돌려받은 새 파일로 덮어쓰기**만 하면 된다.
```ts
const [handle] = await (window as any).showOpenFilePicker({ types: [{ description: "보호 파일", accept: { "application/x-hck": [".hck"] } }] });
const file = await handle.getFile();
const form = new FormData(); form.append("file", file); form.append("actor", JSON.stringify(actor));
const res = await fetch("/api/hck/open", { method: "POST", body: form });   // { hck_b64, image_b64, parent }
const { hck_b64, image_b64, parent } = await res.json();
const w = await handle.createWritable(); await w.write(Uint8Array.from(atob(hck_b64), c => c.charCodeAt(0))); await w.close();
// image_b64 를 <img>나 캔버스로 표시. "누구에게서 받은 파일입니다: parent.actor.name" 안내
```
- `showOpenFilePicker` + `createWritable`은 크롬·엣지에서 동작 (사파리 X) → 시연은 크롬
- 크롬이 "이 파일을 수정하도록 허용할까요?" 물으면 허용 (시연 전 미리 한 번 해두기)
- 신원: 사내(A, B)는 계정 선택, 외부(C, D)는 처음 열 때 이름 + 전화번호 입력(시연용 흉내). 기기 ID는 `localStorage`에 uuid 저장
- 다운로드 버튼 없음, 이미지는 화면 표시만

## 한계 (발표 때 솔직하게)
- 화면을 캡처·촬영해 그림이 되면 그 뒤는 범위 밖 (이번 PoC는 파일 경로 추적만)
- 열기 전에 파일을 복사해 두 곳에 보내면 같은 부모에서 가지가 두 개 생김 → 서버 트리에서 보이고, 파일 쪽은 각자 자기 가지만 가짐
- 서버 비밀키가 털리면 위조 가능 → 키 관리가 핵심
