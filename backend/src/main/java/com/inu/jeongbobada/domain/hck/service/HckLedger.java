package com.inu.jeongbobada.domain.hck.service;

import com.inu.jeongbobada.domain.hck.dto.HckEntry;
import com.inu.jeongbobada.global.storage.StorageProperties;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Component;

/**
 * 보호 파일 장부의 해시 체인과 서버 서명.
 * hash = SHA-256(앞 줄 hash + 본문), sig = HMAC-SHA256(서버 키, hash) → 줄 삭제 · 순서 변경 · 내용 변경 · 가짜 줄 추가를 찾는다.
 *
 * <p>서명 키는 업로드 암호화 키(FILE_ENCRYPTION_KEY)에서 용도별로 파생한다 (새 환경변수 없이 서버만 알도록).
 */
@Component
public class HckLedger {

    private static final String SEP = "\u001f";
    private static final HexFormat HEX = HexFormat.of();

    private final byte[] signKey;

    public HckLedger(StorageProperties properties) {
        byte[] master = Base64.getDecoder().decode(properties.encryptionKey().trim());
        this.signKey = hmac(master, "TraceGuard/hck-ledger/v1");
    }

    /** 앞 줄에 이어 새 줄을 만든다 (서버에서만 호출) */
    public HckEntry append(List<HckEntry> ledger, String event, String docCode, String copyCode,
                           String parentCopyCode, String name, String recipientType, String viewer,
                           LocalDateTime at) {
        String parentHash = ledger.isEmpty() ? HckEntry.GENESIS : ledger.getLast().hash();
        String atText = at.truncatedTo(ChronoUnit.SECONDS).toString();
        HckEntry body = new HckEntry(ledger.size(), event, docCode, copyCode, parentCopyCode, name, recipientType,
                viewer, atText, parentHash, null, null);
        String hash = hash(body);
        return new HckEntry(body.seq(), event, docCode, copyCode, parentCopyCode, name, recipientType, viewer,
                atText, parentHash, hash, HEX.formatHex(hmac(signKey, hash)));
    }

    /**
     * 장부 검증. 첫 번째로 깨진 줄과 이유를 돌려준다.
     * 줄끼리의 사본 연결(앞 줄 사본 = 이번 줄의 부모 사본)과 문서 일치도 함께 본다.
     */
    public Verification verify(List<HckEntry> ledger, String docCode) {
        if (ledger.isEmpty()) {
            return Verification.broken(0, "장부가 비어 있습니다");
        }
        String parentHash = HckEntry.GENESIS;
        for (int i = 0; i < ledger.size(); i++) {
            HckEntry e = ledger.get(i);
            List<String> problems = new ArrayList<>();
            if (e.seq() != i) {
                problems.add("순서 번호 불일치");
            }
            if (!parentHash.equals(e.parentHash())) {
                problems.add("앞 기록과 연결 끊김(삭제·순서 변경 의심)");
            }
            if (e.hash() == null || !e.hash().equals(hash(e))) {
                problems.add("내용이 바뀜(위조 의심)");
            }
            if (e.hash() == null || e.sig() == null || !MessageDigest.isEqual(
                    hmac(signKey, e.hash()), HEX.parseHex(isHex(e.sig()) ? e.sig() : ""))) {
                problems.add("서버 서명 불일치(외부에서 만든 기록)");
            }
            if (!Objects.equals(docCode, e.docCode())) {
                problems.add("다른 문서의 기록");
            }
            if (i > 0 && !Objects.equals(ledger.get(i - 1).copyCode(), e.parentCopyCode())) {
                problems.add("앞 기록의 사본과 이어지지 않음");
            }
            if (!problems.isEmpty()) {
                return Verification.broken(i, String.join(", ", problems));
            }
            parentHash = e.hash();
        }
        return Verification.OK;
    }

    /** 열람 기기 식별값은 원래 값 대신 서버 키로 만든 짧은 값만 장부에 남긴다 */
    public String viewerTag(String viewerId) {
        return HEX.formatHex(hmac(signKey, "viewer" + SEP + viewerId)).substring(0, 16);
    }

    private static String hash(HckEntry e) {
        // 길이가 바뀌는 문자열은 구분자로 이어 붙인다 (구분자는 이름에 들어올 수 없는 제어문자)
        String body = Stream.of(String.valueOf(e.seq()), e.event(), e.docCode(), e.copyCode(), e.parentCopyCode(),
                        e.name(), e.recipientType(), e.viewer(), e.at())
                .map(v -> v == null ? "" : v.replace(SEP, ""))
                .collect(Collectors.joining(SEP));
        try {
            MessageDigest sha = MessageDigest.getInstance("SHA-256");
            return HEX.formatHex(sha.digest((e.parentHash() + SEP + body).getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException ex) {
            throw new IllegalStateException(ex);
        }
    }

    private static byte[] hmac(byte[] key, String message) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            return mac.doFinal(message.getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    private static boolean isHex(String value) {
        return value.length() % 2 == 0 && value.chars().allMatch(c -> Character.digit(c, 16) >= 0);
    }

    public record Verification(boolean ok, Integer brokenAt, String reason) {

        static final Verification OK = new Verification(true, null, null);

        static Verification broken(int index, String reason) {
            return new Verification(false, index, reason);
        }
    }
}
