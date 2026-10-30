package com.inu.jeongbobada.domain.analysis.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.inu.jeongbobada.domain.analysis.repository.AnalysisRepository;
import com.inu.jeongbobada.domain.detection.repository.DetectionRepository;
import com.inu.jeongbobada.domain.document.entity.Document;
import com.inu.jeongbobada.domain.document.repository.DocumentRepository;
import com.inu.jeongbobada.domain.file.entity.UploadedFile;
import com.inu.jeongbobada.domain.file.repository.UploadedFileRepository;
import com.inu.jeongbobada.domain.recipient.repository.RecipientRepository;
import com.inu.jeongbobada.global.config.AsyncConfig;
import com.inu.jeongbobada.global.engine.EngineClient;
import com.inu.jeongbobada.global.storage.FileStorage;
import com.inu.jeongbobada.support.TestSupport;
import java.time.Duration;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executor;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

@SpringBootTest
@AutoConfigureMockMvc
class AnalysisControllerTest {

    private static final long B_ID = 100L;
    private static final long C_ID = 101L;
    private static final Duration TIMEOUT = Duration.ofSeconds(10);

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JsonMapper jsonMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private DocumentRepository documentRepository;

    @Autowired
    private RecipientRepository recipientRepository;

    @Autowired
    private DetectionRepository detectionRepository;

    @Autowired
    private UploadedFileRepository uploadedFileRepository;

    @Autowired
    private AnalysisRepository analysisRepository;

    @Autowired
    private FileStorage fileStorage;

    @Autowired
    @Qualifier(AsyncConfig.ANALYSIS_EXECUTOR)
    private Executor analysisExecutor;

    @MockitoBean
    private EngineClient engineClient;

    /** 엔진 호출을 붙잡아 두어 "호출 중" 상태를 만든다 */
    private final CountDownLatch engineRelease = new CountDownLatch(1);

    @BeforeEach
    void setUp() {
        TestSupport.cleanDatabase(jdbcTemplate);
        Document document = TestSupport.document(documentRepository, "DOC-A001");
        // DOC-A001 → 직원 B(COPY-B01) → 협력사 C(COPY-B02)
        TestSupport.chain(recipientRepository, document, "COPY-B", B_ID, "직원 B", "협력사 C");
    }

    @AfterEach
    void tearDown() {
        engineRelease.countDown();
        awaitWorkersIdle();
        TestSupport.cleanDatabase(jdbcTemplate);
    }

