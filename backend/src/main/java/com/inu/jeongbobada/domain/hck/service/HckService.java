package com.inu.jeongbobada.domain.hck.service;

import com.inu.jeongbobada.domain.copy.dto.CopyIssueCommand;
import com.inu.jeongbobada.domain.copy.dto.CopyResponse;
import com.inu.jeongbobada.domain.copy.service.CopyIssueService;
import com.inu.jeongbobada.domain.document.entity.Document;
import com.inu.jeongbobada.domain.hck.dto.HckEntry;
import com.inu.jeongbobada.domain.hck.dto.HckManifest;
import com.inu.jeongbobada.domain.hck.dto.HckOpenResponse;
import com.inu.jeongbobada.domain.recipient.entity.Recipient;
import com.inu.jeongbobada.domain.recipient.entity.RecipientType;
import com.inu.jeongbobada.domain.recipient.repository.RecipientRepository;
import com.inu.jeongbobada.global.exception.ApiException;
import com.inu.jeongbobada.global.exception.ErrorCode;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.LocalDateTime;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Deque;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * 보호 파일(.hck): 플랫폼 밖(카톡 · 이메일)으로 넘어간 경로를 남긴다.
 *
 * <p>파일에는 이미지 없이 서명된 장부만 들어 있다. 받은 사람이 뷰어로 열면 서버가 장부를 검증하고,
 * 그 사람 전용 워터마크 사본을 발급(부모 = 파일을 넘겨준 사람의 사본)한 뒤 장부에 한 줄을 더한다.
 * 그래서 화면을 찍어 유출해도 사진에서 열람자 사본이 검출되고, 배포 경로에 전달 관계가 나온다.
 */
@Service
@RequiredArgsConstructor
public class HckService {

    private static final String MANIFEST = "manifest.json";
    private static final String LEDGER = "ledger.json";
    /** 장부만 들어 있으므로 작다. 압축 폭탄을 막기 위해 항목 크기를 제한한다 */
    private static final int MAX_ENTRY_BYTES = 512 * 1024;
    private static final int MAX_LEDGER_LINES = 1000;

    private final RecipientRepository recipientRepository;
    private final CopyIssueService copyIssueService;
    private final HckLedger hckLedger;
    private final JsonMapper jsonMapper;

