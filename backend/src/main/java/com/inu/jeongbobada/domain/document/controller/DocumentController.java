package com.inu.jeongbobada.domain.document.controller;

import com.inu.jeongbobada.domain.document.dto.DocumentResponse;
import com.inu.jeongbobada.domain.document.service.DocumentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
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
}
