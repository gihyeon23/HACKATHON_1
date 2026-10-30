package com.inu.jeongbobada.global.engine;

import com.inu.jeongbobada.global.exception.ApiException;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
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
import org.springframework.web.client.RestClientException;
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
        MediaType contentType = photo.getContentType() != null
                ? MediaType.parseMediaType(photo.getContentType())
                : MediaType.APPLICATION_OCTET_STREAM;
        return detect(photo.getResource(), contentType, candidates, corners, List.of());
    }

    /**
     * 기준 이미지(배포본 PNG)를 함께 보내 검출한다. 기준 이미지로 정렬되면 정보 결합 검출까지 수행해 더 민감하다.
     *
     * @param references 문서별 배포본 PNG (테두리 포함, 최대 10장)
     */
    public ObjectNode detectWithReferences(Resource photo, MediaType photoType, List<EngineCandidate> candidates,
                                           List<Resource> references) {
        return detect(photo, photoType, candidates, null, references);
    }

    /**
     * 수신자 ID 를 워터마크로 삽입한 배포본을 만든다.
     *
     * @param image 문서 이미지 (null 이면 엔진의 샘플 문서)
     * @return 엔진 응답 그대로 (width, height, strength, predictedZ, psnr, ssim, imagePng ...)
     */
    public ObjectNode embed(long recipientId, Resource image) {
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("recipientId", Long.toString(recipientId));
        if (image != null) {
            body.add("image", image);
        }
        return post("/v1/embed", body);
    }

    /** 엔진이 떠 있는지 확인한다 (GET /health). */
    public boolean isAvailable() {
        try {
            engineRestClient.get().uri("/health").retrieve().toBodilessEntity();
            return true;
        } catch (RestClientException e) {
            return false;
        }
    }

    /** 파일명이 있어야 멀티파트 파일 파트로 전송되므로 이름을 붙여 감싼다. */
    public static Resource namedResource(byte[] content, String filename) {
        return new ByteArrayResource(content) {
            @Override
            public String getFilename() {
                return filename;
            }
        };
    }

    private ObjectNode detect(Resource photo, MediaType photoType, List<EngineCandidate> candidates,
                              String corners, List<Resource> references) {
        HttpHeaders photoHeaders = new HttpHeaders();
        photoHeaders.setContentType(photoType);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("photo", new HttpEntity<>(photo, photoHeaders));
        body.add("candidates", jsonMapper.writeValueAsString(candidates));
        if (StringUtils.hasText(corners)) {
            body.add("corners", corners);
        }
        for (Resource reference : references) {
            body.add("reference", reference);
        }
        return post("/v1/detect", body);
    }

    private ObjectNode post(String uri, MultiValueMap<String, Object> body) {
        JsonNode response;
        try {
            response = engineRestClient.post()
                    .uri(uri)
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
