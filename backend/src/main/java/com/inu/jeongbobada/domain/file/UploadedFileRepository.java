package com.inu.jeongbobada.domain.file;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UploadedFileRepository extends JpaRepository<UploadedFile, Long> {

    Optional<UploadedFile> findByFileId(String fileId);

    List<UploadedFile> findByDeletedFalseAndDeleteAfterBefore(LocalDateTime now);
}
