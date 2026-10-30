package com.inu.jeongbobada.domain.recipient.controller;

import com.inu.jeongbobada.domain.recipient.dto.RecipientResponse;
import com.inu.jeongbobada.domain.recipient.repository.RecipientRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/recipients")
@RequiredArgsConstructor
public class RecipientController {

    private final RecipientRepository recipientRepository;

    /** 수신자(사본) 대장 목록 */
    @GetMapping
    @Transactional(readOnly = true)
    public List<RecipientResponse> list() {
        return recipientRepository.findAllByOrderByIdAsc().stream()
                .map(RecipientResponse::from)
                .toList();
    }
}
