package com.inu.jeongbobada.domain.analysis;

import com.inu.jeongbobada.domain.detection.Detection;
import com.inu.jeongbobada.domain.file.UploadedFile;
import com.inu.jeongbobada.domain.recipient.Recipient;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Version;
import java.time.LocalDateTime;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 업로드 파일 1건에 대한 분석 작업. 단계별 시작·종료 시각으로 진행 상태를 계산한다.
 *
 * <p>분석은 별도 스레드에서 진행되고 취소는 요청 스레드에서 일어나므로 @Version 으로 충돌을 막는다.
 * 취소된 뒤 도착한 엔진 결과는 저장되지 않는다.
 */
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Analysis {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 외부에 노출하는 ID (UUID) */
    @Column(nullable = false, unique = true, length = 36)
    private String analysisId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "uploaded_file_id", nullable = false)
    private UploadedFile file;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AnalysisStatus status;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private FailureReason failureReason;

    private LocalDateTime validateStartedAt;
    private LocalDateTime validateEndedAt;
    private LocalDateTime watermarkStartedAt;
    private LocalDateTime watermarkEndedAt;
    private LocalDateTime lookupStartedAt;
    private LocalDateTime lookupEndedAt;

    /** 검출 이력 (엔진 응답을 받은 경우만) */
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "detection_id")
    private Detection detection;

    /** 식별된 사본 (COMPLETED 일 때만) */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recipient_id")
    private Recipient recipient;

    /** 엔진 판정 임계 (z 는 Detection 에 저장) */
    private Double threshold;

    @Column(nullable = false)
    private LocalDateTime startedAt;

    private LocalDateTime finishedAt;

    @Version
    private Long version;

    /** 분석 시작: 바로 파일 검증 단계로 들어간다 */
    public static Analysis start(UploadedFile file) {
        Analysis analysis = new Analysis();
        LocalDateTime now = LocalDateTime.now();
        analysis.analysisId = UUID.randomUUID().toString();
        analysis.file = file;
        analysis.status = AnalysisStatus.RUNNING;
        analysis.startedAt = now;
        analysis.validateStartedAt = now;
        return analysis;
    }

    public boolean isRunning() {
        return status == AnalysisStatus.RUNNING;
    }

    public void startWatermark(LocalDateTime now) {
        validateEndedAt = now;
        watermarkStartedAt = now;
    }

    public void startLookup(LocalDateTime now) {
        watermarkEndedAt = now;
        lookupStartedAt = now;
    }

    public void complete(Recipient recipient, Detection detection, Double threshold, LocalDateTime now) {
        this.recipient = recipient;
        finish(AnalysisStatus.COMPLETED, null, detection, threshold, now);
    }

    /** 검출 결과로 판정된 실패 (조회 단계까지 마친 경우) */
    public void reject(FailureReason reason, Detection detection, Double threshold, LocalDateTime now) {
        finish(AnalysisStatus.FAILED, reason, detection, threshold, now);
    }

    /** 오류로 중단된 실패 (진행 중이던 단계는 끝나지 않은 채로 남는다) */
    public void fail(FailureReason reason, LocalDateTime now) {
        this.status = AnalysisStatus.FAILED;
        this.failureReason = reason;
        this.finishedAt = now;
    }

    private void finish(AnalysisStatus status, FailureReason reason, Detection detection, Double threshold,
                        LocalDateTime now) {
        this.status = status;
        this.failureReason = reason;
        this.detection = detection;
        this.threshold = threshold;
        this.lookupEndedAt = now;
        this.finishedAt = now;
    }
}
