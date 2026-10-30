package com.inu.jeongbobada.domain.analysis;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/analyses")
@RequiredArgsConstructor
public class AnalysisController {

    private final AnalysisService analysisService;

    /** 분석 시작. 즉시 analysisId 를 돌려주고 분석은 비동기로 진행한다 */
    @PostMapping
    @ResponseStatus(HttpStatus.ACCEPTED)
    public AnalysisCreatedResponse create(@RequestBody(required = false) AnalysisRequest request) {
        return analysisService.create(request);
    }

    /** 진행 상태 (1초 폴링) */
    @GetMapping("/{analysisId}")
    public AnalysisStatusResponse status(@PathVariable String analysisId) {
        return analysisService.status(analysisId);
    }

    /** 분석 취소 */
    @DeleteMapping("/{analysisId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancel(@PathVariable String analysisId) {
        analysisService.cancel(analysisId);
    }

    /** 분석 결과 (COMPLETED 일 때만) */
    @GetMapping("/{analysisId}/result")
    public AnalysisResultResponse result(@PathVariable String analysisId) {
        return analysisService.result(analysisId);
    }
}
