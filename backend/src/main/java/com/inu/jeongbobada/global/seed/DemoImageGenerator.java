package com.inu.jeongbobada.global.seed;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.awt.image.ConvolveOp;
import java.awt.image.Kernel;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;

/**
 * 배포본으로 "화면 촬영" 비슷한 데모 이미지를 만든다:
 * 어두운 배경 위 약간의 회전·기울임·확대 + 블러 + JPEG 재압축.
 * 엔진의 capture_sim.py 보다 약한 변형이다 (원근 변형·모아레 없음).
 */
public final class DemoImageGenerator {

    private static final Color BACKGROUND = new Color(35, 35, 35);
    private static final double CANVAS_RATIO = 1.25;
    private static final double ROTATE_DEGREES = 4.0;
    private static final double SHEAR = 0.03;
    private static final double ZOOM = 1.05;
    private static final float JPEG_QUALITY = 0.85f;

    private DemoImageGenerator() {
    }

    public static byte[] capture(byte[] png) {
        try {
            BufferedImage source = ImageIO.read(new ByteArrayInputStream(png));
            if (source == null) {
                throw new IllegalArgumentException("배포본 이미지를 읽을 수 없습니다");
            }
            return jpeg(blur(transform(source)));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static BufferedImage transform(BufferedImage source) {
        int width = (int) Math.round(source.getWidth() * CANVAS_RATIO);
        int height = (int) Math.round(source.getHeight() * CANVAS_RATIO);
        BufferedImage canvas = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = canvas.createGraphics();
        try {
            g.setColor(BACKGROUND);
            g.fillRect(0, 0, width, height);
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);

            AffineTransform t = new AffineTransform();
            t.translate(width / 2.0, height / 2.0);
            t.rotate(Math.toRadians(ROTATE_DEGREES));
            t.shear(SHEAR, 0);
            t.scale(ZOOM, ZOOM);
            t.translate(-source.getWidth() / 2.0, -source.getHeight() / 2.0);
            g.drawImage(source, t, null);
        } finally {
            g.dispose();
        }
        return canvas;
    }

    /** 3x3 가우시안 근사 */
    private static BufferedImage blur(BufferedImage image) {
        float[] kernel = {
                1 / 16f, 2 / 16f, 1 / 16f,
                2 / 16f, 4 / 16f, 2 / 16f,
                1 / 16f, 2 / 16f, 1 / 16f};
        BufferedImage out = new BufferedImage(image.getWidth(), image.getHeight(), BufferedImage.TYPE_INT_RGB);
        return new ConvolveOp(new Kernel(3, 3, kernel), ConvolveOp.EDGE_NO_OP, null).filter(image, out);
    }

    private static byte[] jpeg(BufferedImage image) throws IOException {
        ImageWriter writer = ImageIO.getImageWritersByFormatName("jpeg").next();
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ImageOutputStream output = ImageIO.createImageOutputStream(bytes)) {
            writer.setOutput(output);
            ImageWriteParam param = writer.getDefaultWriteParam();
            param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionQuality(JPEG_QUALITY);
            writer.write(null, new IIOImage(image, null, null), param);
        } finally {
            writer.dispose();
        }
        return bytes.toByteArray();
    }
}
