package com.inu.jeongbobada.domain.detection;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.inu.jeongbobada.domain.recipient.Recipient;
import com.inu.jeongbobada.domain.recipient.RecipientRepository;
import com.inu.jeongbobada.global.engine.EngineCandidate;
import com.inu.jeongbobada.global.engine.EngineClient;
import com.inu.jeongbobada.global.exception.ApiException;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

@SpringBootTest
@AutoConfigureMockMvc
class DetectionControllerTest {

    private static final long HONG = 2624297755L;
    private static final long KIM = 1309005247L;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JsonMapper jsonMapper;

    @Autowired
    private RecipientRepository recipientRepository;

    @Autowired
    private DetectionRepository detectionRepository;

    @MockitoBean
    private EngineClient engineClient;

    private final MockMultipartFile photo =
            new MockMultipartFile("photo", "photo.jpg", "image/jpeg", new byte[]{1, 2, 3});

    @BeforeEach
    void setUp() {
        detectionRepository.deleteAll();
        recipientRepository.deleteAll();
        recipientRepository.saveAll(List.of(
                Recipient.builder().recipientId(HONG).name("홍길동").width(1024).height(768).build(),
                Recipient.builder().recipientId(KIM).name("김철수").width(1600).height(900).build()));
    }

    @Test
    void 유출자를_찾으면_ID를_이름으로_바꿔_응답하고_이력을_남긴다() throws Exception {
        given(engineClient.detect(any(MultipartFile.class), anyList(), eq("1,2,3,4,5,6,7,8")))
                .willReturn(engineResponse("""
                        {"found": true, "recipientId": %d, "via": "match", "z": 7.7, "z2": 0.1,
                         "threshold": 5.0,
                         "ranking": [{"id": %d, "z": 7.7}, {"id": %d, "z": 0.1}],
                         "restoredJpeg": "abc"}
                        """.formatted(HONG, HONG, KIM)));

        mockMvc.perform(multipart("/api/detections").file(photo).param("corners", "1,2,3,4,5,6,7,8"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.found").value(true))
                .andExpect(jsonPath("$.recipientId").value(HONG))
                .andExpect(jsonPath("$.name").value("홍길동"))
                .andExpect(jsonPath("$.ranking[0].name").value("홍길동"))
                .andExpect(jsonPath("$.ranking[0].z").value(7.7))
                .andExpect(jsonPath("$.ranking[1].name").value("김철수"))
                .andExpect(jsonPath("$.ranking[0].id").doesNotExist())
                .andExpect(jsonPath("$.restoredJpeg").value("abc"));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<EngineCandidate>> candidates = ArgumentCaptor.forClass(List.class);
        org.mockito.Mockito.verify(engineClient).detect(any(MultipartFile.class), candidates.capture(), any());
        assertThat(candidates.getValue()).containsExactlyInAnyOrder(
                new EngineCandidate(HONG, 1024, 768), new EngineCandidate(KIM, 1600, 900));

        assertThat(detectionRepository.findAll()).singleElement().satisfies(d -> {
            assertThat(d.isFound()).isTrue();
            assertThat(d.getRecipientId()).isEqualTo(HONG);
            assertThat(d.getZ()).isEqualTo(7.7);
            assertThat(d.getVia()).isEqualTo("match");
        });
    }

    @Test
    void 문서를_찾지_못하면_엔진_결과를_그대로_돌려주고_이력을_남긴다() throws Exception {
        given(engineClient.detect(any(MultipartFile.class), anyList(), any()))
                .willReturn(engineResponse("{\"found\": false, \"error\": \"NO_DOCUMENT\", \"elapsedMs\": 120.0}"));

        mockMvc.perform(multipart("/api/detections").file(photo))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.found").value(false))
                .andExpect(jsonPath("$.error").value("NO_DOCUMENT"))
                .andExpect(jsonPath("$.name").isEmpty());

        assertThat(detectionRepository.findAll()).singleElement().satisfies(d -> {
            assertThat(d.isFound()).isFalse();
            assertThat(d.getRecipientId()).isNull();
            assertThat(d.getError()).isEqualTo("NO_DOCUMENT");
        });
    }

    @Test
    void 사진이_없으면_400() throws Exception {
        mockMvc.perform(multipart("/api/detections").param("corners", ""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("촬영 사진을 올려주세요"));
    }

    @Test
    void 엔진_오류는_502로_응답한다() throws Exception {
        given(engineClient.detect(any(MultipartFile.class), anyList(), any()))
                .willThrow(new ApiException(HttpStatus.BAD_GATEWAY, "엔진 오류: 엔진에 연결할 수 없습니다"));

        mockMvc.perform(multipart("/api/detections").file(photo))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.error").value("엔진 오류: 엔진에 연결할 수 없습니다"));

        assertThat(detectionRepository.findAll()).isEmpty();
    }

    private ObjectNode engineResponse(String json) {
        return (ObjectNode) jsonMapper.readTree(json);
    }
}
