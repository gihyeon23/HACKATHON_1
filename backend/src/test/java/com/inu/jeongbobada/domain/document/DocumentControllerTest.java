package com.inu.jeongbobada.domain.document;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.inu.jeongbobada.global.engine.EngineClient;
import com.inu.jeongbobada.support.TestSupport;
import java.util.Base64;
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
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

@SpringBootTest
@AutoConfigureMockMvc
class DocumentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JsonMapper jsonMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @MockitoBean
    private EngineClient engineClient;

    private final byte[] distributed = TestSupport.png(30, 20);

    @BeforeEach
    void setUp() {
        TestSupport.cleanDatabase(jdbcTemplate);
        ObjectNode embedded = (ObjectNode) jsonMapper.readTree("""
                {"width": 24, "height": 14, "frame": 3, "strength": 4.0, "predictedZ": 6.6, "threshold": 5.0,
                 "psnr": 37.2, "ssim": 0.955, "elapsedMs": 2100.0, "imagePng": "%s"}
                """.formatted(Base64.getEncoder().encodeToString(distributed)));
        given(engineClient.embed(anyLong(), any(Resource.class))).willReturn(embedded);
        given(engineClient.embed(anyLong(), isNull())).willReturn(embedded);
    }

    @AfterEach
    void tearDown() {
        TestSupport.cleanDatabase(jdbcTemplate);
    }

    @Test
    void 원본을_등록하고_부모를_지정해_사본을_발급하면_대장과_경로에_반영된다() throws Exception {
        mockMvc.perform(multipart("/api/documents").param("title", "OLED 설계도")
                        .file(new MockMultipartFile("image", "oled.png", "image/png", TestSupport.png(24, 14))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.docCode").value("DOC-A001"))
                .andExpect(jsonPath("$.width").value(24));

        String parentCode = copyCode(mockMvc.perform(multipart("/api/documents/DOC-A001/copies")
                        .param("name", "직원 B").param("recipientType", "EMPLOYEE"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.copyCode").value(org.hamcrest.Matchers.matchesPattern("COPY-[A-Z]\\d{3}")))
                .andExpect(jsonPath("$.parentCopyCode").isEmpty())
                .andExpect(jsonPath("$.imagePng").doesNotExist())
                .andExpect(jsonPath("$.psnr").value(37.2))
                .andReturn().getResponse().getContentAsString());

        String childCode = copyCode(mockMvc.perform(multipart("/api/documents/DOC-A001/copies")
                        .param("name", "협력사 C").param("recipientType", "PARTNER")
                        .param("parentCopyCode", parentCode))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.parentCopyCode").value(parentCode))
                .andReturn().getResponse().getContentAsString());

        mockMvc.perform(get("/api/recipients"))
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[1].copyCode").value(childCode))
                .andExpect(jsonPath("$[1].parentCopyCode").value(parentCode))
                .andExpect(jsonPath("$[1].docCode").value("DOC-A001"))
                .andExpect(jsonPath("$[1].recipientType").value("PARTNER"));

        mockMvc.perform(get("/api/copies/{code}/path", childCode))
                .andExpect(jsonPath("$.length()").value(3));

        mockMvc.perform(get("/api/copies/{code}/file", childCode).param("download", "1"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("image/png"))
                .andExpect(header().string("Content-Disposition",
                        org.hamcrest.Matchers.startsWith("attachment")))
                .andExpect(content().bytes(distributed));
    }

    @Test
    void 잘못된_배포_대상_유형은_400() throws Exception {
        mockMvc.perform(multipart("/api/documents").param("title", "OLED 설계도"))
                .andExpect(status().isCreated());
        mockMvc.perform(multipart("/api/documents/DOC-A001/copies")
                        .param("name", "직원 B").param("recipientType", "FRIEND"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    private String copyCode(String body) {
        return jsonMapper.readTree(body).get("copyCode").asString();
    }
}