    @Test
    void 분석은_RUNNING에서_COMPLETED로_바뀌고_결과의_경로_길이는_경로_API와_같다() throws Exception {
        engineReturns(blocking("""
                {"found": true, "recipientId": %d, "via": "coherent", "z": 7.7, "z2": 0.1, "threshold": 5.0,
                 "ranking": [{"id": %d, "z": 7.7}], "restoredJpeg": "abc"}
                """.formatted(C_ID, C_ID)));
        String fileId = upload();

        String analysisId = startAnalysis(fileId);

        // 엔진 호출 중: RUNNING, 워터마크 단계 진행 중
        await().atMost(TIMEOUT).untilAsserted(() -> mockMvc.perform(get("/api/analyses/{id}", analysisId))
                .andExpect(jsonPath("$.status").value("RUNNING"))
                .andExpect(jsonPath("$.steps[0].status").value("DONE"))
                .andExpect(jsonPath("$.steps[1].name").value("워터마크 분석"))
                .andExpect(jsonPath("$.steps[1].status").value("RUNNING"))
                .andExpect(jsonPath("$.steps[2].status").value("PENDING")));
        JsonNode running = poll(analysisId);
        assertThat(running.get("progress").asInt()).isBetween(10, 89);
        assertThat(running.get("steps").get(1).get("progress").asInt()).isLessThan(100);
        mockMvc.perform(get("/api/analyses/{id}/result", analysisId))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ANALYSIS_RUNNING"));

        engineRelease.countDown();

        await().atMost(TIMEOUT).until(() -> "COMPLETED".equals(poll(analysisId).get("status").asString()));
        mockMvc.perform(get("/api/analyses/{id}", analysisId))
                .andExpect(jsonPath("$.progress").value(100))
                .andExpect(jsonPath("$.steps[*].status").value(org.hamcrest.Matchers.everyItem(
                        org.hamcrest.Matchers.is("DONE"))))
                .andExpect(jsonPath("$.steps[*].progress").value(org.hamcrest.Matchers.everyItem(
                        org.hamcrest.Matchers.is(100))));

        int pathLength = jsonMapper.readTree(mockMvc.perform(get("/api/copies/COPY-B02/path"))
                .andReturn().getResponse().getContentAsString()).size();
        mockMvc.perform(get("/api/analyses/{id}/result", analysisId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.copyCode").value("COPY-B02"))
                .andExpect(jsonPath("$.recipientName").value("협력사 C"))
                .andExpect(jsonPath("$.document.docCode").value("DOC-A001"))
                .andExpect(jsonPath("$.document.title").value("OLED 설계도"))
                .andExpect(jsonPath("$.z").value(7.7))
                .andExpect(jsonPath("$.threshold").value(5.0))
                .andExpect(jsonPath("$.detectionLevel").value("HIGH"))
                .andExpect(jsonPath("$.confidence").doesNotExist())
                .andExpect(jsonPath("$.method").value("이미지 워터마크 검출 (FFT)"))
                .andExpect(jsonPath("$.file.fileId").value(fileId))
                .andExpect(jsonPath("$.file.format").value("PNG"))
                .andExpect(jsonPath("$.analyzedAt").isNotEmpty())
                .andExpect(jsonPath("$.distributionSteps").value(pathLength))
                .andExpect(jsonPath("$.distributionSteps").value(3))
                .andExpect(jsonPath("$.pathSummary").value("원본 → 직원 B → 협력사 C"))
                .andExpect(jsonPath("$.path.length()").value(pathLength));

        // 검출 이력도 남고 분석과 연결된다
        assertThat(detectionRepository.findAll()).singleElement().satisfies(d -> {
            assertThat(d.isFound()).isTrue();
            assertThat(d.getRecipientId()).isEqualTo(C_ID);
        });
        Long linkedDetection = jdbcTemplate.queryForObject(
                "select detection_id from analysis where analysis_id = ?", Long.class, analysisId);
        assertThat(linkedDetection).isEqualTo(detectionRepository.findAll().get(0).getId());

        // 완료 후 파일은 바로 지우지 않고 1시간 뒤 삭제 예약
        UploadedFile file = uploadedFileRepository.findByFileId(fileId).orElseThrow();
        assertThat(file.isDeleted()).isFalse();
        assertThat(file.getDeleteAfter()).isAfter(java.time.LocalDateTime.now().plusMinutes(55));
    }

    @Test
    void 엔진_호출_중_취소하면_CANCELED가_되고_파일은_즉시_삭제되며_늦게_온_결과는_버린다() throws Exception {
        engineReturns(blocking("""
                {"found": true, "recipientId": %d, "z": 7.7, "threshold": 5.0, "ranking": []}
                """.formatted(C_ID)));
        String fileId = upload();
        String storedName = uploadedFileRepository.findByFileId(fileId).orElseThrow().getStoredName();
        String analysisId = startAnalysis(fileId);
        await().atMost(TIMEOUT).until(() -> "RUNNING".equals(
                poll(analysisId).get("steps").get(1).get("status").asString()));

        mockMvc.perform(delete("/api/analyses/{id}", analysisId))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/analyses/{id}", analysisId))
                .andExpect(jsonPath("$.status").value("CANCELED"));
        assertThat(fileStorage.exists(FileStorage.UPLOADS, storedName)).isFalse();
        mockMvc.perform(get("/api/files/{fileId}/image", fileId))
                .andExpect(status().isNotFound());

        // 엔진 응답이 늦게 도착해도 결과·이력은 저장되지 않는다
        engineRelease.countDown();
        awaitWorkersIdle();
        mockMvc.perform(get("/api/analyses/{id}", analysisId))
                .andExpect(jsonPath("$.status").value("CANCELED"));
        assertThat(detectionRepository.findAll()).isEmpty();
        assertThat(analysisRepository.findByAnalysisId(analysisId).orElseThrow().getRecipient()).isNull();
        mockMvc.perform(get("/api/analyses/{id}/result", analysisId))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ANALYSIS_CANCELED"));

        // 다시 취소해도 그대로 성공
        mockMvc.perform(delete("/api/analyses/{id}", analysisId))
                .andExpect(status().isNoContent());
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "{\"found\": false, \"error\": \"NO_DOCUMENT\", \"elapsedMs\": 1.0}|NO_DOCUMENT",
            "{\"found\": false, \"recipientId\": null, \"z\": 2.1, \"threshold\": 5.0, \"ranking\": []}|NOT_FOUND",
            "{\"found\": true, \"recipientId\": 999999, \"z\": 6.0, \"threshold\": 5.0, \"ranking\": []}|NOT_REGISTERED"
    })
    void 실패_사유를_구분해_FAILED로_돌려준다(String engineJson, String reason) throws Exception {
        engineReturns(engineResponse(engineJson));
        String analysisId = startAnalysis(upload());

        await().atMost(TIMEOUT).until(() -> "FAILED".equals(poll(analysisId).get("status").asString()));
        mockMvc.perform(get("/api/analyses/{id}", analysisId))
                .andExpect(jsonPath("$.failureReason").value(reason))
                .andExpect(jsonPath("$.failureMessage").isNotEmpty());
        mockMvc.perform(get("/api/analyses/{id}/result", analysisId))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(reason));
        assertThat(detectionRepository.findAll()).hasSize(1);
    }

