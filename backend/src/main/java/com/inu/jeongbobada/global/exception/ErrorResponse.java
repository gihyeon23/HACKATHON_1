package com.inu.jeongbobada.global.exception;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * 오류 응답. code 는 구분이 필요한 오류에만 붙는다 (없으면 필드 자체를 생략).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ErrorResponse(String error, String code) {

    public ErrorResponse(String error) {
        this(error, null);
    }
}
