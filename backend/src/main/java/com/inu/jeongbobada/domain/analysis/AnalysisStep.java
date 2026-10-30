package com.inu.jeongbobada.domain.analysis;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 분석 단계. weight 는 전체 진행률에서 차지하는 비중(%)이며 합이 100 이다.
 */
@Getter
@RequiredArgsConstructor
public enum AnalysisStep {

    VALIDATE("파일 검증 및 전처리", 10),
    WATERMARK("워터마크 분석", 80),
    LOOKUP("문서 및 배포 기록 조회", 10);

    private final String label;
    private final int weight;
}
