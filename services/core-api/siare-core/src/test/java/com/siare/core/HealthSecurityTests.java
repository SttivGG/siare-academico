package com.siare.core;

import com.siare.core.application.port.out.ReadinessPort;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class HealthSecurityTests {
    @Autowired MockMvc mvc;
    @MockitoBean ReadinessPort readiness;

    @Test
    void anonymousHealthContainsOnlyStatus() throws Exception {
        when(readiness.isReady()).thenReturn(true);
        mvc.perform(get("/health")).andExpect(status().isOk())
                .andExpect(content().json("{\"status\":\"UP\"}", org.springframework.test.json.JsonCompareMode.STRICT));
    }

    @Test
    void dependencyFailureReturnsUnavailableWithoutDetails() throws Exception {
        when(readiness.isReady()).thenReturn(false);
        mvc.perform(get("/health")).andExpect(status().isServiceUnavailable())
                .andExpect(content().json("{\"status\":\"DOWN\"}", org.springframework.test.json.JsonCompareMode.STRICT));
    }

    @Test
    void allOtherRoutesAndMethodsAreDenied() throws Exception {
        mvc.perform(get("/actuator/health")).andExpect(status().isUnauthorized());
        mvc.perform(get("/actuator/env")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/activities")).andExpect(status().isUnauthorized());
        mvc.perform(post("/health")).andExpect(status().isUnauthorized());
    }
}
