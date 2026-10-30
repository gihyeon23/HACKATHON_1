package com.inu.jeongbobada.domain.document;

import com.inu.jeongbobada.domain.recipient.RecipientType;
import com.inu.jeongbobada.global.exception.ApiException;
import com.inu.jeongbobada.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/documents")
@RequiredArgsConstructor
public class DocumentController {

    private final DocumentService documentService;

    /** 원본 문서 등록 */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public DocumentResponse register(
            @RequestParam(value = "title", required = false) String title,
            @RequestParam(value = "image", required = false) MultipartFile image
    ) {
        return documentService.register(title, image);
    }

    /** 배포 대상별 사본 발급 */
    @PostMapping(path = "/{docCode}/copies", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public CopyResponse issueCopy(
            @PathVariable String docCode,
            @RequestParam(value = "name", required = false) String name,
            @RequestParam(value = "recipientType", required = false) String recipientType,
            @RequestParam(value = "parentCopyCode", required = false) String parentCopyCode
    ) {
        return documentService.issueCopy(
                new CopyIssueCommand(docCode, name, parseType(recipientType), parentCopyCode, null));
    }

    private static RecipientType parseType(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return RecipientType.valueOf(value.trim());
        } catch (IllegalArgumentException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.INVALID_REQUEST,
                    "배포 대상 유형은 EMPLOYEE 또는 PARTNER 입니다");
        }
    }
}
