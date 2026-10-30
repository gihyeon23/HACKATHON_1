package com.inu.jeongbobada.domain.document;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 원본 문서. 사본(Recipient)은 모두 이 문서의 이미지에 워터마크를 삽입해 만든다.
 */
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Document {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 표시용 문서 ID (예: DOC-A001) */
    @Column(nullable = false, unique = true, length = 20)
    private String docCode;

    @Column(nullable = false)
    private String title;

    /** 저장된 원본 이미지 파일명 (documents/). 이미지 없이 등록하면 null → 엔진 샘플 문서 사용 */
    private String imageName;

    private Integer width;

    private Integer height;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Builder
    private Document(String docCode, String title, String imageName, Integer width, Integer height) {
        this.docCode = docCode;
        this.title = title;
        this.imageName = imageName;
        this.width = width;
        this.height = height;
        this.createdAt = LocalDateTime.now();
    }
}
