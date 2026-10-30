package com.inu.jeongbobada.domain.document;

import com.inu.jeongbobada.domain.recipient.RecipientType;

/**
 * 사본 발급 결과. 엔진의 삽입 품질 지표를 함께 돌려준다 (배포본 이미지는 fileUrl 로 받는다).
 */
public record CopyResponse(
        String copyCode,
        long recipientId,
        String docCode,
        String name,
        RecipientType recipientType,
        String parentCopyCode,
        Integer width,
        Integer height,
        Double strength,
        Double predictedZ,
        Double threshold,
        Double psnr,
        Double ssim,
        Double elapsedMs,
        String fileUrl
) {
}
