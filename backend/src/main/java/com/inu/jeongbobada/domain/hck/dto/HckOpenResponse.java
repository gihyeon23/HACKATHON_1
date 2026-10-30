package com.inu.jeongbobada.domain.hck.dto;

import java.util.List;

/**
 * 보호 파일 열람 결과.
 *
 * @param hckBase64      장부가 갱신된 새 .hck (다른 사람에게 전달할 때 이 파일을 보낸다)
 * @param copyCode       열람자 사본. 화면 이미지(imageUrl)에 이 사본의 워터마크가 들어 있다
 * @param parentCopyCode 이 파일을 넘겨준 사람의 사본
 * @param reopened       같은 기기가 다시 열어 새 사본을 만들지 않았으면 true
 */
public record HckOpenResponse(
        String hckBase64,
        String docCode,
        String title,
        String copyCode,
        String name,
        String parentCopyCode,
        String parentName,
        boolean reopened,
        String imageUrl,
        List<LedgerLine> ledger
) {

    /** 화면용 장부 요약 (해시 · 서명 · 기기값 제외) */
    public record LedgerLine(int seq, String event, String copyCode, String name, String recipientType) {
    }
}
