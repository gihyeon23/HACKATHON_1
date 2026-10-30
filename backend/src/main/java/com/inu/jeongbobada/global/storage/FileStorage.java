package com.inu.jeongbobada.global.storage;

import com.inu.jeongbobada.global.crypto.FileCipher;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 디스크 파일 저장소. 파일명은 서버가 만든 이름(UUID, 코드)만 받는다.
 */
@Component
@RequiredArgsConstructor
public class FileStorage {

    public static final String DOCUMENTS = "documents";
    public static final String COPIES = "copies";
    public static final String UPLOADS = "uploads";
    public static final String DEMO = "demo";

    /** 경로 조작 방지: 영문·숫자·-·_·. 만 허용 */
    private static final Pattern SAFE_NAME = Pattern.compile("[A-Za-z0-9_.-]+");

    private final StorageProperties properties;
    private final FileCipher fileCipher;

    public void write(String category, String name, byte[] content) {
        Path path = resolve(category, name);
        try {
            Files.createDirectories(path.getParent());
            Files.write(path, content);
        } catch (IOException e) {
            throw new UncheckedIOException("파일 저장 실패: " + category + "/" + name, e);
        }
    }

    public byte[] read(String category, String name) {
        try {
            return Files.readAllBytes(resolve(category, name));
        } catch (IOException e) {
            throw new UncheckedIOException("파일 읽기 실패: " + category + "/" + name, e);
        }
    }

    public void writeEncrypted(String category, String name, byte[] content) {
        write(category, name, fileCipher.encrypt(content));
    }

    public byte[] readEncrypted(String category, String name) {
        return fileCipher.decrypt(read(category, name));
    }

    public boolean exists(String category, String name) {
        return Files.isRegularFile(resolve(category, name));
    }

    public void delete(String category, String name) {
        try {
            Files.deleteIfExists(resolve(category, name));
        } catch (IOException e) {
            throw new UncheckedIOException("파일 삭제 실패: " + category + "/" + name, e);
        }
    }

    public Path resolve(String category, String name) {
        if (!SAFE_NAME.matcher(name).matches() || name.startsWith(".")) {
            throw new IllegalArgumentException("허용되지 않는 파일명입니다");
        }
        return Path.of(properties.dir(), category, name).toAbsolutePath().normalize();
    }
}
