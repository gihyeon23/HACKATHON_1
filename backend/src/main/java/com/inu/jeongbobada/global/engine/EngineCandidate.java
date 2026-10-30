package com.inu.jeongbobada.global.engine;

/**
 * /v1/detect 의 candidates 항목. 배포 대상의 ID 와 원본 크기.
 */
public record EngineCandidate(long id, int width, int height) {
}
