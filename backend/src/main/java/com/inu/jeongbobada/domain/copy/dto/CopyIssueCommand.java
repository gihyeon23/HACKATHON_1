package com.inu.jeongbobada.domain.copy.dto;

import com.inu.jeongbobada.domain.recipient.entity.RecipientType;

/**
 * 사본 발급 요청.
 *
 * @param parentCopyCode 이 사본을 넘겨준 부모 사본. 원본에서 바로 발급하면 null
 * @param copyCode       지정할 사본 ID. null 이면 자동 생성 (시드 데이터에서만 지정)
 */
public record CopyIssueCommand(String docCode, String name, RecipientType recipientType,
                               String parentCopyCode, String copyCode) {
}
