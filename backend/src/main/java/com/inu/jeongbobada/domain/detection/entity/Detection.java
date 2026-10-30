package com.inu.jeongbobada.domain.detection.entity;

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
 * 유출자 검출 이력 (감사 로그).
 */
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Detection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private boolean found;

    /** 검출된 수신자 ID. 미검출이면 null */
    private Long recipientId;

    /** 1위 z-score */
    private Double z;

    /** match: 후보 상관 매칭 | rs: RS 블라인드 복호 */
    private String via;

    /** 엔진이 돌려준 실패 사유 (예: NO_DOCUMENT) */
    private String error;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Builder
    private Detection(boolean found, Long recipientId, Double z, String via, String error) {
        this.found = found;
        this.recipientId = recipientId;
        this.z = z;
        this.via = via;
        this.error = error;
        this.createdAt = LocalDateTime.now();
    }
}
