package com.aks.DeviceLens.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.aks.DeviceLens.exception.GlobalExceptionHandler;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.*;
import java.net.URI;
import java.time.Clock;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class RequestProtectionFilter extends OncePerRequestFilter {
    private static final int MAX_BODY = 8192;
    private final ObjectMapper json;
    private final Clock clock;
    private final String publicOrigin;
    private long window = -1;
    private int requests;
    public RequestProtectionFilter(ObjectMapper json, Clock clock,
            @Value("${devicelens.public-origin:}") String publicOrigin) {
        this.json = json; this.clock = clock; this.publicOrigin = publicOrigin;
    }
    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain chain) throws ServletException, IOException {
        response.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("X-Frame-Options", "DENY");
        response.setHeader("Referrer-Policy", "no-referrer");
        response.setHeader("Permissions-Policy", "geolocation=(), camera=(), microphone=(), payment=(), usb=()");
        response.setHeader("Cache-Control", "no-store");
        // Render terminates TLS at its edge; HTTP local development remains usable.
        if (request.isSecure() || !publicOrigin.isBlank() && publicOrigin.startsWith("https://"))
            response.setHeader("Strict-Transport-Security", "max-age=31536000");
        if (!"POST".equals(request.getMethod()) || !"/api/device-info".equals(request.getRequestURI())) {
            chain.doFilter(request, response); return;
        }
        if (!allowRequest()) {
            response.setHeader("Retry-After", "60");
            reject(response, 429, "RATE_LIMITED", "Too many requests. Please try in a minute."); return;
        }
        String site = request.getHeader("Sec-Fetch-Site");
        String origin = request.getHeader("Origin");
        if ((site != null && !site.equals("same-origin") && !site.equals("none"))
                || (origin != null && !sameOrigin(origin, request))) {
            reject(response, 403, "ORIGIN_REJECTED", "Share reports from the DeviceLens website."); return;
        }
        if (request.getContentLengthLong() > MAX_BODY) {
            reject(response, 413, "PAYLOAD_TOO_LARGE", "Report exceeds the 8 KiB limit."); return;
        }
        // Bound bytes actually read, including chunked requests without Content-Length.
        byte[] body = request.getInputStream().readNBytes(MAX_BODY + 1);
        if (body.length > MAX_BODY) {
            reject(response, 413, "PAYLOAD_TOO_LARGE", "Report exceeds the 8 KiB limit."); return;
        }
        chain.doFilter(new HttpServletRequestWrapper(request) {
            @Override public ServletInputStream getInputStream() {
                var bytes = new ByteArrayInputStream(body);
                return new ServletInputStream() {
                    @Override public int read() { return bytes.read(); }
                    @Override public boolean isFinished() { return bytes.available() == 0; }
                    @Override public boolean isReady() { return true; }
                    @Override public void setReadListener(ReadListener listener) { throw new UnsupportedOperationException(); }
                };
            }
            @Override public BufferedReader getReader() { return new BufferedReader(new InputStreamReader(getInputStream(), java.nio.charset.StandardCharsets.UTF_8)); }
        }, response);
    }
    private synchronized boolean allowRequest() {
        long current = clock.instant().getEpochSecond() / 60;
        if (current != window) { window = current; requests = 0; }
        return ++requests <= 120;
    }
    private boolean sameOrigin(String origin, HttpServletRequest request) {
        try {
            URI actual = URI.create(origin);
            URI expected = URI.create(publicOrigin.isBlank() ? request.getRequestURL().toString() : publicOrigin);
            return actual.getUserInfo() == null && actual.getHost() != null
                    && actual.getScheme().equalsIgnoreCase(expected.getScheme())
                    && actual.getHost().equalsIgnoreCase(expected.getHost()) && port(actual) == port(expected)
                    && (actual.getRawPath() == null || actual.getRawPath().isEmpty());
        } catch (IllegalArgumentException e) { return false; }
    }
    private int port(URI uri) { return uri.getPort() != -1 ? uri.getPort() : "https".equals(uri.getScheme()) ? 443 : 80; }
    private void reject(HttpServletResponse response, int status, String code, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/problem+json");
        json.writeValue(response.getOutputStream(), GlobalExceptionHandler.problem(status, code, message));
    }
}
