package com.inu.jeongbobada.domain.file;

import com.inu.jeongbobada.global.exception.ApiException;
import com.inu.jeongbobada.global.exception.ErrorCode;
import com.inu.jeongbobada.global.storage.FileStorage;
import com.inu.jeongbobada.global.storage.ImageFormat;
import com.inu.jeongbobada.global.storage.ImageInspector;
import com.inu.jeongbobada.global.storage.StorageProperties;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.LocalDateTime;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * 분석용 이미지 업로드. 파일 내용은 로그에 남기지 않는다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FileService {

    /** 업로드 최대 크기 (multipart 설정과 같은 50MB) */
    public static final long MAX_SIZE = 50L * 1024 * 1024;

    /** 데모 이미지: dev 시드가 배포본으로 만든 촬영 시뮬레이션 이미지 (demo/) */
    public static final String DEMO_IMAGE = "captured.jpg";
    private static final String DEMO_DISPLAY_NAME = "demo_captured.jpg";

    private final UploadedFileRepository uploadedFileRepository;
    private final FileStorage fileStorage;
    private final StorageProperties storageProperties;

    @Transactional
    public FileResponse upload(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.EMPTY_FILE, "파일을 올려주세요");
        }
        if (file.getSize() > MAX_SIZE) {
            throw tooLarge();
        }
        return store(file.getOriginalFilename(), bytes(file));
    }

    @Transactional
    public FileResponse uploadDemo() {
        if (!fileStorage.exists(FileStorage.DEMO, DEMO_IMAGE)) {
            throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.DEMO_NOT_READY,
                    "데모 이미지가 아직 없습니다 (dev 프로필 시드가 엔진과 함께 실행되어야 합니다)");
        }
        return store(DEMO_DISPLAY_NAME, fileStorage.read(FileStorage.DEMO, DEMO_IMAGE));
    }

    /** 복호화한 원본 이미지 ('원본 보기') */
    @Transactional(readOnly = true)
    public StoredImage image(String fileId) {
        UploadedFile file = getAvailable(fileId);
        return new StoredImage(file, fileStorage.readEncrypted(FileStorage.UPLOADS, file.getStoredName()));
    }

    public UploadedFile getAvailable(String fileId) {
        return uploadedFileRepository.findByFileId(fileId)
                .filter(f -> !f.isDeleted())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCode.FILE_NOT_FOUND,
                        "파일이 없거나 보관 기간이 지나 삭제되었습니다"));
    }

    /** 디스크 파일을 바로 지운다 (취소된 분석) */
    @Transactional
    public void deleteNow(String fileId) {
        uploadedFileRepository.findByFileId(fileId).ifPresent(this::delete);
    }

    /** 보관 기간이 지난 업로드 파일 정리 */
    @Scheduled(fixedDelayString = "${storage.cleanup-interval:60s}")
    @Transactional
    public void deleteExpired() {
        for (UploadedFile file : uploadedFileRepository.findByDeletedFalseAndDeleteAfterBefore(LocalDateTime.now())) {
            delete(file);
            log.info("보관 기간이 지난 업로드 파일 삭제: fileId={}", file.getFileId());
        }
    }

    private void delete(UploadedFile file) {
        if (file.isDeleted()) {
            return;
        }
        fileStorage.delete(FileStorage.UPLOADS, file.getStoredName());
        file.markDeleted();
    }

    private FileResponse store(String originalName, byte[] content) {
        ImageFormat format = ImageFormat.detect(originalName, content);
        ImageInspector.Size size = ImageInspector.size(content);

        String storedName = UUID.randomUUID().toString();
        fileStorage.writeEncrypted(FileStorage.UPLOADS, storedName, content);

        UploadedFile saved = uploadedFileRepository.save(UploadedFile.builder()
                .fileId(UUID.randomUUID().toString())
                .originalName(originalName)
                .storedName(storedName)
                .size((long) content.length)
                .width(size.width())
                .height(size.height())
                .format(format)
                .deleteAfter(LocalDateTime.now().plus(storageProperties.unanalyzedRetention()))
                .build());
        return FileResponse.from(saved);
    }

    private static ApiException tooLarge() {
        return new ApiException(HttpStatus.CONTENT_TOO_LARGE, ErrorCode.FILE_TOO_LARGE, "파일이 너무 큽니다 (최대 50MB)");
    }

    private static byte[] bytes(MultipartFile file) {
        try {
            return file.getBytes();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public record StoredImage(UploadedFile file, byte[] content) {
    }
}
