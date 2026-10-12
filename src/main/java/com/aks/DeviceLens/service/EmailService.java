package com.aks.DeviceLens.service;

import com.aks.DeviceLens.config.EmailConfig.EmailProperties;
import com.aks.DeviceLens.exception.ReportException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

@Service
public class EmailService {
    private final HttpClient client;
    private final ObjectMapper json;
    private final EmailProperties config;
    public EmailService(HttpClient client, ObjectMapper json, EmailProperties config) {
        this.client = client; this.json = json; this.config = config;
    }
    public void send(Map<String, String> fields, Instant timestamp) {
        if (!config.configured()) throw new ReportException(503, "EMAIL_NOT_CONFIGURED", "Email sharing is temporarily unavailable.");
        StringBuilder text = new StringBuilder("New Device Report\n\nTimestamp: " + timestamp + "\n");
        StringBuilder html = new StringBuilder("<h1>New Device Report</h1><p>Timestamp: " + timestamp + "</p><table>");
        fields.forEach((label, value) -> {
            text.append(label).append(": ").append(value).append('\n');
            html.append("<tr><th align=\"left\">").append(HtmlUtils.htmlEscape(label))
                .append("</th><td>").append(HtmlUtils.htmlEscape(value)).append("</td></tr>");
        });
        html.append("</table>");
        try {
            var body = Map.of("sender", Map.of("name", "DeviceLens", "email", config.from()),
                    "to", List.of(Map.of("email", config.to())), "subject", "DeviceLens | New Device Report",
                    "textContent", text.toString(), "htmlContent", html.toString());
            var request = HttpRequest.newBuilder(URI.create("https://api.brevo.com/v3/smtp/email"))
                    .timeout(Duration.ofSeconds(8)).header("api-key", config.apiKey())
                    .header("Accept", "application/json").header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body))).build();
            var response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 201) throw failed();
            var messageId = json.readTree(response.body()).path("messageId");
            if (!messageId.isTextual() || messageId.asText().isBlank()) throw failed();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt(); throw failed();
        } catch (IOException | IllegalArgumentException e) {
            throw failed();
        }
    }
    private static ReportException failed() {
        return new ReportException(502, "EMAIL_UNCONFIRMED", "Email acceptance could not be confirmed. To avoid duplicates, this attempt will not be sent again. Please try later.");
    }
}
