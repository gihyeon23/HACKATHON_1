package com.inu.jeongbobada.global.crypto;

import com.inu.jeongbobada.global.storage.StorageProperties;
import java.nio.ByteBuffer;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * 업로드 파일 암호화 (AES-256-GCM). 저장 형식: IV(12바이트) + 암호문(인증 태그 포함).
 */
@Component
public class FileCipher {

    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int IV_LENGTH = 12;
    private static final int TAG_BITS = 128;

    private final SecretKey key;
    private final SecureRandom random = new SecureRandom();

    public FileCipher(StorageProperties properties) {
        this.key = parseKey(properties.encryptionKey());
    }

    public byte[] encrypt(byte[] plain) {
        byte[] iv = new byte[IV_LENGTH];
        random.nextBytes(iv);
        try {
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
            byte[] encrypted = cipher.doFinal(plain);
            return ByteBuffer.allocate(IV_LENGTH + encrypted.length).put(iv).put(encrypted).array();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("파일 암호화에 실패했습니다", e);
        }
    }

    public byte[] decrypt(byte[] stored) {
        if (stored.length < IV_LENGTH) {
            throw new IllegalStateException("암호화 파일 형식이 올바르지 않습니다");
        }
        try {
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, stored, 0, IV_LENGTH));
            return cipher.doFinal(stored, IV_LENGTH, stored.length - IV_LENGTH);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("파일 복호화에 실패했습니다 (키가 바뀌었거나 파일이 손상됨)", e);
        }
    }

    /** 키가 없거나 잘못되면 기동 시점에 바로 실패시킨다. */
    private static SecretKey parseKey(String encoded) {
        if (!StringUtils.hasText(encoded)) {
            throw new IllegalStateException(
                    "FILE_ENCRYPTION_KEY 환경변수가 필요합니다 (생성: openssl rand -base64 32)");
        }
        byte[] raw;
        try {
            raw = Base64.getDecoder().decode(encoded.trim());
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("FILE_ENCRYPTION_KEY 는 base64 문자열이어야 합니다");
        }
        if (raw.length != 32) {
            throw new IllegalStateException("FILE_ENCRYPTION_KEY 는 32바이트(AES-256)여야 합니다");
        }
        return new SecretKeySpec(raw, "AES");
    }
}
