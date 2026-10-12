package com.aks.DeviceLens.service;

import com.aks.DeviceLens.dto.DeviceInfoRequest;
import com.aks.DeviceLens.exception.ReportException;
import java.time.*;
import java.util.UUID;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DeviceReportServiceTest {
    @Mock EmailService email;
    Clock clock = Clock.fixed(Instant.parse("2026-10-12T10:00:00Z"), ZoneOffset.UTC);
    DeviceReportService service;
    @BeforeEach void setup() { service = new DeviceReportService(email, new SubmissionLimits(clock), clock); }
    static DeviceInfoRequest report(UUID id, String model) {
        return new DeviceInfoRequest(id, true, "desktop", null, model, null, null, null, null, null, null, null, null, null);
    }
    @Test void submit_missingFields_shouldSendUnavailable() {
        var result = service.submit(report(UUID.randomUUID(), null));
        assertThat(result.success()).isTrue();
        verify(email).send(argThat(fields -> fields.get("Model").equals("Unavailable") && fields.size() == 12), eq(clock.instant()));
    }
    @Test void submit_duplicate_shouldSendOnlyOnce() {
        var request = report(UUID.randomUUID(), "Unavailable");
        assertThat(service.submit(request)).isEqualTo(service.submit(request));
        verify(email, times(1)).send(anyMap(), any());
    }
    @Test void submit_changedPayload_shouldRejectSameId() {
        var id = UUID.randomUUID(); service.submit(report(id, "first"));
        assertThatThrownBy(() -> service.submit(report(id, "second"))).isInstanceOf(ReportException.class)
                .extracting("status").isEqualTo(409);
        verify(email, times(1)).send(anyMap(), any());
    }
    @Test void submit_providerFailure_shouldKeepOutcomeWithoutResending() {
        doThrow(new ReportException(502, "EMAIL_UNCONFIRMED", "Safe error")).when(email).send(anyMap(), any());
        var request = report(UUID.randomUUID(), "Unavailable");
        assertThatThrownBy(() -> service.submit(request)).isInstanceOf(ReportException.class);
        assertThatThrownBy(() -> service.submit(request)).isInstanceOf(ReportException.class);
        verify(email, times(1)).send(anyMap(), any());
    }
    @Test void submit_seventhRequest_shouldRateLimit() {
        for (int i = 0; i < 6; i++) service.submit(report(UUID.randomUUID(), null));
        assertThatThrownBy(() -> service.submit(report(UUID.randomUUID(), null)))
                .isInstanceOf(ReportException.class).extracting("status").isEqualTo(429);
        verify(email, times(6)).send(anyMap(), any());
    }
    @Test void submit_concurrentDuplicate_shouldNotStartSecondEmail() throws Exception {
        var started = new CountDownLatch(1); var release = new CountDownLatch(1);
        doAnswer(invocation -> { started.countDown(); assertThat(release.await(5, TimeUnit.SECONDS)).isTrue(); return null; })
                .when(email).send(anyMap(), any());
        var request = report(UUID.randomUUID(), null);
        try (var executor = Executors.newSingleThreadExecutor()) {
            var first = executor.submit(() -> service.submit(request));
            try {
                assertThat(started.await(5, TimeUnit.SECONDS)).isTrue();
                assertThatThrownBy(() -> service.submit(request)).isInstanceOf(ReportException.class)
                        .extracting("code").isEqualTo("SUBMISSION_PENDING");
            } finally { release.countDown(); }
            assertThat(first.get(5, TimeUnit.SECONDS).success()).isTrue();
        }
        verify(email, times(1)).send(anyMap(), any());
    }
    @Test void fields_controlsAndBlank_shouldSanitize() {
        assertThat(report(UUID.randomUUID(), "\r\n").fields().get("Model")).isEqualTo("Unavailable");
    }
    @Test void limits_newMinute_shouldRestoreCapacity() {
        var mutable = mock(Clock.class);
        when(mutable.instant()).thenReturn(clock.instant());
        var limits = new SubmissionLimits(mutable);
        for (int i = 0; i < 6; i++) limits.acquire();
        assertThatThrownBy(limits::acquire).isInstanceOf(ReportException.class);
        when(mutable.instant()).thenReturn(clock.instant().plusSeconds(60));
        assertThatCode(limits::acquire).doesNotThrowAnyException();
    }
}
