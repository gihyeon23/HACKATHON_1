package com.inu.jeongbobada.domain.copy.controller;

import com.inu.jeongbobada.domain.copy.dto.CopyIssueCommand;
import com.inu.jeongbobada.domain.copy.dto.CopyResponse;
import com.inu.jeongbobada.domain.copy.service.CopyIssueService;
import com.inu.jeongbobada.domain.recipient.entity.RecipientType;
import com.inu.jeongbobada.global.exception.ApiException;
import com.inu.jeongbobada.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class CopyIssueController {

    private final CopyIssueService copyIssueService;

    /** 배포 대상별 사본 발급 */
    @PostMapping(path = "/api/documents/{docCode}/copies", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public CopyResponse issueCopy(
            @PathVariable String docCode,
            @RequestParam(value = "name", required = false) String name,
            @RequestParam(value = "recipientType", required = false) String recipientType,
            @RequestParam(value = "parentCopyCode", required = false) String parentCopyCode
    ) {
        return copyIssueService.issueCopy(
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
