package com.inu.jeongbobada.domain.analysis;

import java.time.LocalDateTime;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AnalysisRepository extends JpaRepository<Analysis, Long> {

    Optional<Analysis> findByAnalysisId(String analysisId);

    /**
     * 진행 중일 때만 취소한다. version 을 올려, 분석 스레드가 들고 있던 이전 상태로 덮어쓰지 못하게 한다.
     *
     * @return 취소된 행 수 (0 이면 이미 끝난 분석)
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update Analysis a
               set a.status = :canceled, a.finishedAt = :now, a.version = a.version + 1
             where a.analysisId = :analysisId and a.status = :running
            """)
    int cancelIfRunning(@Param("analysisId") String analysisId, @Param("now") LocalDateTime now,
                        @Param("running") AnalysisStatus running, @Param("canceled") AnalysisStatus canceled);
}
