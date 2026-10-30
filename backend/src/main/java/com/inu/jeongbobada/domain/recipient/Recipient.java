package com.inu.jeongbobada.domain.recipient;

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
 * 수신자 대장. 워터마크에 삽입된 recipientId 와 실제 이름을 연결한다.
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

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Builder
    private Recipient(Long recipientId, String name, Integer width, Integer height) {
        this.recipientId = recipientId;
        this.name = name;
        this.width = width;
        this.height = height;
        this.createdAt = LocalDateTime.now();
    }
}