    /** 사본의 보호 파일 발급. 장부는 원본에서 이 사본까지 등록된 배포 경로로 시작한다. */
    @Transactional(readOnly = true)
    public byte[] export(String copyCode) {
        Recipient copy = recipientRepository.findByCopyCode(copyCode)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCode.COPY_NOT_FOUND,
                        "등록되지 않은 사본입니다: " + copyCode));
        Document document = copy.getDocument();
        if (document == null) {
            throw new ApiException(HttpStatus.CONFLICT, ErrorCode.LINEAGE_BROKEN, "원본 문서가 없는 사본입니다: " + copyCode);
        }

        List<HckEntry> ledger = new ArrayList<>();
        for (Recipient c : chainFromRoot(copy)) {
            Recipient parent = c.getParentRecipient();
            ledger.add(hckLedger.append(ledger, HckEntry.ISSUE, document.getDocCode(), c.getCopyCode(),
                    parent != null ? parent.getCopyCode() : null, c.getName(), typeName(c.getRecipientType()),
                    null, c.getCreatedAt()));
        }
        return pack(new HckManifest(HckManifest.FORMAT, HckManifest.VERSION, document.getDocCode(), document.getTitle()),
                ledger);
    }

    /**
     * 뷰어로 열기. 장부 검증 → (처음 여는 기기면) 열람자 사본 발급 → 장부 갱신.
     * 엔진 호출이 있어 트랜잭션으로 묶지 않는다.
     *
     * @param viewerId 브라우저가 보관하는 기기 식별값. 같은 기기가 다시 열면 새 사본을 만들지 않는다
     */
    public HckOpenResponse open(byte[] file, String name, RecipientType recipientType, String viewerId) {
        Parsed parsed = unpack(file);
        HckManifest manifest = parsed.manifest();
        List<HckEntry> ledger = parsed.ledger();

        HckLedger.Verification verification = hckLedger.verify(ledger, manifest.docCode());
        if (!verification.ok()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.HCK_TAMPERED,
                    "보호 파일의 기록이 변조되어 열 수 없습니다 (%d번째 기록: %s)"
                            .formatted(verification.brokenAt() + 1, verification.reason()));
        }

        HckEntry holder = ledger.getLast();
        Recipient holderCopy = recipientRepository.findByCopyCodeAndDocument_DocCode(holder.copyCode(), manifest.docCode())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCode.COPY_NOT_FOUND,
                        "보호 파일의 사본이 배포 기록에 없습니다: " + holder.copyCode()));
        if (!StringUtils.hasText(name)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.INVALID_REQUEST, "열람자 이름을 입력해주세요");
        }
        String viewerName = name.trim();
        // 같은 사람 = 같은 기기 + 같은 이름. PC 하나를 여럿이 쓰면 이름이 다르면 다른 열람자로 본다
        String viewer = StringUtils.hasText(viewerId) ? hckLedger.viewerTag(viewerId.trim(), viewerName) : null;

        // 같은 사람이 다시 열었다
        if (viewer != null && viewer.equals(holder.viewer())) {
            return response(file, manifest, ledger, holderCopy.getCopyCode(), holderCopy.getName(), parentOf(ledger), true);
        }

        // 사본 주인이 처음 연 경우: 새 사본 없이 기기만 연결한다 (원본 → A → A 가 되지 않게)
        if (holder.viewer() == null && viewerName.equals(holderCopy.getName())) {
            ledger.add(hckLedger.append(ledger, HckEntry.CLAIM, manifest.docCode(), holderCopy.getCopyCode(),
                    holderCopy.getCopyCode(), viewerName, holder.recipientType(), viewer, LocalDateTime.now()));
            return response(pack(manifest, ledger), manifest, ledger, holderCopy.getCopyCode(), viewerName,
                    parentOf(ledger), true);
        }

        RecipientType type = recipientType != null ? recipientType : RecipientType.PARTNER;
        CopyResponse issued = copyIssueService.issueCopy(
                new CopyIssueCommand(manifest.docCode(), viewerName, type, holderCopy.getCopyCode(), null));
        ledger.add(hckLedger.append(ledger, HckEntry.OPEN, manifest.docCode(), issued.copyCode(),
                holderCopy.getCopyCode(), issued.name(), type.name(), viewer, LocalDateTime.now()));
        return response(pack(manifest, ledger), manifest, ledger, issued.copyCode(), issued.name(), holder, false);
    }

    private HckOpenResponse response(byte[] hck, HckManifest manifest, List<HckEntry> ledger, String copyCode,
                                     String name, HckEntry parent, boolean reopened) {
        List<HckOpenResponse.LedgerLine> lines = ledger.stream()
                .map(e -> new HckOpenResponse.LedgerLine(e.seq(), e.event(), e.copyCode(), e.name(), e.recipientType()))
                .toList();
        boolean self = parent == null || copyCode.equals(parent.copyCode());
        return new HckOpenResponse(Base64.getEncoder().encodeToString(hck), manifest.docCode(), manifest.title(),
                copyCode, name, self ? null : parent.copyCode(), self ? null : parent.name(), reopened,
                "/api/copies/" + copyCode + "/file", lines);
    }

    /** 마지막 줄의 사본을 처음 받은 줄 (CLAIM 이 이어져도 실제로 넘겨준 사람을 찾는다) */
    private static HckEntry parentOf(List<HckEntry> ledger) {
        String code = ledger.getLast().copyCode();
        for (int i = ledger.size() - 1; i >= 0; i--) {
            if (!code.equals(ledger.get(i).copyCode())) {
                return ledger.get(i);
            }
        }
        return ledger.getLast();
    }

    private static List<Recipient> chainFromRoot(Recipient copy) {
        Deque<Recipient> chain = new ArrayDeque<>();
        Set<Long> visited = new HashSet<>();
        for (Recipient c = copy; c != null; c = c.getParentRecipient()) {
            if (!visited.add(c.getId())) {
                throw new ApiException(HttpStatus.CONFLICT, ErrorCode.LINEAGE_CYCLE,
                        "배포 기록에 순환 참조가 있습니다: " + c.getCopyCode());
            }
            chain.addFirst(c);
        }
        return List.copyOf(chain);
    }

    private static String typeName(RecipientType type) {
        return type != null ? type.name() : null;
    }

    private byte[] pack(HckManifest manifest, List<HckEntry> ledger) {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(bytes)) {
            zip.putNextEntry(new ZipEntry(MANIFEST));
            zip.write(jsonMapper.writeValueAsBytes(manifest));
            zip.closeEntry();
            zip.putNextEntry(new ZipEntry(LEDGER));
            zip.write(jsonMapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(ledger));
            zip.closeEntry();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return bytes.toByteArray();
    }

    private Parsed unpack(byte[] file) {
        if (file == null || file.length == 0) {
            throw invalid("보호 파일을 선택해주세요");
        }
        byte[] manifestBytes = null;
        byte[] ledgerBytes = null;
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(file))) {
            for (ZipEntry entry; (entry = zip.getNextEntry()) != null; ) {
                if (MANIFEST.equals(entry.getName())) {
                    manifestBytes = readLimited(zip);
                } else if (LEDGER.equals(entry.getName())) {
                    ledgerBytes = readLimited(zip);
                }
            }
        } catch (IOException e) {
            throw invalid(".hck 보호 파일이 아닙니다");
        }
        if (manifestBytes == null || ledgerBytes == null) {
            throw invalid(".hck 보호 파일이 아닙니다");
        }
        try {
            HckManifest manifest = jsonMapper.readValue(manifestBytes, HckManifest.class);
            if (!HckManifest.FORMAT.equals(manifest.format()) || manifest.version() != HckManifest.VERSION
                    || !StringUtils.hasText(manifest.docCode())) {
                throw invalid("지원하지 않는 보호 파일 형식입니다");
            }
            List<HckEntry> ledger = jsonMapper.readValue(ledgerBytes, new TypeReference<List<HckEntry>>() {
            });
            if (ledger == null || ledger.size() > MAX_LEDGER_LINES) {
                throw invalid("보호 파일의 장부를 읽을 수 없습니다");
            }
            return new Parsed(manifest, new ArrayList<>(ledger));
        } catch (JacksonException e) {
            throw invalid("보호 파일의 내용을 읽을 수 없습니다");
        }
    }

    private static byte[] readLimited(InputStream in) throws IOException {
        byte[] data = in.readNBytes(MAX_ENTRY_BYTES + 1);
        if (data.length > MAX_ENTRY_BYTES) {
            throw invalid("보호 파일이 너무 큽니다");
        }
        return data;
    }

    private static ApiException invalid(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.HCK_INVALID, message);
    }

    private record Parsed(HckManifest manifest, List<HckEntry> ledger) {
    }
}
