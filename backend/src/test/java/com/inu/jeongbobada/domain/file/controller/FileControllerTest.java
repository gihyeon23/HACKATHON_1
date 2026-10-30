package com.inu.jeongbobada.domain.file.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.inu.jeongbobada.domain.file.entity.UploadedFile;
import com.inu.jeongbobada.domain.file.repository.UploadedFileRepository;
import com.inu.jeongbobada.domain.file.service.FileService;
import com.inu.jeongbobada.global.engine.EngineClient;
import com.inu.jeongbobada.global.storage.FileStorage;
import com.inu.jeongbobada.support.TestSupport;
import java.nio.file.Files;
import java.util.Arrays;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest
@AutoConfigureMockMvc
class FileControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JsonMapper jsonMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private UploadedFileRepository uploadedFileRepository;

    @Autowired
    private FileStorage fileStorage;

    @MockitoBean
    private EngineClient engineClient;

    @BeforeEach
    void setUp() {
        TestSupport.cleanDatabase(jdbcTemplate);
    }

    @AfterEach
    void tearDown() {
        TestSupport.cleanDatabase(jdbcTemplate);
    }

    @Test
    void PNG를_올리면_메타데이터를_돌려주고_UUID_이름으로_암호화해_저장한다() throws Exception {
        byte[] png = TestSupport.png(40, 30);

        String body = mockMvc.perform(multipart("/api/files")
                        .file(new MockMultipartFile("file", "leak.png", "image/png", png)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("leak.png"))
                .andExpect(jsonPath("$.size").value(png.length))
                .andExpect(jsonPath("$.width").value(40))
                .andExpect(jsonPath("$.height").value(30))
                .andExpect(jsonPath("$.format").value("PNG"))
                .andReturn().getResponse().getContentAsString();
        String fileId = jsonMapper.readTree(body).get("fileId").asString();

        UploadedFile saved = uploadedFileRepository.findByFileId(fileId).orElseThrow();
        assertThat(saved.getStoredName()).doesNotContain("leak").hasSize(36);
        byte[] onDisk = Files.readAllBytes(fileStorage.resolve(FileStorage.UPLOADS, saved.getStoredName()));
        assertThat(onDisk).isNotEqualTo(png);
        assertThat(Arrays.copyOf(onDisk, 4)).isNotEqualTo(Arrays.copyOf(png, 4));

        mockMvc.perform(get("/api/files/{fileId}/image", fileId))
                .andExpect(status().isOk())
                .andExpect(content().contentType("image/png"))
                .andExpect(content().bytes(png));
    }

    @Test
    void JPG도_올릴_수_있다() throws Exception {
        mockMvc.perform(multipart("/api/files")
                        .file(new MockMultipartFile("file", "leak.JPG", "image/jpeg", TestSupport.jpeg(20, 10))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.format").value("JPEG"));
    }

    @Test
    void 허용되지_않는_확장자는_415_UNSUPPORTED_FORMAT() throws Exception {
        mockMvc.perform(multipart("/api/files")
                        .file(new MockMultipartFile("file", "leak.gif", "image/gif", "GIF89a".getBytes())))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.code").value("UNSUPPORTED_FORMAT"));
    }

    @Test
    void 확장자와_파일_시그니처가_다르면_415() throws Exception {
        mockMvc.perform(multipart("/api/files")
                        .file(new MockMultipartFile("file", "leak.png", "image/png", TestSupport.jpeg(20, 10))))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.code").value("UNSUPPORTED_FORMAT"));
    }

    @Test
    void 용량이_50MB를_넘으면_413_FILE_TOO_LARGE() throws Exception {
        byte[] huge = new byte[(int) FileService.MAX_SIZE + 1];
        System.arraycopy(TestSupport.png(4, 4), 0, huge, 0, 8);

        mockMvc.perform(multipart("/api/files").file(new MockMultipartFile("file", "big.png", "image/png", huge)))
                .andExpect(status().isContentTooLarge())
                .andExpect(jsonPath("$.code").value("FILE_TOO_LARGE"));
        assertThat(uploadedFileRepository.findAll()).isEmpty();
    }

    @Test
    void 파일이_없으면_400() throws Exception {
        mockMvc.perform(multipart("/api/files"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("EMPTY_FILE"));
    }

    @Test
    void 데모_이미지가_준비되면_업로드_파일로_등록한다() throws Exception {
        fileStorage.write(FileStorage.DEMO, FileService.DEMO_IMAGE, TestSupport.jpeg(64, 48));
        try {
            JsonNode body = jsonMapper.readTree(mockMvc.perform(post("/api/files/demo"))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.format").value("JPEG"))
                    .andExpect(jsonPath("$.width").value(64))
                    .andReturn().getResponse().getContentAsString());
            assertThat(body.get("fileId").asString()).isNotBlank();
        } finally {
            fileStorage.delete(FileStorage.DEMO, FileService.DEMO_IMAGE);
        }

        mockMvc.perform(post("/api/files/demo"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("DEMO_NOT_READY"));
    }
}
