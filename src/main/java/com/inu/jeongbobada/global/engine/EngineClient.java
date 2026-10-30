package com.inu.jeongbobada.global.engine;

import com.inu.jeongbobada.global.exception.ApiException;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.util.StreamUtils;
import org.springframework.util.StringUtils;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * 워터마크 엔진(/v1) 호출 클라이언트.
 */
@Component
@RequiredArgsConstructor
public class EngineClient {

    private final RestClient engineRestClient;
    private final JsonMapper jsonMapper;

    /**
     * 촬영본에서 워터마크를 추출해 후보 중 유출자를 찾는다.
     *
     * @param corners 수동 코너 "x1,y1,...,x4,y4" (없으면 엔진이 자동 검출)
     * @return 엔진 응답 그대로 (found, recipientId, z, ranking, restoredJpeg ...)
     */
    public ObjectNode detect(MultipartFile photo, List<EngineCandidate> candidates, String corners) {
        HttpHeaders photoHeaders = new HttpHeaders();
        photoHeaders.setContentType(photo.getContentType() != null
                ? MediaType.parseMediaType(photo.getContentType())
                : MediaType.APPLICATION_OCTET_STREAM);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("photo", new HttpEntity<>(photo.getResource(), photoHeaders));
        body.add("candidates", jsonMapper.writeValueAsString(candidates));
        if (StringUtils.hasText(corners)) {
            body.add("corners", corners);
        }

        JsonNode response;
        try {
            response = engineRestClient.post()
                    .uri("/v1/detect")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(body)
                    .retrieve()
                    .onStatus(status -> status.isError(), (request, res) -> {
                        throw engineError(errorMessage(res));
                    })
                    .body(JsonNode.class);
        } catch (ResourceAccessException e) {
            throw engineError("엔진에 연결할 수 없습니다");
        }

        if (response == null || !response.isObject()) {
            throw engineError("응답 형식이 올바르지 않습니다");
        }
        return (ObjectNode) response;
    }

    private String errorMessage(ClientHttpResponse response) throws IOException {
        String raw = StreamUtils.copyToString(response.getBody(), StandardCharsets.UTF_8);
        try {
            JsonNode error = jsonMapper.readTree(raw).get("error");
            return error != null && error.isString() ? error.asString() : raw;
        } catch (JacksonException e) {
            return raw;
        }
    }

    private ApiException engineError(String message) {
        return new ApiException(HttpStatus.BAD_GATEWAY, "엔진 오류: " + message);
    }
}
