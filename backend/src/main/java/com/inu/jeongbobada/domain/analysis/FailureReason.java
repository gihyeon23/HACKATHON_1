package com.inu.jeongbobada.domain.analysis;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 분석 실패 사유.
 */
@Getter
@RequiredArgsConstructor
public enum FailureReason {

    /** 이미지에서 문서(테두리)를 찾지 못함 */
    NO_DOCUMENT("이미지에서 문서를 찾지 못했습니다"),
    /** 문서는 찾았지만 워터마크가 검출되지 않음 */
    NOT_FOUND("워터마크를 검출하지 못했습니다"),
    /** 워터마크는 검출됐지만 대장(배포 기록)에 없는 ID */
    NOT_REGISTERED("워터마크는 검출됐지만 배포 기록에 없는 사본입니다"),
    /** 엔진 호출 실패 */
    ENGINE_ERROR("분석 엔진 오류로 분석하지 못했습니다"),
    /** 파일 읽기 등 서버 내부 오류 */
    INTERNAL_ERROR("서버 오류로 분석하지 못했습니다");

    private final String message;
}
