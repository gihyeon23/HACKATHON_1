package com.inu.jeongbobada.global.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * CORS 허용 출처. 환경변수 CORS_ALLOWED_ORIGINS (쉼표 구분)
 */
@ConfigurationProperties("cors")
public record CorsProperties(
        @DefaultValue("http://localhost:5173") List<String> allowedOrigins
) {
}
