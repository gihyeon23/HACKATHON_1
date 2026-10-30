package com.inu.jeongbobada.domain.hck.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.inu.jeongbobada.domain.document.entity.Document;
import com.inu.jeongbobada.domain.document.repository.DocumentRepository;
import com.inu.jeongbobada.domain.recipient.repository.RecipientRepository;
import com.inu.jeongbobada.global.engine.EngineClient;
import com.inu.jeongbobada.support.TestSupport;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Base64;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.core.io.Resource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

@SpringBootTest
@AutoConfigureMockMvc
class HckControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JsonMapper jsonMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private DocumentRepository documentRepository;

    @Autowired
    private RecipientRepository recipientRepository;

    @MockitoBean
    private EngineClient engineClient;

    @BeforeEach
    void setUp() {
        TestSupport.cleanDatabase(jdbcTemplate);
        ObjectNode embedded = (ObjectNode) jsonMapper.readTree("""
                {"width": 24, "height": 14, "strength": 4.0, "psnr": 37.2, "ssim": 0.955, "imagePng": "%s"}
                """.formatted(Base64.getEncoder().encodeToString(TestSupport.png(30, 20))));
        given(engineClient.embed(anyLong(), any(Resource.class))).willReturn(embedded);
        given(engineClient.embed(anyLong(), isNull())).willReturn(embedded);
        Document document = TestSupport.document(documentRepository, "DOC-A001");
        TestSupport.chain(recipientRepository, document, "COPY-B", 100, "유기현");
    }

    @AfterEach
    void tearDown() {
        TestSupport.cleanDatabase(jdbcTemplate);
    }

    @Test
    void 사본_주인이_열면_새_사본_없이_기기만_연결되고_다시_열어도_그대로다() throws Exception {
        byte[] issued = export("COPY-B01");

        JsonNode claimed = body(open(issued, "유기현", null, "device-A").andExpect(status().isOk()));
        assertThat(claimed.get("copyCode").asString()).isEqualTo("COPY-B01");
        assertThat(claimed.get("reopened").asBoolean()).isTrue();
        assertThat(claimed.get("ledger").size()).isEqualTo(2);
        assertThat(claimed.get("ledger").get(1).get("event").asString()).isEqualTo("CLAIM");

        JsonNode again = body(open(hck(claimed), "아무개", null, "device-A").andExpect(status().isOk()));
        assertThat(again.get("copyCode").asString()).isEqualTo("COPY-B01");
        assertThat(again.get("ledger").size()).isEqualTo(2);
        assertThat(recipientRepository.count()).isEqualTo(1);
    }

    @Test
    void 카톡으로_넘겨받은_사람이_열면_열람자_사본이_발급되고_경로에_이어진다() throws Exception {
        JsonNode a = body(open(export("COPY-B01"), "유기현", null, "device-A"));

        // 유기현 → C (카톡), C → D (이메일)
        JsonNode c = body(open(hck(a), "협력사 C", "PARTNER", "device-C").andExpect(status().isOk()));
        assertThat(c.get("reopened").asBoolean()).isFalse();
        assertThat(c.get("parentCopyCode").asString()).isEqualTo("COPY-B01");
        assertThat(c.get("parentName").asString()).isEqualTo("유기현");
        assertThat(c.get("imageUrl").asString()).isEqualTo("/api/copies/" + c.get("copyCode").asString() + "/file");

        JsonNode d = body(open(hck(c), "외부인 D", null, "device-D").andExpect(status().isOk()));
        assertThat(d.get("parentName").asString()).isEqualTo("협력사 C");

        mockMvc.perform(get("/api/copies/" + d.get("copyCode").asString() + "/path"))
                .andExpect(jsonPath("$.length()").value(4))
                .andExpect(jsonPath("$[1].name").value("유기현"))
                .andExpect(jsonPath("$[2].name").value("협력사 C"))
                .andExpect(jsonPath("$[2].recipientType").value("PARTNER"))
                .andExpect(jsonPath("$[3].name").value("외부인 D"))
                .andExpect(jsonPath("$[3].role").value("식별된 사본"));
    }

    @Test
    void 장부를_고치거나_줄을_지우면_열지_않는다() throws Exception {
        JsonNode c = body(open(hck(body(open(export("COPY-B01"), "유기현", null, "device-A"))),
                "협력사 C", null, "device-C"));
        byte[] file = hck(c);

        ArrayNode renamed = ledger(file);
        ((ObjectNode) renamed.get(2)).put("name", "누군가");
        open(withLedger(file, renamed), "D", null, "device-D")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("HCK_TAMPERED"));

        // 중간 줄 삭제 (끝줄만 잘라내는 것은 정상적인 분기와 구별할 수 없어 장부만으로는 막지 못한다)
        ArrayNode removed = ledger(file);
        removed.remove(1);
        open(withLedger(file, removed), "D", null, "device-D")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("HCK_TAMPERED"));
    }

    @Test
    void 보호_파일이_아니거나_이름이_없으면_거부한다() throws Exception {
        open("hello".getBytes(), "D", null, "x")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("HCK_INVALID"));
        open(export("COPY-B01"), " ", null, "device-X")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        mockMvc.perform(get("/api/copies/COPY-NONE/hck"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COPY_NOT_FOUND"));
    }

    private byte[] export(String copyCode) throws Exception {
        return mockMvc.perform(get("/api/copies/" + copyCode + "/hck"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"" + copyCode + ".hck\""))
                .andReturn().getResponse().getContentAsByteArray();
    }

    private ResultActions open(byte[] file, String name, String type, String viewerId) throws Exception {
        var request = multipart("/api/hck/open")
                .file(new MockMultipartFile("file", "doc.hck", "application/octet-stream", file))
                .param("name", name)
                .param("viewerId", viewerId);
        if (type != null) {
            request.param("recipientType", type);
        }
        return mockMvc.perform(request);
    }

    private JsonNode body(ResultActions result) throws Exception {
        return jsonMapper.readTree(result.andReturn().getResponse().getContentAsString());
    }

    private static byte[] hck(JsonNode opened) {
        return Base64.getDecoder().decode(opened.get("hckBase64").asString());
    }

    private ArrayNode ledger(byte[] file) throws IOException {
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(file))) {
            for (ZipEntry e; (e = zip.getNextEntry()) != null; ) {
                if (e.getName().equals("ledger.json")) {
                    return (ArrayNode) jsonMapper.readTree(zip.readAllBytes());
                }
            }
        }
        throw new IllegalStateException("ledger.json 없음");
    }

    private byte[] withLedger(byte[] file, ArrayNode ledger) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ZipInputStream in = new ZipInputStream(new ByteArrayInputStream(file));
             ZipOutputStream zip = new ZipOutputStream(out)) {
            for (ZipEntry e; (e = in.getNextEntry()) != null; ) {
                zip.putNextEntry(new ZipEntry(e.getName()));
                zip.write(e.getName().equals("ledger.json") ? jsonMapper.writeValueAsBytes(ledger) : in.readAllBytes());
                zip.closeEntry();
            }
        }
        return out.toByteArray();
    }
}
