package com.inu.jeongbobada.global.image;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Iterator;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;

/**
 * 이미지 전체를 디코딩하지 않고 헤더만 읽어 크기를 구한다 (50MB 이미지도 메모리 부담 없이).
 */
public final class ImageInspector {

    public record Size(int width, int height) {
    }

    private ImageInspector() {
    }

    public static Size size(byte[] content) {
        try (ImageInputStream input = ImageIO.createImageInputStream(new ByteArrayInputStream(content))) {
            Iterator<ImageReader> readers = input == null ? null : ImageIO.getImageReaders(input);
            if (readers == null || !readers.hasNext()) {
                throw ImageFormat.unsupported("이미지를 읽을 수 없습니다");
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(input, true, true);
                return new Size(reader.getWidth(0), reader.getHeight(0));
            } finally {
                reader.dispose();
            }
        } catch (IOException e) {
            throw ImageFormat.unsupported("이미지를 읽을 수 없습니다");
        }
    }
}
