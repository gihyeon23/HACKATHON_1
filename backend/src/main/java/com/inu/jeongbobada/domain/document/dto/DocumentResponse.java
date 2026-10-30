package com.inu.jeongbobada.domain.document.dto;

import com.inu.jeongbobada.domain.document.entity.Document;
import java.time.LocalDateTime;

public record DocumentResponse(String docCode, String title, Integer width, Integer height, LocalDateTime createdAt) {

    public static DocumentResponse from(Document document) {
        return new DocumentResponse(document.getDocCode(), document.getTitle(),
                document.getWidth(), document.getHeight(), document.getCreatedAt());
    }
}
