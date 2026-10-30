package com.inu.jeongbobada.domain.copy;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.inu.jeongbobada.domain.document.Document;
import com.inu.jeongbobada.domain.document.DocumentRepository;
import com.inu.jeongbobada.domain.recipient.Recipient;
import com.inu.jeongbobada.domain.recipient.RecipientRepository;
import com.inu.jeongbobada.global.engine.EngineClient;
import com.inu.jeongbobada.support.TestSupport;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

@SpringBootTest
@AutoConfigureMockMvc
class LineageControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private DocumentRepository documentRepository;

    @Autowired
    private RecipientRepository recipientRepository;

    @MockitoBean
    private EngineClient engineClient;

    private Document document;

    @BeforeEach
    void setUp() {
        TestSupport.cleanDatabase(jdbcTemplate);
        document = TestSupport.document(documentRepository, "DOC-A001");
    }

    @AfterEach
    void tearDown() {
        TestSupport.cleanDatabase(jdbcTemplate);
    }

    @Test
    void 경로_3단계는_원본_중간_식별_순서로_돌려준다() throws Exception {
        TestSupport.chain(recipientRepository, document, "COPY-B", 100, "직원 B", "협력사 C");

        mockMvc.perform(get("/api/copies/COPY-B02/path"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].code").value("DOC-A001"))
                .andExpect(jsonPath("$[0].name").value("OLED 설계도"))
                .andExpect(jsonPath("$[0].type").value("ORIGINAL"))
                .andExpect(jsonPath("$[0].role").value("원본 문서"))
                .andExpect(jsonPath("$[1].code").value("COPY-B01"))
                .andExpect(jsonPath("$[1].name").value("직원 B"))
                .andExpect(jsonPath("$[1].type").value("COPY"))
                .andExpect(jsonPath("$[1].role").value("중간 사본"))
                .andExpect(jsonPath("$[2].code").value("COPY-B02"))
                .andExpect(jsonPath("$[2].role").value("식별된 사본"))
                .andExpect(jsonPath("$[2].createdAt").doesNotExist());
    }

    @Test
    void 같은_원본에서_분기한_5단계_7단계_경로도_길이와_순서가_맞다() throws Exception {
        TestSupport.chain(recipientRepository, document, "COPY-B", 100, "직원 B", "협력사 C");
        List<Recipient> five = TestSupport.chain(recipientRepository, document, "COPY-D", 200,
                "직원 D", "협력사 E", "협력사 F", "협력사 G");
        List<Recipient> seven = TestSupport.chain(recipientRepository, document, "COPY-H", 300,
                "직원 H", "직원 J", "협력사 K", "협력사 M", "협력사 N", "협력사 P");

        assertPath(mockMvc.perform(get("/api/copies/COPY-D04/path")), five);
        assertPath(mockMvc.perform(get("/api/copies/COPY-H06/path")), seven);
    }

    @Test
    void 한_부모에서_나온_형제_사본은_각자의_경로를_가진다() throws Exception {
        List<Recipient> base = TestSupport.chain(recipientRepository, document, "COPY-B", 100, "직원 B");
        recipientRepository.save(Recipient.builder().recipientId(901L).name("협력사 X").width(1).height(1)
                .document(document).parentRecipient(base.get(0)).copyCode("COPY-X01").build());
        recipientRepository.save(Recipient.builder().recipientId(902L).name("협력사 Y").width(1).height(1)
                .document(document).parentRecipient(base.get(0)).copyCode("COPY-Y01").build());

        mockMvc.perform(get("/api/copies/COPY-Y01/path"))
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[1].code").value("COPY-B01"))
                .andExpect(jsonPath("$[2].code").value("COPY-Y01"));
    }

    @Test
    void 순환_참조가_있으면_무한_루프_없이_409() throws Exception {
        List<Recipient> copies = TestSupport.chain(recipientRepository, document, "COPY-B", 100,
                "직원 B", "협력사 C");
        // B → C 인 상태에서 B 의 부모를 C 로 바꿔 순환을 만든다
        jdbcTemplate.update("update recipient set parent_recipient_id = ? where id = ?",
                copies.get(1).getId(), copies.get(0).getId());

        mockMvc.perform(get("/api/copies/COPY-B02/path"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("LINEAGE_CYCLE"));
    }

    @Test
    void 없는_사본은_404() throws Exception {
        mockMvc.perform(get("/api/copies/COPY-Z999/path"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COPY_NOT_FOUND"));
    }

    private static void assertPath(ResultActions result, List<Recipient> copies) throws Exception {
        result.andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(copies.size() + 1))
                .andExpect(jsonPath("$[0].code").value("DOC-A001"))
                .andExpect(jsonPath("$[0].role").value("원본 문서"));
        for (int i = 0; i < copies.size(); i++) {
            boolean last = i == copies.size() - 1;
            result.andExpect(jsonPath("$[%d].code".formatted(i + 1)).value(copies.get(i).getCopyCode()))
                    .andExpect(jsonPath("$[%d].role".formatted(i + 1)).value(last ? "식별된 사본" : "중간 사본"));
        }
    }
}
