package com.inu.jeongbobada.global.storage;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * 파일 저장 설정.
 *
 * @param dir                 저장 루트 (하위에 documents/, copies/, uploads/, demo/)
 * @param encryptionKey       업로드 파일 AES-GCM 키 (base64, 32바이트). 환경변수 FILE_ENCRYPTION_KEY
 * @param uploadRetention     분석이 끝난 업로드 파일 보관 기간 ('원본 보기'용)
 * @param unanalyzedRetention 분석하지 않은 업로드 파일 보관 기간
 */
@ConfigurationProperties("storage")
public record StorageProperties(
        @DefaultValue("./data") String dir,
        String encryptionKey,
        @DefaultValue("1h") Duration uploadRetention,
        @DefaultValue("24h") Duration unanalyzedRetention
) {
}
