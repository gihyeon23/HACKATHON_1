package com.inu.jeongbobada.global.storage;

import com.inu.jeongbobada.global.exception.ApiException;
import com.inu.jeongbobada.global.exception.ErrorCode;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;

/**
 * 허용하는 이미지 형식 (PNG, JPEG). 확장자와 파일 시그니처가 모두 맞아야 한다.
 */
public enum ImageFormat {

    PNG(Set.of("png"), MediaType.IMAGE_PNG, new byte[]{(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'}),
    JPEG(Set.of("jpg", "jpeg"), MediaType.IMAGE_JPEG, new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF});

    private final Set<String> extensions;
    private final MediaType mediaType;
    private final byte[] signature;

    ImageFormat(Set<String> extensions, MediaType mediaType, byte[] signature) {
        this.extensions = extensions;
        this.mediaType = mediaType;
        this.signature = signature;
    }

    public MediaType mediaType() {
        return mediaType;
    }

    /** 확장자로 형식을 고르고, 실제 바이트가 그 형식의 시그니처로 시작하는지 확인한다. */
    public static ImageFormat detect(String filename, byte[] content) {
        String extension = extension(filename);
        ImageFormat format = Arrays.stream(values())
                .filter(f -> f.extensions.contains(extension))
                .findFirst()
                .orElseThrow(() -> unsupported("PNG, JPG, JPEG 파일만 올릴 수 있습니다"));
        if (!format.matches(content)) {
            throw unsupported("파일 내용이 " + format.name() + " 형식이 아닙니다");
        }
        return format;
    }

    private boolean matches(byte[] content) {
        if (content.length < signature.length) {
            return false;
        }
        return Arrays.equals(Arrays.copyOf(content, signature.length), signature);
    }

    private static String extension(String filename) {
        if (filename == null) {
            return "";
        }
        int dot = filename.lastIndexOf('.');
        return dot < 0 ? "" : filename.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    public static ApiException unsupported(String message) {
        return new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, ErrorCode.UNSUPPORTED_FORMAT, message);
    }
}
