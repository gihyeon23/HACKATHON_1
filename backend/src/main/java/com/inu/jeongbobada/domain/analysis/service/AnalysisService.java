package com.inu.jeongbobada.domain.analysis.service;

import com.inu.jeongbobada.domain.analysis.dto.AnalysisCreatedResponse;
import com.inu.jeongbobada.domain.analysis.dto.AnalysisRequest;
import com.inu.jeongbobada.domain.analysis.dto.AnalysisResultResponse;
import com.inu.jeongbobada.domain.analysis.dto.AnalysisStatusResponse;
import com.inu.jeongbobada.domain.analysis.dto.DetectionLevel;
import com.inu.jeongbobada.domain.analysis.entity.Analysis;
import com.inu.jeongbobada.domain.analysis.entity.AnalysisStatus;
import com.inu.jeongbobada.domain.analysis.repository.AnalysisRepository;
import com.inu.jeongbobada.domain.copy.dto.PathNode;
import com.inu.jeongbobada.domain.copy.service.LineageService;
import com.inu.jeongbobada.domain.detection.entity.Detection;
import com.inu.jeongbobada.domain.document.entity.Document;
import com.inu.jeongbobada.domain.file.dto.FileResponse;
import com.inu.jeongbobada.domain.file.entity.UploadedFile;
import com.inu.jeongbobada.domain.file.service.FileService;
import com.inu.jeongbobada.domain.recipient.entity.Recipient;
import com.inu.jeongbobada.global.exception.ApiException;
import com.inu.jeongbobada.global.exception.ErrorCode;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class AnalysisService {

    private final AnalysisRepository analysisRepository;
    private final AnalysisWorker analysisWorker;
    private final FileService fileService;
    private final LineageService lineageService;

    /**
     * 분석을 등록하고 바로 돌려준다. 실제 분석은 비동기로 진행된다.
     * 저장이 커밋된 뒤에 작업을 시작해야 하므로 트랜잭션으로 묶지 않는다.
     */
    public AnalysisCreatedResponse create(AnalysisRequest request) {
        if (request == null || !StringUtils.hasText(request.fileId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.INVALID_REQUEST, "fileId 가 필요합니다");
        }
        UploadedFile file = fileService.getAvailable(request.fileId());
        Analysis analysis = analysisRepository.save(Analysis.start(file));
        analysisWorker.run(analysis.getAnalysisId());
        return new AnalysisCreatedResponse(analysis.getAnalysisId());
    }

    @Transactional(readOnly = true)
    public AnalysisStatusResponse status(String analysisId) {
        return AnalysisStatusResponse.of(get(analysisId), LocalDateTime.now());
    }

    /** 취소: 진행 중이면 CANCELED 로 바꾸고 업로드 파일을 즉시 지운다. 이미 취소된 분석은 그대로 성공 처리 */
    @Transactional
    public void cancel(String analysisId) {
        Analysis analysis = get(analysisId);
        String fileId = analysis.getFile().getFileId();
        if (analysis.getStatus() == AnalysisStatus.CANCELED) {
            return;
        }
        int canceled = analysisRepository.cancelIfRunning(analysisId, LocalDateTime.now(),
                AnalysisStatus.RUNNING, AnalysisStatus.CANCELED);
        if (canceled == 0) {
            throw new ApiException(HttpStatus.CONFLICT, ErrorCode.ANALYSIS_FINISHED, "이미 끝난 분석은 취소할 수 없습니다");
        }
        fileService.deleteNow(fileId);
    }

    /** 결과. 경로 길이·요약은 경로 API 와 같은 LineageService 로 계산한다 */
    @Transactional(readOnly = true)
    public AnalysisResultResponse result(String analysisId) {
        Analysis analysis = get(analysisId);
        switch (analysis.getStatus()) {
            case RUNNING -> throw new ApiException(HttpStatus.CONFLICT, ErrorCode.ANALYSIS_RUNNING,
                    "분석이 아직 진행 중입니다");
            case CANCELED -> throw new ApiException(HttpStatus.CONFLICT, ErrorCode.ANALYSIS_CANCELED,
                    "취소된 분석입니다");
            case FAILED -> throw new ApiException(HttpStatus.CONFLICT, analysis.getFailureReason().name(),
                    analysis.getFailureReason().getMessage());
            case COMPLETED -> {
                // 아래에서 결과 구성
            }
        }

        Recipient copy = analysis.getRecipient();
        Document document = copy.getDocument();
        Detection detection = analysis.getDetection();
        List<PathNode> path = lineageService.trace(copy);
        Double z = detection != null ? detection.getZ() : null;
        Double threshold = analysis.getThreshold();

        return new AnalysisResultResponse(
                analysis.getAnalysisId(),
                copy.getCopyCode(),
                copy.getName(),
                copy.getRecipientType(),
                new AnalysisResultResponse.DocumentInfo(document.getDocCode(), document.getTitle()),
                z,
                threshold,
                z != null && threshold != null ? DetectionLevel.of(z, threshold) : null,
                detection != null ? detection.getVia() : null,
                analysis.getFinishedAt(),
                AnalysisResultResponse.METHOD,
                FileResponse.from(analysis.getFile()),
                path.size(),
                LineageService.summarize(path),
                path);
    }

    private Analysis get(String analysisId) {
        return analysisRepository.findByAnalysisId(analysisId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCode.ANALYSIS_NOT_FOUND,
                        "분석이 없습니다: " + analysisId));
    }
}
