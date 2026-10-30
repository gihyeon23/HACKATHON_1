package com.inu.jeongbobada.domain.copy;

/**
 * 배포 경로의 한 항목.
 *
 * @param code 원본이면 docCode, 사본이면 copyCode
 * @param name 원본이면 문서 제목, 사본이면 배포 대상 이름
 * @param type ORIGINAL | COPY
 * @param role 원본 문서 | 중간 사본 | 식별된 사본
 */
public record PathNode(String code, String name, String type, String role) {

    public static final String ORIGINAL = "ORIGINAL";
    public static final String COPY = "COPY";

    public static final String ROLE_ORIGINAL = "원본 문서";
    public static final String ROLE_INTERMEDIATE = "중간 사본";
    public static final String ROLE_IDENTIFIED = "식별된 사본";
}
