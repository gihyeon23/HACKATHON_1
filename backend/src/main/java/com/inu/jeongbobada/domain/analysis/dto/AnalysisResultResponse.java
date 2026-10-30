package com.inu.jeongbobada.domain.analysis.dto;

import com.inu.jeongbobada.domain.copy.dto.PathNode;
import com.inu.jeongbobada.domain.file.dto.FileResponse;
import com.inu.jeongbobada.domain.recipient.entity.RecipientType;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 분석 결과.
 *
 * @param z                 엔진이 준 1위 z-score (확률로 변환하지 않음)
 * @param threshold         엔진 판정 임계
 * @param detectionLevel    HIGH | MEDIUM | LOW
 * @param distributionSteps 배포 경로 길이 (원본 포함, 경로 API 배열 길이와 같음)
 * @param pathSummary       "원본 → 직원 B → 협력사 C"
 */
public record AnalysisResultResponse(
        String analysisId,
        String copyCode,
        String recipientName,
        RecipientType recipientType,
        DocumentInfo document,
        Double z,
        Double threshold,
        DetectionLevel detectionLevel,
        String via,
        LocalDateTime analyzedAt,
        String method,
        FileResponse file,
        int distributionSteps,
        String pathSummary,
        List<PathNode> path
) {

    public static final String METHOD = "이미지 워터마크 검출 (FFT)";

    public record DocumentInfo(String docCode, String title) {
    }
}
