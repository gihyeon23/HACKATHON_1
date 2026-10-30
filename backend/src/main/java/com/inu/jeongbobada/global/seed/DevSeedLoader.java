package com.inu.jeongbobada.global.seed;

import com.inu.jeongbobada.domain.copy.dto.CopyIssueCommand;
import com.inu.jeongbobada.domain.copy.service.CopyIssueService;
import com.inu.jeongbobada.domain.document.entity.Document;
import com.inu.jeongbobada.domain.document.repository.DocumentRepository;
import com.inu.jeongbobada.domain.file.service.FileService;
import com.inu.jeongbobada.domain.recipient.entity.RecipientType;
import com.inu.jeongbobada.domain.recipient.repository.RecipientRepository;
import com.inu.jeongbobada.global.engine.EngineClient;
import com.inu.jeongbobada.global.exception.ApiException;
import com.inu.jeongbobada.global.storage.FileStorage;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * dev 프로필 시드: 원본 DOC-A001 에서 3·5·7단계 배포 경로를 만든다.
 * 사본은 실제로 엔진 /v1/embed 를 호출해 만들며, 엔진이 꺼져 있으면 경고만 남기고 건너뛴다.
 * 이미 있는 문서·사본은 다시 만들지 않는다 (중간에 실패했으면 다음 기동 때 나머지를 채운다).
 */
@Slf4j
@Component
@Profile("dev")
@RequiredArgsConstructor
public class DevSeedLoader implements ApplicationRunner {

    private static final String DOC_CODE = "DOC-A001";
    private static final String DOC_TITLE = "OLED 설계도";
    /** 데모 촬영 이미지의 출처 사본 (3단계 경로의 끝) */
    private static final String DEMO_SOURCE = "COPY-C203";

    private static final RecipientType E = RecipientType.EMPLOYEE;
    private static final RecipientType P = RecipientType.PARTNER;

    /** 부모가 먼저 오도록 정렬. 세 경로 모두 원본에서 바로 분기한다 */
    private static final List<SeedCopy> COPIES = List.of(
            // 3단계: DOC-A001 → 직원 B → 협력사 C
            new SeedCopy("COPY-B102", "직원 B", E, null),
            new SeedCopy("COPY-C203", "협력사 C", P, "COPY-B102"),
            // 5단계: DOC-A001 → 직원 D → 협력사 E → 협력사 F → 협력사 G
            new SeedCopy("COPY-D110", "직원 D", E, null),
            new SeedCopy("COPY-E214", "협력사 E", P, "COPY-D110"),
            new SeedCopy("COPY-F305", "협력사 F", P, "COPY-E214"),
            new SeedCopy("COPY-G407", "협력사 G", P, "COPY-F305"),
            // 7단계: DOC-A001 → 직원 H → 직원 J → 협력사 K → 협력사 M → 협력사 N → 협력사 P
            new SeedCopy("COPY-H120", "직원 H", E, null),
            new SeedCopy("COPY-J131", "직원 J", E, "COPY-H120"),
            new SeedCopy("COPY-K220", "협력사 K", P, "COPY-J131"),
            new SeedCopy("COPY-M318", "협력사 M", P, "COPY-K220"),
            new SeedCopy("COPY-N402", "협력사 N", P, "COPY-M318"),
            new SeedCopy("COPY-P509", "협력사 P", P, "COPY-N402"));

    private final EngineClient engineClient;
    private final DocumentRepository documentRepository;
    private final RecipientRepository recipientRepository;
    private final CopyIssueService copyIssueService;
    private final FileStorage fileStorage;

    @Override
    public void run(ApplicationArguments args) {
        boolean seeded = documentRepository.findByDocCode(DOC_CODE).isPresent()
                && COPIES.stream().allMatch(c -> recipientRepository.existsByCopyCode(c.copyCode()));
        if (seeded && fileStorage.exists(FileStorage.DEMO, FileService.DEMO_IMAGE)) {
            log.info("[시드] 이미 준비되어 있어 건너뜁니다");
            return;
        }
        if (!engineClient.isAvailable()) {
            log.warn("[시드] 워터마크 엔진에 연결할 수 없어 시드를 건너뜁니다 (엔진 실행 후 백엔드를 다시 시작하세요)");
            return;
        }
        try {
            seed();
            createDemoImage();
        } catch (ApiException e) {
            log.warn("[시드] 중단: {} (다음 기동 때 나머지를 채웁니다)", e.getMessage());
        }
    }

    private void seed() {
        if (documentRepository.findByDocCode(DOC_CODE).isEmpty()) {
            // 이미지 없이 등록 → 엔진의 샘플 문서에 워터마크를 삽입한다
            documentRepository.save(Document.builder().docCode(DOC_CODE).title(DOC_TITLE).build());
        }
        for (SeedCopy copy : COPIES) {
            if (recipientRepository.existsByCopyCode(copy.copyCode())) {
                continue;
            }
            copyIssueService.issueCopy(new CopyIssueCommand(
                    DOC_CODE, copy.name(), copy.type(), copy.parentCopyCode(), copy.copyCode()));
            log.info("[시드] 사본 발급: {} ({})", copy.copyCode(), copy.name());
        }
    }

    private void createDemoImage() {
        if (fileStorage.exists(FileStorage.DEMO, FileService.DEMO_IMAGE)) {
            return;
        }
        String fileName = recipientRepository.findByCopyCode(DEMO_SOURCE).orElseThrow().getFileName();
        byte[] captured = DemoImageGenerator.capture(fileStorage.read(FileStorage.COPIES, fileName));
        fileStorage.write(FileStorage.DEMO, FileService.DEMO_IMAGE, captured);
        log.info("[시드] 데모 촬영 이미지 생성: {} 배포본 기반", DEMO_SOURCE);
    }

    private record SeedCopy(String copyCode, String name, RecipientType type, String parentCopyCode) {
    }
}
