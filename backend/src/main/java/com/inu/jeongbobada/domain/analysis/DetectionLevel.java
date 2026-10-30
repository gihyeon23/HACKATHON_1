package com.inu.jeongbobada.domain.analysis;

/**
 * 검출 강도 등급. z-score 를 임의의 확률(%)로 바꾸지 않고, 판정 임계와의 차이로만 나눈다.
 * HIGH: z ≥ threshold + 2 / MEDIUM: z ≥ threshold / LOW: 그 외
 */
public enum DetectionLevel {
    HIGH,
    MEDIUM,
    LOW;

    private static final double HIGH_MARGIN = 2.0;

    public static DetectionLevel of(double z, double threshold) {
        if (z >= threshold + HIGH_MARGIN) {
            return HIGH;
        }
        return z >= threshold ? MEDIUM : LOW;
    }
}
