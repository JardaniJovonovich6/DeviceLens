package com.aks.DeviceLens;

import java.net.http.HttpClient;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.test.web.servlet.MockMvc;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.hamcrest.Matchers.containsString;

@SpringBootTest
@AutoConfigureMockMvc
class PrivacyApplicationTest {
    @Autowired MockMvc mvc;
    @Autowired ApplicationContext context;

    @Test void landing_shouldServePrivacyInspectorAndRestrictiveHeaders() throws Exception {
        mvc.perform(get("/")).andExpect(status().isOk())
            .andExpect(forwardedUrl("index.html"))
            .andExpect(header().string("Content-Security-Policy", containsString("connect-src 'none'")))
            .andExpect(header().string("Permissions-Policy", containsString("geolocation=()")))
            .andExpect(header().string("Referrer-Policy", "no-referrer"))
            .andExpect(header().doesNotExist("Set-Cookie"));
        mvc.perform(get("/index.html")).andExpect(status().isOk())
            .andExpect(content().string(containsString("BROWSER PRIVACY INSPECTOR")));
    }
    @Test void formerReportEndpoint_shouldNotAcceptReports() throws Exception {
        mvc.perform(post("/api/device-info").contentType("application/json").content("{\"consent\":true}"))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.detail").value("There is no report collection API."));
    }
    @Test void anyPost_shouldBeRejectedWithoutReadingBody() throws Exception {
        mvc.perform(post("/").content("x".repeat(10000)))
            .andExpect(status().isMethodNotAllowed()).andExpect(header().string("Allow", "GET, HEAD"));
    }
    @Test void health_shouldWorkWithoutSecrets() throws Exception {
        mvc.perform(get("/actuator/health")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("UP"));
        assertThat(context.getBeanNamesForType(HttpClient.class)).isEmpty();
    }
    @Test void https_shouldAddHsts() throws Exception {
        mvc.perform(get("/privacy.css").secure(true)).andExpect(status().isOk())
            .andExpect(header().string("Strict-Transport-Security", "max-age=31536000"));
    }
    @Test void assets_shouldBeServedLocally() throws Exception {
        for (String path : new String[]{"/inspector.js", "/inspector-ui.js", "/detection.js", "/privacy.css", "/favicon.svg"}) {
            mvc.perform(get(path)).andExpect(status().isOk()).andExpect(header().string("X-Content-Type-Options", "nosniff"));
        }
    }
    @Test void oldAssets_shouldNotExist() throws Exception {
        mvc.perform(get("/app.js")).andExpect(status().isNotFound());
        mvc.perform(get("/actuator/env")).andExpect(status().isNotFound());
    }
}
