package com.aks.DeviceLens.controller;
import com.aks.DeviceLens.config.RequestProtectionFilter;
import com.aks.DeviceLens.dto.DeviceReportResponse;
import com.aks.DeviceLens.service.DeviceReportService;
import java.time.Clock;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.*;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(DeviceInfoController.class)
@Import(DeviceInfoControllerTest.Config.class)
class DeviceInfoControllerTest {
    @TestConfiguration static class Config { @Bean Clock clock() { return Clock.systemUTC(); } }
    @Autowired MockMvc mvc;
    @MockitoBean DeviceReportService reports;
    private static final String BASE = "\"submissionId\":\"a791881a-f161-4b5a-8bfa-aa9e6a26a121\",\"consent\":true";
    @Test void post_validConsentAndMissingFields_shouldAccept() throws Exception {
        when(reports.submit(any())).thenReturn(DeviceReportResponse.accepted());
        mvc.perform(post("/api/device-info").contentType("application/json").content("{" + BASE + "}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.success").value(true))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"));
    }
    @Test void post_unavailableFields_shouldAccept() throws Exception {
        when(reports.submit(any())).thenReturn(DeviceReportResponse.accepted());
        mvc.perform(post("/api/device-info").contentType("application/json").content("{" + BASE + ",\"model\":\"Unavailable\",\"deviceCategory\":\"Unavailable\"}"))
                .andExpect(status().isOk());
    }
    @Test void post_noConsent_shouldRejectWithoutEmail() throws Exception {
        mvc.perform(post("/api/device-info").contentType("application/json").content("{" + BASE.replace("true", "false") + "}"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(reports);
    }
    @Test void post_emptyObject_shouldReject() throws Exception {
        mvc.perform(post("/api/device-info").contentType("application/json").content("{}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errorCode").value("INVALID_REQUEST"));
        verifyNoInteractions(reports);
    }
    @Test void post_oversizedField_shouldReject() throws Exception {
        mvc.perform(post("/api/device-info").contentType("application/json").content("{" + BASE + ",\"model\":\"" + "x".repeat(121) + "\"}"))
                .andExpect(status().isBadRequest());
    }
    @Test void post_invalidCategory_shouldReject() throws Exception {
        mvc.perform(post("/api/device-info").contentType("application/json").content("{" + BASE + ",\"deviceCategory\":\"robot\"}"))
                .andExpect(status().isBadRequest());
    }
    @Test void post_unknownSensitiveField_shouldReject() throws Exception {
        mvc.perform(post("/api/device-info").contentType("application/json").content("{" + BASE + ",\"imei\":\"test\"}"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(reports);
    }
    @Test void post_largeBody_shouldRejectBeforeParsing() throws Exception {
        mvc.perform(post("/api/device-info").contentType("application/json").content("x".repeat(8193)))
                .andExpect(status().isPayloadTooLarge());
        verifyNoInteractions(reports);
    }
    @Test void post_crossSite_shouldReject() throws Exception {
        mvc.perform(post("/api/device-info").contentType("application/json").header("Origin", "https://evil.example").content("{" + BASE + "}"))
                .andExpect(status().isForbidden());
        verifyNoInteractions(reports);
    }
    @Test void post_sameOrigin_shouldAccept() throws Exception {
        when(reports.submit(any())).thenReturn(DeviceReportResponse.accepted());
        mvc.perform(post("/api/device-info").contentType("application/json").header("Origin", "http://localhost").content("{" + BASE + "}"))
                .andExpect(status().isOk());
    }
    @Test void post_wrongContentType_shouldReject() throws Exception {
        mvc.perform(post("/api/device-info").contentType("text/plain").content("{}"))
                .andExpect(status().isUnsupportedMediaType());
    }
    @Test void post_brevoFailure_shouldReturnSafeProblem() throws Exception {
        when(reports.submit(any())).thenThrow(new com.aks.DeviceLens.exception.ReportException(502, "EMAIL_UNCONFIRMED", "Acceptance unknown."));
        mvc.perform(post("/api/device-info").contentType("application/json").content("{" + BASE + "}"))
                .andExpect(status().isBadGateway()).andExpect(jsonPath("$.errorCode").value("EMAIL_UNCONFIRMED"));
    }
}
