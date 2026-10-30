package com.inu.jeongbobada.domain.copy.service;

import com.inu.jeongbobada.domain.copy.dto.CopyIssueCommand;
import com.inu.jeongbobada.domain.copy.dto.CopyResponse;
import com.inu.jeongbobada.domain.document.entity.Document;
import com.inu.jeongbobada.domain.document.repository.DocumentRepository;
import com.inu.jeongbobada.domain.recipient.entity.Recipient;
import com.inu.jeongbobada.domain.recipient.repository.RecipientRepository;
import com.inu.jeongbobada.global.engine.EngineClient;
import com.inu.jeongbobada.global.exception.ApiException;
import com.inu.jeongbobada.global.exception.ErrorCode;
import com.inu.jeongbobada.global.storage.FileStorage;
import java.security.SecureRandom;
import java.util.Base64;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

/**
 * 배포 대상별 사본 발급.
 * 엔진 호출이 길어질 수 있어 트랜잭션으로 묶지 않는다.
 */
@Service
@RequiredArgsConstructor
public class CopyIssueService {

    private static final int MAX_CODE_ATTEMPTS = 100;

    private final DocumentRepository documentRepository;
    private final RecipientRepository recipientRepository;
    private final EngineClient engineClient;
    private final FileStorage fileStorage;
    private final SecureRandom random = new SecureRandom();

    /**
     * 사본 발급: 고유 recipientId 발급 → /v1/embed → 배포본 PNG 저장 → 대장 등록.
     * 워터마크는 부모 사본이 아니라 항상 원본 문서 이미지에 삽입한다 (워터마크가 겹치지 않도록).
     */
    public CopyResponse issueCopy(CopyIssueCommand command) {
        Document document = documentRepository.findByDocCode(command.docCode())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCode.DOCUMENT_NOT_FOUND,
                        "등록되지 않은 문서입니다: " + command.docCode()));
        if (!StringUtils.hasText(command.name())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.INVALID_REQUEST, "배포 대상 이름을 입력해주세요");
        }
        if (command.recipientType() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.INVALID_REQUEST,
                    "배포 대상 유형(EMPLOYEE, PARTNER)을 선택해주세요");
        }
        Recipient parent = findParent(command.parentCopyCode(), document);
        String copyCode = command.copyCode() != null ? command.copyCode() : nextCopyCode();
        long recipientId = nextRecipientId();

        ObjectNode embedded = engineClient.embed(recipientId, documentImage(document));
        byte[] png = decodePng(embedded);
        String fileName = copyCode + ".png";
        fileStorage.write(FileStorage.COPIES, fileName, png);

        Recipient recipient = recipientRepository.save(Recipient.builder()
                .recipientId(recipientId)
                .name(command.name().trim())
                .width(embedded.path("width").asInt())
                .height(embedded.path("height").asInt())
                .document(document)
                .parentRecipient(parent)
                .copyCode(copyCode)
                .recipientType(command.recipientType())
                .fileName(fileName)
                .build());

        return new CopyResponse(copyCode, recipientId, document.getDocCode(), recipient.getName(),
                recipient.getRecipientType(), parent != null ? parent.getCopyCode() : null,
                recipient.getWidth(), recipient.getHeight(),
                doubleOrNull(embedded, "strength"), doubleOrNull(embedded, "predictedZ"),
                doubleOrNull(embedded, "threshold"), doubleOrNull(embedded, "psnr"),
                doubleOrNull(embedded, "ssim"), doubleOrNull(embedded, "elapsedMs"),
                "/api/copies/" + copyCode + "/file");
    }

    private Recipient findParent(String parentCopyCode, Document document) {
        if (!StringUtils.hasText(parentCopyCode)) {
            return null;
        }
        Recipient parent = recipientRepository.findByCopyCode(parentCopyCode)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCode.COPY_NOT_FOUND,
                        "부모 사본이 없습니다: " + parentCopyCode));
        if (parent.getDocument() == null || !parent.getDocument().getId().equals(document.getId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.INVALID_REQUEST,
                    "부모 사본이 다른 문서의 사본입니다: " + parentCopyCode);
        }
        return parent;
    }

    private Resource documentImage(Document document) {
        if (document.getImageName() == null) {
            return null;
        }
        byte[] content = fileStorage.read(FileStorage.DOCUMENTS, document.getImageName());
        return EngineClient.namedResource(content, document.getImageName());
    }

    /** 엔진이 준 배포본 PNG. 내용은 로그에 남기지 않는다. */
    private static byte[] decodePng(JsonNode embedded) {
        JsonNode png = embedded.get("imagePng");
        if (png == null || !png.isString()) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "엔진 오류: 배포본 이미지가 없습니다");
        }
        try {
            return Base64.getDecoder().decode(png.asString());
        } catch (IllegalArgumentException e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "엔진 오류: 배포본 이미지 형식이 올바르지 않습니다");
        }
    }

    /** COPY-[A-Z]\d{3} 무작위, 겹치면 다시 뽑는다 */
    private String nextCopyCode() {
        for (int i = 0; i < MAX_CODE_ATTEMPTS; i++) {
            String code = "COPY-%c%03d".formatted((char) ('A' + random.nextInt(26)), random.nextInt(1000));
            if (!recipientRepository.existsByCopyCode(code)) {
                return code;
            }
        }
        throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "사본 ID 를 만들지 못했습니다");
    }

    /** 0 ~ 2^32-1 무작위, 겹치면 다시 뽑는다 */
    private long nextRecipientId() {
        for (int i = 0; i < MAX_CODE_ATTEMPTS; i++) {
            long id = Integer.toUnsignedLong(random.nextInt());
            if (!recipientRepository.existsByRecipientId(id)) {
                return id;
            }
        }
        throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "수신자 ID 를 만들지 못했습니다");
    }

    private static Double doubleOrNull(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value != null && value.isNumber() ? value.asDouble() : null;
    }
}
