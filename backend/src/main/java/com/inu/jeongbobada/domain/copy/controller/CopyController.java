package com.inu.jeongbobada.domain.copy.controller;

import com.inu.jeongbobada.domain.copy.dto.PathNode;
import com.inu.jeongbobada.domain.copy.service.LineageService;
import com.inu.jeongbobada.domain.recipient.entity.Recipient;
import com.inu.jeongbobada.domain.recipient.repository.RecipientRepository;
import com.inu.jeongbobada.global.exception.ApiException;
import com.inu.jeongbobada.global.exception.ErrorCode;
import com.inu.jeongbobada.global.storage.FileStorage;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/copies")
@RequiredArgsConstructor
public class CopyController {

    private final LineageService lineageService;
    private final RecipientRepository recipientRepository;
    private final FileStorage fileStorage;

    /** 식별된 사본에서 원본 문서까지의 배포 경로 (원본 → 중간 사본 → 식별된 사본) */
    @GetMapping("/{copyCode}/path")
    public List<PathNode> path(@PathVariable String copyCode) {
        return lineageService.trace(copyCode);
    }

    /** 배포본 PNG. ?download=1 이면 첨부 다운로드 */
    @GetMapping("/{copyCode}/file")
    public ResponseEntity<byte[]> file(
            @PathVariable String copyCode,
            @RequestParam(value = "download", required = false) String download
    ) {
        Recipient copy = recipientRepository.findByCopyCode(copyCode)
                .filter(r -> r.getFileName() != null && fileStorage.exists(FileStorage.COPIES, r.getFileName()))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCode.COPY_NOT_FOUND,
                        "배포본 파일이 없습니다: " + copyCode));
        ContentDisposition disposition = ("1".equals(download)
                ? ContentDisposition.attachment() : ContentDisposition.inline())
                .filename(copyCode + ".png")
                .build();
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .body(fileStorage.read(FileStorage.COPIES, copy.getFileName()));
    }
}
