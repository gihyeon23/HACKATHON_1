package com.inu.jeongbobada.domain.hck.dto;

/**
 * 보호 파일(.hck) 머리말. 이미지는 파일에 넣지 않고, 열 때마다 서버가 열람자 워터마크 사본을 준다.
 */
public record HckManifest(String format, int version, String docCode, String title) {

    public static final String FORMAT = "hck";
    public static final int VERSION = 2;
}
