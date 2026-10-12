package com.aks.DeviceLens.config;

import java.net.http.HttpClient;
import java.time.Clock;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(EmailConfig.EmailProperties.class)
public class EmailConfig {
    @ConfigurationProperties("devicelens.email")
    public record EmailProperties(String apiKey, String to, String from) {
        public boolean configured() {
            return apiKey != null && !apiKey.isBlank() && validEmail(to) && validEmail(from);
        }
        private boolean validEmail(String value) {
            return value != null && value.length() <= 254 && value.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+");
        }
        @Override public String toString() { return "EmailProperties[redacted]"; }
    }
    @Bean public HttpClient brevoHttpClient() {
        return HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3))
                .followRedirects(HttpClient.Redirect.NEVER).build();
    }
    @Bean public Clock clock() { return Clock.systemUTC(); }
}
