package com.inu.jeongbobada.domain.detection.controller;

import com.inu.jeongbobada.domain.detection.service.DetectionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.node.ObjectNode;

@RestController
@RequestMapping("/api/detections")
@RequiredArgsConstructor
public class DetectionController {

    private final DetectionService detectionService;

    /** 휴대폰으로 찍은 사진에서 워터마크를 추출해 유출자를 찾는다. */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ObjectNode detect(
            @RequestParam(value = "photo", required = false) MultipartFile photo,
            @RequestParam(value = "corners", required = false) String corners
    ) {
        return detectionService.detect(photo, corners);
    }
}
