package com.inu.jeongbobada.support;

import com.inu.jeongbobada.domain.document.Document;
import com.inu.jeongbobada.domain.document.DocumentRepository;
import com.inu.jeongbobada.domain.recipient.Recipient;
import com.inu.jeongbobada.domain.recipient.RecipientRepository;
import com.inu.jeongbobada.domain.recipient.RecipientType;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.List;
import javax.imageio.ImageIO;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * 테스트 공용 도우미. 스프링 컨텍스트(H2)를 테스트 클래스끼리 공유하므로 각 테스트 앞뒤로 모든 테이블을 비운다.
 */
public final class TestSupport {

    private static final List<String> TABLES =
            List.of("analysis", "detection", "uploaded_file", "recipient", "document");

    private TestSupport() {
    }

    /** FK 순서와 상관없이 비운다 (사본 자기 참조 포함) */
    public static void cleanDatabase(JdbcTemplate jdbcTemplate) {
        jdbcTemplate.execute("SET REFERENTIAL_INTEGRITY FALSE");
        try {
            TABLES.forEach(table -> jdbcTemplate.execute("TRUNCATE TABLE " + table));
        } finally {
            jdbcTemplate.execute("SET REFERENTIAL_INTEGRITY TRUE");
        }
    }

    public static byte[] png(int width, int height) {
        return image("png", width, height);
    }

    public static byte[] jpeg(int width, int height) {
        return image("jpeg", width, height);
    }

    private static byte[] image(String format, int width, int height) {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        image.setRGB(1, 1, 0xFF0000);
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try {
            ImageIO.write(image, format, bytes);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return bytes.toByteArray();
    }

    public static Document document(DocumentRepository repository, String docCode) {
        return repository.save(Document.builder().docCode(docCode).title("OLED 설계도").build());
    }

    /**
     * 원본에서 시작하는 일직선 배포 경로를 만든다.
     *
     * @param names 원본 다음부터 순서대로 사본 이름. 경로 길이 = names.length + 1
     * @return 만든 사본 (원본에 가까운 순)
     */
    public static List<Recipient> chain(RecipientRepository repository, Document document, String codePrefix,
                                        long idBase, String... names) {
        List<Recipient> copies = new ArrayList<>();
        Recipient parent = null;
        for (int i = 0; i < names.length; i++) {
            parent = repository.save(Recipient.builder()
                    .recipientId(idBase + i)
                    .name(names[i])
                    .width(1024).height(768)
                    .document(document)
                    .parentRecipient(parent)
                    .copyCode("%s%02d".formatted(codePrefix, i + 1))
                    .recipientType(i == 0 ? RecipientType.EMPLOYEE : RecipientType.PARTNER)
                    .build());
            copies.add(parent);
        }
        return copies;
    }
}
