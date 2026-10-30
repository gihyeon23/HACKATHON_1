package com.inu.jeongbobada.domain.analysis;

import com.inu.jeongbobada.domain.detection.Detection;
import com.inu.jeongbobada.domain.detection.DetectionService;
import com.inu.jeongbobada.domain.file.UploadedFile;
import com.inu.jeongbobada.domain.recipient.Recipient;
import com.inu.jeongbobada.domain.recipient.RecipientRepository;
import com.inu.jeongbobada.global.config.AsyncConfig;
import com.inu.jeongbobada.global.engine.EngineCandidate;
import com.inu.jeongbobada.global.engine.EngineClient;
import com.inu.jeongbobada.global.exception.ApiException;
import com.inu.jeongbobada.global.storage.FileStorage;
import com.inu.jeongbobada.global.storage.ImageFormat;
import com.inu.jeongbobada.global.storage.StorageProperties;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.function.Consumer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

/**
 * 분석을 별도 스레드에서 단계별로 실행한다.
 * 각 단계 전환은 짧은 트랜잭션으로 저장하고, 그사이 취소됐으면 이후 결과를 버린다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AnalysisWorker {

    /** /v1/detect 의 reference 최대 장수 */
    private static final int MAX_REFERENCES = 10;
    private static final String NO_DOCUMENT = "NO_DOCUMENT";

    private final AnalysisRepository analysisRepository;
    private final RecipientRepository recipientRepository;
    private final DetectionService detectionService;
    private final EngineClient engineClient;
    private final FileStorage fileStorage;
    private final StorageProperties storageProperties;
    private final TransactionTemplate transactionTemplate;

    @Async(AsyncConfig.ANALYSIS_EXECUTOR)
    public void run(String analysisId) {
        try {
            // 1. 파일 검증 및 전처리: 복호화 후 형식 재확인
            StoredFile file = transactionTemplate.execute(status -> StoredFile.of(load(analysisId).getFile()));
            byte[] photo = fileStorage.readEncrypted(FileStorage.UPLOADS, file.storedName());
            ImageFormat format = ImageFormat.detect(file.originalName(), photo);
            EngineInput input = transactionTemplate.execute(status -> engineInput());

            // 2. 워터마크 분석
            if (!advance(analysisId, a -> a.startWatermark(LocalDateTime.now()))) {
                return;
            }
            ObjectNode result = engineClient.detectWithReferences(
                    EngineClient.namedResource(photo, file.storedName() + "." + format.name().toLowerCase(Locale.ROOT)),
                    format.mediaType(), input.candidates(), input.references());

            // 3. 문서 및 배포 기록 조회
            if (!advance(analysisId, a -> a.startLookup(LocalDateTime.now()))) {
                return;
            }
            finish(analysisId, result);
        } catch (ObjectOptimisticLockingFailureException e) {
            log.info("분석이 취소되어 결과를 버립니다: analysisId={}", analysisId);
        } catch (ApiException e) {
            log.warn("분석 실패: analysisId={}, {}", analysisId, e.getMessage());
            failQuietly(analysisId, e.getStatus().is5xxServerError()
                    ? FailureReason.ENGINE_ERROR : FailureReason.INTERNAL_ERROR);
        } catch (RuntimeException e) {
            log.error("분석 중 오류: analysisId={}", analysisId, e);
            failQuietly(analysisId, FailureReason.INTERNAL_ERROR);
        }
    }

    /** 엔진 결과로 사본을 찾고 판정을 저장한다. 취소와 충돌하면 트랜잭션째 롤백되어 이력도 남지 않는다. */
    private void finish(String analysisId, JsonNode result) {
        transactionTemplate.executeWithoutResult(status -> {
            Analysis analysis = load(analysisId);
            if (!analysis.isRunning()) {
                return;
            }
            Detection detection = detectionService.record(result);
            Double threshold = result.hasNonNull("threshold") ? result.get("threshold").asDouble() : null;
            LocalDateTime now = LocalDateTime.now();

            Optional<Recipient> identified = identify(result);
            FailureReason reason = failureReason(result, identified);
            if (reason == null) {
                analysis.complete(identified.get(), detection, threshold, now);
            } else {
                analysis.reject(reason, detection, threshold, now);
            }
            analysis.getFile().scheduleDeletion(now.plus(storageProperties.uploadRetention()));
            analysisRepository.saveAndFlush(analysis);
        });
    }

    private Optional<Recipient> identify(JsonNode result) {
        JsonNode id = result.get("recipientId");
        if (!result.path("found").asBoolean(false) || id == null || !id.isNumber()) {
            return Optional.empty();
        }
        return recipientRepository.findByRecipientId(id.asLong());
    }

    /** null 이면 성공 */
    private static FailureReason failureReason(JsonNode result, Optional<Recipient> identified) {
        if (NO_DOCUMENT.equals(result.path("error").asString(null))) {
            return FailureReason.NO_DOCUMENT;
        }
        if (!result.path("found").asBoolean(false)) {
            return FailureReason.NOT_FOUND;
        }
        // 계보 정보가 없는 이전 대장 항목도 경로를 만들 수 없으므로 미등록으로 본다
        boolean registered = identified
                .filter(r -> r.getCopyCode() != null && r.getDocument() != null)
                .isPresent();
        return registered ? null : FailureReason.NOT_REGISTERED;
    }

    /** 후보 = 대장 전체, 기준 이미지 = 문서별 최신 배포본 1장 (최대 10장) */
    private EngineInput engineInput() {
        List<EngineCandidate> candidates = recipientRepository.findAll().stream()
                .map(r -> new EngineCandidate(r.getRecipientId(), r.getWidth(), r.getHeight()))
                .toList();

        Map<Long, Recipient> latestByDocument = new LinkedHashMap<>();
        for (Recipient copy : recipientRepository.findByFileNameIsNotNullOrderByIdDesc()) {
            if (latestByDocument.size() >= MAX_REFERENCES) {
                break;
            }
            if (copy.getDocument() != null) {
                latestByDocument.putIfAbsent(copy.getDocument().getId(), copy);
            }
        }
        List<Resource> references = new ArrayList<>();
        for (Recipient copy : latestByDocument.values()) {
            if (fileStorage.exists(FileStorage.COPIES, copy.getFileName())) {
                references.add(EngineClient.namedResource(
                        fileStorage.read(FileStorage.COPIES, copy.getFileName()), copy.getFileName()));
            }
        }
        return new EngineInput(candidates, references);
    }

    /** 진행 중일 때만 상태를 바꾼다. 이미 취소됐으면 false */
    private boolean advance(String analysisId, Consumer<Analysis> change) {
        Boolean advanced = transactionTemplate.execute(status -> {
            Analysis analysis = load(analysisId);
            if (!analysis.isRunning()) {
                return false;
            }
            change.accept(analysis);
            analysisRepository.saveAndFlush(analysis);
            return true;
        });
        return Boolean.TRUE.equals(advanced);
    }

    private void failQuietly(String analysisId, FailureReason reason) {
        try {
            advance(analysisId, a -> a.fail(reason, LocalDateTime.now()));
        } catch (RuntimeException e) {
            log.info("실패 상태 저장 생략 (이미 취소됨): analysisId={}", analysisId);
        }
    }

    private Analysis load(String analysisId) {
        return analysisRepository.findByAnalysisId(analysisId)
                .orElseThrow(() -> new IllegalStateException("분석이 없습니다: " + analysisId));
    }

    /** 트랜잭션 밖에서 쓰는 업로드 파일 정보 (지연 로딩 프록시를 넘기지 않는다) */
    private record StoredFile(String storedName, String originalName) {

        static StoredFile of(UploadedFile file) {
            return new StoredFile(file.getStoredName(), file.getOriginalName());
        }
    }

    private record EngineInput(List<EngineCandidate> candidates, List<Resource> references) {
    }
}