    @Test
    void 엔진_오류면_ENGINE_ERROR로_FAILED() throws Exception {
        given(engineClient.detectWithReferences(any(Resource.class), any(MediaType.class), anyList(), anyList()))
                .willThrow(new com.inu.jeongbobada.global.exception.ApiException(
                        org.springframework.http.HttpStatus.BAD_GATEWAY, "엔진 오류: 엔진에 연결할 수 없습니다"));
        String analysisId = startAnalysis(upload());

        await().atMost(TIMEOUT).until(() -> "FAILED".equals(poll(analysisId).get("status").asString()));
        mockMvc.perform(get("/api/analyses/{id}", analysisId))
                .andExpect(jsonPath("$.failureReason").value("ENGINE_ERROR"));
        assertThat(detectionRepository.findAll()).isEmpty();
    }

    @Test
    void 없는_파일로_분석하면_404() throws Exception {
        mockMvc.perform(post("/api/analyses").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fileId\": \"nope\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("FILE_NOT_FOUND"));
    }

    private String upload() throws Exception {
        String body = mockMvc.perform(multipart("/api/files")
                        .file(new MockMultipartFile("file", "leak.png", "image/png", TestSupport.png(40, 30))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return jsonMapper.readTree(body).get("fileId").asString();
    }

    private String startAnalysis(String fileId) throws Exception {
        String body = mockMvc.perform(post("/api/analyses").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fileId\": \"%s\"}".formatted(fileId)))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.analysisId").isNotEmpty())
                .andReturn().getResponse().getContentAsString();
        return jsonMapper.readTree(body).get("analysisId").asString();
    }

    private JsonNode poll(String analysisId) throws Exception {
        return jsonMapper.readTree(mockMvc.perform(get("/api/analyses/{id}", analysisId))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }

    private void engineReturns(org.mockito.stubbing.Answer<ObjectNode> answer) {
        given(engineClient.detectWithReferences(any(Resource.class), any(MediaType.class), anyList(), anyList()))
                .willAnswer(answer);
    }

    private void engineReturns(ObjectNode response) {
        engineReturns(invocation -> response);
    }

    private org.mockito.stubbing.Answer<ObjectNode> blocking(String json) {
        ObjectNode response = engineResponse(json);
        return invocation -> {
            assertThat(engineRelease.await(TIMEOUT.toSeconds(), TimeUnit.SECONDS)).isTrue();
            return response;
        };
    }

    private ObjectNode engineResponse(String json) {
        return (ObjectNode) jsonMapper.readTree(json);
    }

    private void awaitWorkersIdle() {
        ThreadPoolTaskExecutor executor = (ThreadPoolTaskExecutor) analysisExecutor;
        await().atMost(TIMEOUT).until(() -> executor.getActiveCount() == 0
                && executor.getThreadPoolExecutor().getQueue().isEmpty());
    }
}
