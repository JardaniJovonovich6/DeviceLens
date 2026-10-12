package com.aks.DeviceLens.service;
import com.aks.DeviceLens.config.EmailConfig.EmailProperties;
import com.aks.DeviceLens.exception.ReportException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.http.*;
import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.Flow;
import java.nio.ByteBuffer;
import java.io.ByteArrayOutputStream;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EmailServiceTest {
    @Mock HttpClient client;
    @Mock HttpResponse<String> response;
    EmailService service;
    @BeforeEach void setup() {
        service = new EmailService(client, new ObjectMapper(), new EmailProperties("test-key", "admin@example.com", "sender@example.com"));
    }
    @Test void send_acceptedResponse_shouldEscapeHtmlAndUseTimeout() throws Exception {
        when(client.send(any(), ArgumentMatchers.<HttpResponse.BodyHandler<String>>any())).thenReturn(response);
        when(response.statusCode()).thenReturn(201); when(response.body()).thenReturn("{\"messageId\":\"test-id\"}");
        service.send(Map.of("Model", "<script>alert(1)</script>"), Instant.EPOCH);
        var captor = ArgumentCaptor.forClass(HttpRequest.class);
        verify(client).send(captor.capture(), ArgumentMatchers.<HttpResponse.BodyHandler<String>>any());
        var request = captor.getValue();
        assertThat(request.uri().toString()).isEqualTo("https://api.brevo.com/v3/smtp/email");
        assertThat(request.timeout().orElseThrow().toSeconds()).isEqualTo(8);
        assertThat(request.headers().firstValue("api-key")).contains("test-key");
        var bytes = new ByteArrayOutputStream();
        request.bodyPublisher().orElseThrow().subscribe(new Flow.Subscriber<ByteBuffer>() {
            public void onSubscribe(Flow.Subscription s) { s.request(Long.MAX_VALUE); }
            public void onNext(ByteBuffer buffer) { byte[] data = new byte[buffer.remaining()]; buffer.get(data); bytes.writeBytes(data); }
            public void onError(Throwable t) { throw new AssertionError(t); }
            public void onComplete() { }
        });
        var body = new ObjectMapper().readTree(bytes.toByteArray());
        assertThat(body.path("htmlContent").asText()).contains("&lt;script&gt;").doesNotContain("<script>");
        assertThat(body.path("subject").asText()).isEqualTo("DeviceLens | New Device Report");
    }
    @Test void send_brevoRejects_shouldReturnSafeFailure() throws Exception {
        when(client.send(any(), ArgumentMatchers.<HttpResponse.BodyHandler<String>>any())).thenReturn(response);
        when(response.statusCode()).thenReturn(401);
        assertThatThrownBy(() -> service.send(Map.of(), Instant.EPOCH)).isInstanceOf(ReportException.class)
                .extracting("status").isEqualTo(502);
    }
    @Test void send_noMessageId_shouldNotClaimSuccess() throws Exception {
        when(client.send(any(), ArgumentMatchers.<HttpResponse.BodyHandler<String>>any())).thenReturn(response);
        when(response.statusCode()).thenReturn(201); when(response.body()).thenReturn("{}");
        assertThatThrownBy(() -> service.send(Map.of(), Instant.EPOCH)).isInstanceOf(ReportException.class);
    }
    @Test void send_networkTimeout_shouldNotRetry() throws Exception {
        when(client.send(any(), ArgumentMatchers.<HttpResponse.BodyHandler<String>>any())).thenThrow(new IOException("private provider detail"));
        assertThatThrownBy(() -> service.send(Map.of(), Instant.EPOCH)).isInstanceOf(ReportException.class)
                .hasMessageNotContaining("private provider detail");
        verify(client, times(1)).send(any(), ArgumentMatchers.<HttpResponse.BodyHandler<String>>any());
    }
    @Test void send_missingConfiguration_shouldFailWithoutNetwork() {
        service = new EmailService(client, new ObjectMapper(), new EmailProperties("", "", ""));
        assertThatThrownBy(() -> service.send(Map.of(), Instant.EPOCH)).isInstanceOf(ReportException.class)
                .extracting("status").isEqualTo(503);
        verifyNoInteractions(client);
    }
}
