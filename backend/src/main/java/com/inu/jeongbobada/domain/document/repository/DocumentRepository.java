package com.inu.jeongbobada.domain.document.repository;

import com.inu.jeongbobada.domain.document.entity.Document;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DocumentRepository extends JpaRepository<Document, Long> {

    Optional<Document> findByDocCode(String docCode);

    Optional<Document> findTopByOrderByIdDesc();
}
