package com.inu.jeongbobada.global.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.inu.jeongbobada.global.exception.ApiException;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

class EngineClientTest {

    private MockRestServiceServer server;
    private EngineClient engineClient;

    private final MockMultipartFile photo =
            new MockMultipartFile("photo", "photo.jpg", "image/jpeg", new byte[]{1, 2, 3});

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://engine");
        server = MockRestServiceServer.bindTo(builder).build();
        engineClient = new EngineClient(builder.build(), JsonMapper.builder().build());
    }

    @Test
    void 촬영본과_후보목록을_멀티파트로_보내고_엔진_응답을_돌려준다() {
        server.expect(requestTo("http://engine/v1/detect"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().string(containsString("name=\"photo\"")))
                .andExpect(content().string(containsString("[{\"id\":2624297755,\"width\":1024,\"height\":768}]")))
                .andExpect(content().string(containsString("1,2,3,4,5,6,7,8")))
                .andRespond(withSuccess("{\"found\":true,\"recipientId\":2624297755,\"z\":7.7}",
                        MediaType.APPLICATION_JSON));

        ObjectNode result = engineClient.detect(
                photo, List.of(new EngineCandidate(2624297755L, 1024, 768)), "1,2,3,4,5,6,7,8");

        assertThat(result.get("found").asBoolean()).isTrue();
        assertThat(result.get("recipientId").asLong()).isEqualTo(2624297755L);
        server.verify();
    }

    @Test
    void 기준_이미지를_reference_파트로_함께_보낸다() {
        server.expect(requestTo("http://engine/v1/detect"))
                .andExpect(content().string(containsString("name=\"photo\"; filename=\"leak.png\"")))
                .andExpect(content().string(containsString("name=\"reference\"; filename=\"COPY-C203.png\"")))
                .andRespond(withSuccess("{\"found\":false,\"error\":\"NO_DOCUMENT\"}", MediaType.APPLICATION_JSON));

        ObjectNode result = engineClient.detectWithReferences(
                EngineClient.namedResource(new byte[]{1, 2}, "leak.png"), MediaType.IMAGE_PNG,
                List.of(new EngineCandidate(1L, 10, 10)),
                List.of(EngineClient.namedResource(new byte[]{3, 4}, "COPY-C203.png")));

        assertThat(result.get("error").asString()).isEqualTo("NO_DOCUMENT");
        server.verify();
    }

    @Test
    void 사본_발급은_recipientId와_이미지를_embed로_보낸다() {
        server.expect(requestTo("http://engine/v1/embed"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().string(containsString("name=\"recipientId\"")))
                .andExpect(content().string(containsString("2624297755")))
                .andExpect(content().string(containsString("name=\"image\"; filename=\"DOC-A001.png\"")))
                .andRespond(withSuccess("{\"recipientId\":2624297755,\"width\":1024,\"imagePng\":\"AA==\"}",
                        MediaType.APPLICATION_JSON));

        ObjectNode result = engineClient.embed(2624297755L,
                EngineClient.namedResource(new byte[]{1, 2, 3}, "DOC-A001.png"));

        assertThat(result.get("width").asInt()).isEqualTo(1024);
        server.verify();
    }

    @Test
    void 엔진이_오류를_돌려주면_502로_변환한다() {
        server.expect(requestTo("http://engine/v1/detect"))
                .andRespond(withServerError()
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("{\"error\":\"이미지를 읽을 수 없습니다\"}"));

        assertThatThrownBy(() -> engineClient.detect(photo, List.of(), null))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_GATEWAY);
                    assertThat(e.getMessage()).isEqualTo("엔진 오류: 이미지를 읽을 수 없습니다");
                });
    }
}
