package com.inu.jeongbobada.domain.document.service;

import com.inu.jeongbobada.domain.document.dto.DocumentResponse;
import com.inu.jeongbobada.domain.document.entity.Document;
import com.inu.jeongbobada.domain.document.repository.DocumentRepository;
import com.inu.jeongbobada.global.exception.ApiException;
import com.inu.jeongbobada.global.exception.ErrorCode;
import com.inu.jeongbobada.global.image.ImageFormat;
import com.inu.jeongbobada.global.image.ImageInspector;
import com.inu.jeongbobada.global.storage.FileStorage;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

/**
 * 원본 문서 등록.
 */
@Service
@RequiredArgsConstructor
public class DocumentService {

    private static final String DOC_CODE_FORMAT = "DOC-A%03d";
    private static final String DOC_CODE_PREFIX = "DOC-A";

    private final DocumentRepository documentRepository;
    private final FileStorage fileStorage;

    /** 원본 문서 등록. 이미지가 없으면 사본 발급 시 엔진의 샘플 문서를 쓴다. */
    public DocumentResponse register(String title, MultipartFile image) {
        if (!StringUtils.hasText(title)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.INVALID_REQUEST, "문서 제목을 입력해주세요");
        }
        String docCode = nextDocCode();

        String imageName = null;
        Integer width = null;
        Integer height = null;
        if (image != null && !image.isEmpty()) {
            byte[] content = bytes(image);
            ImageFormat format = ImageFormat.detect(image.getOriginalFilename(), content);
            ImageInspector.Size size = ImageInspector.size(content);
            imageName = docCode + "." + format.name().toLowerCase(Locale.ROOT);
            fileStorage.write(FileStorage.DOCUMENTS, imageName, content);
            width = size.width();
            height = size.height();
        }

        Document document = documentRepository.save(Document.builder()
                .docCode(docCode).title(title.trim()).imageName(imageName).width(width).height(height)
                .build());
        return DocumentResponse.from(document);
    }

    private String nextDocCode() {
        int next = documentRepository.findTopByOrderByIdDesc()
                .map(Document::getDocCode)
                .filter(code -> code.startsWith(DOC_CODE_PREFIX))
                .map(code -> parseIntOrZero(code.substring(DOC_CODE_PREFIX.length())) + 1)
                .orElse(1);
        return DOC_CODE_FORMAT.formatted(next);
    }

    private static int parseIntOrZero(String value) {
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static byte[] bytes(MultipartFile file) {
        try {
            return file.getBytes();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
