package com.inu.jeongbobada.domain.file;

/**
 * 업로드 파일 정보.
 *
 * @param format PNG | JPEG
 */
public record FileResponse(String fileId, String name, long size, int width, int height, String format) {

    public static FileResponse from(UploadedFile file) {
        return new FileResponse(file.getFileId(), file.getOriginalName(), file.getSize(),
                file.getWidth(), file.getHeight(), file.getFormat().name());
    }
}
