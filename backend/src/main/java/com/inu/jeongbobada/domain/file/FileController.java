package com.inu.jeongbobada.domain.file;

import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FileController {

    private final FileService fileService;

    /** 유출 의심 이미지 업로드 (PNG, JPG, JPEG / 최대 50MB) */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public FileResponse upload(@RequestParam(value = "file", required = false) MultipartFile file) {
        return fileService.upload(file);
    }

    /** 서버에 준비된 데모 촬영 이미지를 업로드 파일로 등록 */
    @PostMapping("/demo")
    @ResponseStatus(HttpStatus.CREATED)
    public FileResponse uploadDemo() {
        return fileService.uploadDemo();
    }

    /** 업로드 원본 이미지 ('원본 보기') */
    @GetMapping("/{fileId}/image")
    public ResponseEntity<byte[]> image(@PathVariable String fileId) {
        FileService.StoredImage image = fileService.image(fileId);
        return ResponseEntity.ok()
                .contentType(image.file().getFormat().mediaType())
                .cacheControl(CacheControl.noStore())
                .body(image.content());
    }
}
