package com.inu.jeongbobada.domain.hck.dto;

/**
 * 보호 파일(.hck) 장부 한 줄. 서버만 만들 수 있다 (hash 는 앞 줄과 사슬로 연결, sig 는 서버 HMAC).
 *
 * @param event          ISSUE: 플랫폼에서 발급 / OPEN: 뷰어로 열어 열람자 사본 발급 / CLAIM: 사본 주인이 처음 열어 기기 연결
 * @param parentCopyCode 앞 줄의 사본. 원본에서 바로 발급된 첫 줄이면 null
 * @param viewer         열람 기기 식별값의 HMAC (원래 값은 남기지 않는다). 발급 줄이면 null
 * @param at             서버 시각 (KST, 초 단위)
 */
public record HckEntry(
        int seq,
        String event,
        String docCode,
        String copyCode,
        String parentCopyCode,
        String name,
        String recipientType,
        String viewer,
        String at,
        String parentHash,
        String hash,
        String sig
) {

    public static final String ISSUE = "ISSUE";
    public static final String OPEN = "OPEN";
    public static final String CLAIM = "CLAIM";
    public static final String GENESIS = "GENESIS";
}
