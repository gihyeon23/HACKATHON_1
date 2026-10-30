package com.inu.jeongbobada.domain.file;

import com.inu.jeongbobada.global.storage.ImageFormat;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 분석용 업로드 파일. 디스크에는 UUID 이름으로 암호화해 저장하고, 원래 이름은 DB 에만 둔다.
 */
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UploadedFile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 외부에 노출하는 ID (UUID) */
    @Column(nullable = false, unique = true, length = 36)
    private String fileId;

    @Column(nullable = false)
    private String originalName;

    /** 디스크 파일명 (UUID, uploads/) */
    @Column(nullable = false, length = 36)
    private String storedName;

    @Column(nullable = false)
    private Long size;

    @Column(nullable = false)
    private Integer width;

    @Column(nullable = false)
    private Integer height;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private ImageFormat format;

    /** 이 시각이 지나면 스케줄러가 디스크 파일을 지운다 */
    @Column(nullable = false)
    private LocalDateTime deleteAfter;

    /** 디스크 파일이 지워졌는지 */
    @Column(nullable = false)
    private boolean deleted;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Builder
    private UploadedFile(String fileId, String originalName, String storedName, Long size,
                         Integer width, Integer height, ImageFormat format, LocalDateTime deleteAfter) {
        this.fileId = fileId;
        this.originalName = originalName;
        this.storedName = storedName;
        this.size = size;
        this.width = width;
        this.height = height;
        this.format = format;
        this.deleteAfter = deleteAfter;
        this.createdAt = LocalDateTime.now();
    }

    public void scheduleDeletion(LocalDateTime deleteAfter) {
        this.deleteAfter = deleteAfter;
    }

    public void markDeleted() {
        this.deleted = true;
    }
}
