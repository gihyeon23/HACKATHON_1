package com.inu.jeongbobada.domain.copy;

import com.inu.jeongbobada.domain.document.Document;
import com.inu.jeongbobada.domain.recipient.Recipient;
import com.inu.jeongbobada.domain.recipient.RecipientRepository;
import com.inu.jeongbobada.global.exception.ApiException;
import com.inu.jeongbobada.global.exception.ErrorCode;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 배포 계보 역추적. 식별된 사본에서 부모를 따라 원본 문서까지 거슬러 올라간다.
 * 경로 API 와 분석 결과(distributionSteps, pathSummary)가 모두 이 로직을 쓴다.
 */
@Service
@RequiredArgsConstructor
public class LineageService {

    private static final String SUMMARY_ORIGINAL = "원본";
    private static final String SUMMARY_DELIMITER = " → ";

    private final RecipientRepository recipientRepository;

    @Transactional(readOnly = true)
    public List<PathNode> trace(String copyCode) {
        Recipient copy = recipientRepository.findByCopyCode(copyCode)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCode.COPY_NOT_FOUND,
                        "등록되지 않은 사본입니다: " + copyCode));
        return trace(copy);
    }

    /**
     * 순서: 원본 문서 → 중간 사본 → 식별된 사본. 경로 길이는 고정하지 않는다.
     * 같은 사본을 두 번 만나면 순환 참조로 보고 멈춘다.
     */
    @Transactional(readOnly = true)
    public List<PathNode> trace(Recipient identified) {
        Deque<Recipient> chain = new ArrayDeque<>();
        Set<Long> visited = new HashSet<>();
        for (Recipient current = identified; current != null; current = current.getParentRecipient()) {
            if (!visited.add(current.getId())) {
                throw new ApiException(HttpStatus.CONFLICT, ErrorCode.LINEAGE_CYCLE,
                        "배포 기록에 순환 참조가 있습니다: " + current.getCopyCode());
            }
            chain.addFirst(current);
        }

        Document document = chain.getFirst().getDocument();
        boolean sameDocument = document != null && chain.stream()
                .allMatch(r -> r.getDocument() != null && Objects.equals(r.getDocument().getId(), document.getId()));
        if (!sameDocument) {
            throw new ApiException(HttpStatus.CONFLICT, ErrorCode.LINEAGE_BROKEN,
                    "원본 문서와 연결되지 않은 사본입니다: " + identified.getCopyCode());
        }

        List<PathNode> path = new ArrayList<>(chain.size() + 1);
        path.add(new PathNode(document.getDocCode(), document.getTitle(), PathNode.ORIGINAL, PathNode.ROLE_ORIGINAL));
        for (Recipient copy : chain) {
            String role = copy == identified ? PathNode.ROLE_IDENTIFIED : PathNode.ROLE_INTERMEDIATE;
            path.add(new PathNode(copy.getCopyCode(), copy.getName(), PathNode.COPY, role));
        }
        return path;
    }

    /** "원본 → 직원 B → 협력사 C" */
    public static String summarize(List<PathNode> path) {
        return path.stream()
                .map(node -> PathNode.ORIGINAL.equals(node.type()) ? SUMMARY_ORIGINAL : node.name())
                .collect(Collectors.joining(SUMMARY_DELIMITER));
    }
}
