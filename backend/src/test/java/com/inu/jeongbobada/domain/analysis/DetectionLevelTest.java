package com.inu.jeongbobada.domain.analysis;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class DetectionLevelTest {

    @Test
    void 임계와의_차이로_등급을_나눈다() {
        assertThat(DetectionLevel.of(7.0, 5.0)).isEqualTo(DetectionLevel.HIGH);
        assertThat(DetectionLevel.of(6.99, 5.0)).isEqualTo(DetectionLevel.MEDIUM);
        assertThat(DetectionLevel.of(5.0, 5.0)).isEqualTo(DetectionLevel.MEDIUM);
        assertThat(DetectionLevel.of(4.99, 5.0)).isEqualTo(DetectionLevel.LOW);
    }

    @Test
    void 워터마크_단계_진행률은_경과_시간으로_추정하고_95를_넘지_않는다() {
        assertThat(AnalysisStatusResponse.estimate(0)).isZero();
        assertThat(AnalysisStatusResponse.estimate(3000)).isBetween(55, 65);
        assertThat(AnalysisStatusResponse.estimate(600_000)).isEqualTo(95);
    }
}
