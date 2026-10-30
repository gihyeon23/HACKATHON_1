package com.inu.jeongbobada.domain.recipient.repository;

import com.inu.jeongbobada.domain.recipient.entity.Recipient;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RecipientRepository extends JpaRepository<Recipient, Long> {

    Optional<Recipient> findByCopyCode(String copyCode);

    Optional<Recipient> findByRecipientId(Long recipientId);

    boolean existsByCopyCode(String copyCode);

    boolean existsByRecipientId(Long recipientId);

    /** 대장 목록. 문서·부모를 한 번에 가져와 N+1 을 피한다. */
    @EntityGraph(attributePaths = {"document", "parentRecipient"})
    List<Recipient> findAllByOrderByIdAsc();

    /** 검출 기준 이미지 선택용: 배포본 파일이 있는 사본 (최신순) */
    @EntityGraph(attributePaths = "document")
    List<Recipient> findByFileNameIsNotNullOrderByIdDesc();
}
