package com.inu.jeongbobada.global.engine;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * 워터마크 엔진 접속 설정. 엔진은 내부망 전용이므로 외부에 노출하지 않는다.
 */
@ConfigurationProperties("engine")
public record EngineProperties(
        @DefaultValue("http://127.0.0.1:8000") String url,
        @DefaultValue("5s") Duration connectTimeout,
        @DefaultValue("120s") Duration readTimeout
) {
}
