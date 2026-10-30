package com.inu.jeongbobada.domain.recipient.entity;

import com.inu.jeongbobada.domain.document.entity.Document;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 수신자 대장 = 배포 사본. 워터마크에 삽입된 recipientId 와 실제 이름, 배포 계보(부모 사본)를 연결한다.
 * 한 부모에서 여러 자식 사본이 나올 수 있는 트리 구조다.
 *
 * <p>계보 컬럼(document, copyCode ...)은 이전 데이터와 호환되도록 DB 에서는 nullable 이고,
 * 새 사본 발급 시 서비스에서 필수로 채운다.
 */
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Recipient {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 워터마크에 삽입된 32bit ID (0 ~ 2^32-1) */
    @Column(nullable = false, unique = true)
    private Long recipientId;

    @Column(nullable = false)
    private String name;

    /** 테두리 제외 원본 크기. 검출 시 엔진에 후보로 전달 */
    @Column(nullable = false)
    private Integer width;

    @Column(nullable = false)
    private Integer height;

    /** 원본 문서 */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_id")
    private Document document;

    /** 이 사본을 넘겨준 부모 사본. 원본 문서에서 바로 발급되면 null */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_recipient_id")
    private Recipient parentRecipient;

    /** 표시용 사본 ID (예: COPY-C203) */
    @Column(unique = true, length = 20)
    private String copyCode;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private RecipientType recipientType;

    /** 배포본 PNG 파일명 (copies/) */
    private String fileName;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Builder
    private Recipient(Long recipientId, String name, Integer width, Integer height, Document document,
                      Recipient parentRecipient, String copyCode, RecipientType recipientType, String fileName) {
        this.recipientId = recipientId;
        this.name = name;
        this.width = width;
        this.height = height;
        this.document = document;
        this.parentRecipient = parentRecipient;
        this.copyCode = copyCode;
        this.recipientType = recipientType;
        this.fileName = fileName;
        this.createdAt = LocalDateTime.now();
    }
}
