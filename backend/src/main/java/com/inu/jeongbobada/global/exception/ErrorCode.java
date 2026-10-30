package com.inu.jeongbobada.global.exception;

/**
 * ErrorResponse.code 에 쓰는 오류 코드 모음.
 */
public final class ErrorCode {

    public static final String FILE_TOO_LARGE = "FILE_TOO_LARGE";
    public static final String UNSUPPORTED_FORMAT = "UNSUPPORTED_FORMAT";
    public static final String EMPTY_FILE = "EMPTY_FILE";
    public static final String FILE_NOT_FOUND = "FILE_NOT_FOUND";
    public static final String DEMO_NOT_READY = "DEMO_NOT_READY";
    public static final String DOCUMENT_NOT_FOUND = "DOCUMENT_NOT_FOUND";
    public static final String COPY_NOT_FOUND = "COPY_NOT_FOUND";
    public static final String LINEAGE_CYCLE = "LINEAGE_CYCLE";
    public static final String LINEAGE_BROKEN = "LINEAGE_BROKEN";
    public static final String ANALYSIS_NOT_FOUND = "ANALYSIS_NOT_FOUND";
    public static final String ANALYSIS_RUNNING = "ANALYSIS_RUNNING";
    public static final String ANALYSIS_CANCELED = "ANALYSIS_CANCELED";
    public static final String ANALYSIS_FINISHED = "ANALYSIS_FINISHED";
    public static final String INVALID_REQUEST = "INVALID_REQUEST";

    private ErrorCode() {
    }
}
