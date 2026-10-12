package com.aks.DeviceLens.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ProblemDetail;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Static utility: no report ingestion and no browser-initiated data connections. */
@Component
public class SecurityHeadersFilter extends OncePerRequestFilter {
    private final ObjectMapper json;
    private final String externalUrl;

    public SecurityHeadersFilter(ObjectMapper json, @Value("${RENDER_EXTERNAL_URL:}") String externalUrl) {
        this.json = json;
        this.externalUrl = externalUrl;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain chain) throws ServletException, IOException {
        response.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'");
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("X-Frame-Options", "DENY");
        response.setHeader("Referrer-Policy", "no-referrer");
        response.setHeader("Permissions-Policy", "geolocation=(), camera=(), microphone=(), payment=(), usb=(), accelerometer=(), gyroscope=(), magnetometer=()");
        response.setHeader("Cache-Control", "no-store");
        if (request.isSecure() || externalUrl.startsWith("https://")) {
            response.setHeader("Strict-Transport-Security", "max-age=31536000");
        }
        if (request.getRequestURI().startsWith("/api/")) {
            reject(response, 404, "There is no report collection API.");
            return;
        }
        if (!request.getMethod().equals("GET") && !request.getMethod().equals("HEAD")) {
            response.setHeader("Allow", "GET, HEAD");
            reject(response, 405, "This inspector only serves read-only pages.");
            return;
        }
        chain.doFilter(request, response);
    }

    private void reject(HttpServletResponse response, int status, String detail) throws IOException {
        response.setStatus(status);
        response.setContentType("application/problem+json");
        json.writeValue(response.getOutputStream(), ProblemDetail.forStatusAndDetail(
                org.springframework.http.HttpStatusCode.valueOf(status), detail));
    }
}
