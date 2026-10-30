"""시연 리허설: A 생성 → B·C·D 순서로 열기 → demo/found_D.hck 저장 (샘플 데이터).

  python rehearsal.py [--gap 초]
"""
import argparse
import time

import cv2

import hck_service as svc
from sample_doc import SAMPLE_PATH, make_sample_doc

PEOPLE = [
    '{"kind":"internal","id":"B","device":"LAPTOP-B7"}',
    '{"kind":"external","name":"이OO","phone":"010-1234-1234","device":"MAC-C3"}',
    '{"kind":"external","name":"최OO","phone":"010-5678-5678","device":"PC-D9"}',
]


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--gap", type=float, default=2, help="열람 사이 대기 초")
    args = p.parse_args()

    if not SAMPLE_PATH.exists():
        SAMPLE_PATH.parent.mkdir(exist_ok=True)
        cv2.imwrite(str(SAMPLE_PATH), make_sample_doc())
    creator = svc.resolve_actor('{"kind":"internal","id":"A","device":"LAPTOP-A1"}')
    data, doc_id = svc.create_document(SAMPLE_PATH.read_bytes(), "Q4 신제품 설계도", creator)
    for raw in PEOPLE:
        time.sleep(args.gap)
        data = svc.open_document(data, svc.resolve_actor(raw))["file"]

    out = SAMPLE_PATH.parent / "found_D.hck"
    out.write_bytes(data)
    trace = svc.build_trace(data)
    print(" → ".join(f"{n['actor']['name']}({n['at_kst'][11:]})" for n in trace["path"]))
    print(f"최초 외부 유출: {trace['first_external']['from']} → {trace['first_external']['to']}")
    print(f"저장: {out} ({doc_id})")


if __name__ == "__main__":
    main()
