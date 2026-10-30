package com.inu.jeongbobada.domain.detection;

import com.inu.jeongbobada.domain.recipient.Recipient;
import com.inu.jeongbobada.domain.recipient.RecipientRepository;
import com.inu.jeongbobada.global.engine.EngineCandidate;
import com.inu.jeongbobada.global.engine.EngineClient;
import com.inu.jeongbobada.global.exception.ApiException;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

@Service
@RequiredArgsConstructor
public class DetectionService {

    private static final String UNKNOWN_NAME = "?";

    private final RecipientRepository recipientRepository;
    private final DetectionRepository detectionRepository;
    private final EngineClient engineClient;

    /**
     * 휴대폰 촬영본에서 워터마크를 추출해 유출자를 찾는다.
     * 엔진 호출이 길어질 수 있어 트랜잭션으로 묶지 않는다.
     */
    public ObjectNode detect(MultipartFile photo, String corners) {
        if (photo == null || photo.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "촬영 사진을 올려주세요");
        }

        List<Recipient> recipients = recipientRepository.findAll();
        List<EngineCandidate> candidates = recipients.stream()
                .map(r -> new EngineCandidate(r.getRecipientId(), r.getWidth(), r.getHeight()))
                .toList();

        ObjectNode result = engineClient.detect(photo, candidates, corners);

        Map<Long, String> names = recipients.stream()
                .collect(Collectors.toMap(Recipient::getRecipientId, Recipient::getName));
        attachNames(result, names);

        detectionRepository.save(toDetection(result));
        return result;
    }

    /** 엔진 응답의 ID 를 이름으로 바꾼다. 이름은 엔진에 보내지 않으므로 백엔드에서 붙인다. */
    private void attachNames(ObjectNode result, Map<Long, String> names) {
        Long recipientId = longOrNull(result, "recipientId");
        result.put("name", recipientId != null ? names.get(recipientId) : null);

        JsonNode ranking = result.get("ranking");
        if (ranking == null || !ranking.isArray()) {
            return;
        }
        ArrayNode named = result.arrayNode();
        for (JsonNode entry : ranking) {
            ObjectNode item = named.addObject();
            item.put("name", names.getOrDefault(longOrNull(entry, "id"), UNKNOWN_NAME));
            item.set("z", entry.get("z"));
        }
        result.set("ranking", named);
    }

    private Detection toDetection(JsonNode result) {
        return Detection.builder()
                .found(result.path("found").asBoolean(false))
                .recipientId(longOrNull(result, "recipientId"))
                .z(result.hasNonNull("z") ? result.get("z").asDouble() : null)
                .via(stringOrNull(result, "via"))
                .error(stringOrNull(result, "error"))
                .build();
    }

    private static Long longOrNull(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value != null && value.isNumber() ? value.asLong() : null;
    }

    private static String stringOrNull(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value != null && value.isString() ? value.asString() : null;
    }
}
