package com.inu.jeongbobada.domain.hck.controller;

import com.inu.jeongbobada.domain.hck.dto.HckOpenResponse;
import com.inu.jeongbobada.domain.hck.service.HckService;
import com.inu.jeongbobada.domain.recipient.entity.RecipientType;
import com.inu.jeongbobada.global.exception.ApiException;
import com.inu.jeongbobada.global.exception.ErrorCode;
import java.io.IOException;
import java.io.UncheckedIOException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequiredArgsConstructor
public class HckController {

    private static final MediaType HCK = MediaType.parseMediaType("application/x-hck");

    private final HckService hckService;

    /** 사본의 보호 파일(.hck) 내려받기 */
    @GetMapping("/api/copies/{copyCode}/hck")
    public ResponseEntity<byte[]> export(@PathVariable String copyCode) {
        return ResponseEntity.ok()
                .contentType(HCK)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(copyCode + ".hck").build().toString())
                .body(hckService.export(copyCode));
    }

    /** 보호 파일 열기: 열람자 사본 발급 + 장부 갱신 */
    @PostMapping(path = "/api/hck/open", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public HckOpenResponse open(
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "name", required = false) String name,
            @RequestParam(value = "recipientType", required = false) String recipientType,
            @RequestParam(value = "viewerId", required = false) String viewerId
    ) {
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.EMPTY_FILE, "보호 파일을 선택해주세요");
        }
        try {
            return hckService.open(file.getBytes(), name, parseType(recipientType), viewerId);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static RecipientType parseType(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return RecipientType.valueOf(value.trim());
        } catch (IllegalArgumentException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.INVALID_REQUEST,
                    "열람자 유형은 EMPLOYEE 또는 PARTNER 입니다");
        }
    }
}
