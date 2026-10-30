package com.inu.jeongbobada.domain.analysis.dto;

import com.inu.jeongbobada.domain.analysis.entity.Analysis;
import com.inu.jeongbobada.domain.analysis.entity.AnalysisStatus;
import com.inu.jeongbobada.domain.analysis.entity.FailureReason;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 분석 진행 상태 (프론트가 1초마다 폴링).
 *
 * <p>워터마크 분석 단계는 엔진 호출 한 번이라 중간 진행률을 알 수 없으므로,
 * 호출 중에는 경과 시간으로 추정(최대 95%)하고 응답이 오면 100%로 맞춘다.
 */
public record AnalysisStatusResponse(
        String analysisId,
        String fileId,
        AnalysisStatus status,
        FailureReason failureReason,
        String failureMessage,
        int progress,
        long elapsedMs,
        List<Step> steps
) {

    /** 추정 진행률 상한과 시간 상수: 95 × (1 − e^(−t/3s)) */
    private static final double ESTIMATE_MAX = 95.0;
    private static final double ESTIMATE_TAU_MS = 3000.0;
    private static final int RUNNING_STEP_PROGRESS = 50;

    public record Step(AnalysisStep key, String name, StepStatus status, int progress) {
    }

    public static AnalysisStatusResponse of(Analysis analysis, LocalDateTime now) {
        // 끝난 분석은 끝난 시각 기준으로 멈춘다
        LocalDateTime until = analysis.getFinishedAt() != null ? analysis.getFinishedAt() : now;

        List<Step> steps = List.of(
                step(AnalysisStep.VALIDATE, analysis.getValidateStartedAt(), analysis.getValidateEndedAt(), until),
                step(AnalysisStep.WATERMARK, analysis.getWatermarkStartedAt(), analysis.getWatermarkEndedAt(), until),
                step(AnalysisStep.LOOKUP, analysis.getLookupStartedAt(), analysis.getLookupEndedAt(), until));

        int progress = analysis.getStatus() == AnalysisStatus.COMPLETED ? 100 : (int) Math.round(steps.stream()
                .mapToDouble(s -> s.key().getWeight() * s.progress() / 100.0)
                .sum());

        FailureReason reason = analysis.getFailureReason();
        return new AnalysisStatusResponse(
                analysis.getAnalysisId(),
                analysis.getFile().getFileId(),
                analysis.getStatus(),
                reason,
                reason != null ? reason.getMessage() : null,
                progress,
                Duration.between(analysis.getStartedAt(), until).toMillis(),
                steps);
    }

    private static Step step(AnalysisStep key, LocalDateTime startedAt, LocalDateTime endedAt, LocalDateTime until) {
        if (endedAt != null) {
            return new Step(key, key.getLabel(), StepStatus.DONE, 100);
        }
        if (startedAt == null) {
            return new Step(key, key.getLabel(), StepStatus.PENDING, 0);
        }
        int progress = key == AnalysisStep.WATERMARK
                ? estimate(Duration.between(startedAt, until).toMillis())
                : RUNNING_STEP_PROGRESS;
        return new Step(key, key.getLabel(), StepStatus.RUNNING, progress);
    }

    static int estimate(long elapsedMs) {
        return (int) Math.floor(ESTIMATE_MAX * (1 - Math.exp(-Math.max(0, elapsedMs) / ESTIMATE_TAU_MS)));
    }
}
