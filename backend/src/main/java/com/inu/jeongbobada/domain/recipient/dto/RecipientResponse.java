package com.inu.jeongbobada.domain.recipient.dto;

import com.inu.jeongbobada.domain.recipient.entity.Recipient;
import com.inu.jeongbobada.domain.recipient.entity.RecipientType;
import java.time.LocalDateTime;

/**
 * 대장 목록 항목.
 */
public record RecipientResponse(
        Long recipientId,
        String copyCode,
        String parentCopyCode,
        String docCode,
        String name,
        RecipientType recipientType,
        Integer width,
        Integer height,
        LocalDateTime createdAt
) {

    public static RecipientResponse from(Recipient recipient) {
        Recipient parent = recipient.getParentRecipient();
        return new RecipientResponse(
                recipient.getRecipientId(),
                recipient.getCopyCode(),
                parent != null ? parent.getCopyCode() : null,
                recipient.getDocument() != null ? recipient.getDocument().getDocCode() : null,
                recipient.getName(),
                recipient.getRecipientType(),
                recipient.getWidth(),
                recipient.getHeight(),
                recipient.getCreatedAt());
    }
}
