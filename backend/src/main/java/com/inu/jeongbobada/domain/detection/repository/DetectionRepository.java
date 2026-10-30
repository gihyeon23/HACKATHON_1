package com.inu.jeongbobada.domain.detection.repository;

import com.inu.jeongbobada.domain.detection.entity.Detection;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DetectionRepository extends JpaRepository<Detection, Long> {
}
