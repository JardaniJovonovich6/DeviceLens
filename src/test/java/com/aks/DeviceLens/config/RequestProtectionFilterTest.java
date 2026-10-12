package com.aks.DeviceLens.config;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.*;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.*;
import static org.assertj.core.api.Assertions.*;

class RequestProtectionFilterTest {
    final Clock clock = Clock.fixed(Instant.EPOCH, ZoneOffset.UTC);
    final RequestProtectionFilter filter = new RequestProtectionFilter(new ObjectMapper(), clock, "https://devicelens.example");
    MockHttpServletRequest request() {
        var request = new MockHttpServletRequest("POST", "/api/device-info");
        request.setContentType("application/json"); request.setContent("{}".getBytes());
        return request;
    }
    @Test void filter_chunkedOversize_shouldRejectActualBytes() throws Exception {
        var request = new MockHttpServletRequest("POST", "/api/device-info") {
            @Override public long getContentLengthLong() { return -1; }
            @Override public int getContentLength() { return -1; }
        };
        request.setContent(new byte[8193]);
        var response = new MockHttpServletResponse(); var passed = new AtomicBoolean();
        filter.doFilter(request, response, (req, res) -> passed.set(true));
        assertThat(response.getStatus()).isEqualTo(413); assertThat(passed).isFalse();
    }
    @Test void filter_requestBudget_shouldLimitWithoutIpStorage() throws Exception {
        for (int i = 0; i < 120; i++) {
            var response = new MockHttpServletResponse();
            filter.doFilter(request(), response, (req, res) -> {});
            assertThat(response.getStatus()).isEqualTo(200);
        }
        var response = new MockHttpServletResponse();
        filter.doFilter(request(), response, (req, res) -> {throw new AssertionError("Should be blocked");});
        assertThat(response.getStatus()).isEqualTo(429); assertThat(response.getHeader("Retry-After")).isEqualTo("60");
    }
    @Test void filter_publicOrigin_shouldAcceptExpectedOriginAndAddHsts() throws Exception {
        var request = request(); request.addHeader("Origin", "https://devicelens.example");
        var response = new MockHttpServletResponse(); var passed = new AtomicBoolean();
        filter.doFilter(request, response, (req, res) -> passed.set(true));
        assertThat(passed).isTrue(); assertThat(response.getHeader("Strict-Transport-Security")).contains("31536000");
        assertThat(response.getHeader("Content-Security-Policy")).contains("frame-ancestors 'none'");
    }
    @Test void filter_sameSiteDifferentOrigin_shouldReject() throws Exception {
        var request = request(); request.addHeader("Sec-Fetch-Site", "same-site");
        var response = new MockHttpServletResponse();
        filter.doFilter(request, response, (req, res) -> {throw new AssertionError("Should be blocked");});
        assertThat(response.getStatus()).isEqualTo(403);
    }
}
