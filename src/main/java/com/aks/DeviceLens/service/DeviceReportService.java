package com.aks.DeviceLens.service;
import com.aks.DeviceLens.dto.*;
import com.aks.DeviceLens.exception.ReportException;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class DeviceReportService {
    private final EmailService email;
    private final SubmissionLimits limits;
    private final Clock clock;
    // Only short-lived random attempt IDs, digests and outcomes, never full reports.
    private final Map<UUID, Attempt> attempts = new HashMap<>();
    private static class Attempt {
        final byte[] digest;
        final Instant expires;
        boolean complete;
        ReportException failure;
        Attempt(byte[] digest, Instant expires) { this.digest = digest; this.expires = expires; }
    }
    public DeviceReportService(EmailService email, SubmissionLimits limits, Clock clock) {
        this.email = email; this.limits = limits; this.clock = clock;
    }
    public DeviceReportResponse submit(DeviceInfoRequest request) {
        if (!Boolean.TRUE.equals(request.consent())) throw new ReportException(400, "CONSENT_REQUIRED", "Consent is required to share a report.");
        var fields = request.fields();
        var now = clock.instant();
        var digest = digest(fields);
        Attempt attempt;
        synchronized (attempts) {
            attempts.entrySet().removeIf(e -> e.getValue().complete && e.getValue().expires.isBefore(now));
            var previous = attempts.get(request.submissionId());
            if (previous != null) {
                if (!MessageDigest.isEqual(previous.digest, digest)) throw new ReportException(409, "SUBMISSION_CONFLICT", "This submission ID was already used for another report.");
                if (!previous.complete) throw new ReportException(409, "SUBMISSION_PENDING", "This report is still being submitted. Please retry shortly.");
                if (previous.failure != null) throw previous.failure;
                return DeviceReportResponse.accepted();
            }
            if (attempts.size() >= 1024) throw new ReportException(429, "RATE_LIMITED", "Sharing capacity is temporarily reached. Please try later.");
            limits.acquire();
            attempt = new Attempt(digest, now.plusSeconds(3600));
            attempts.put(request.submissionId(), attempt);
        }
        try {
            email.send(fields, now);
            synchronized (attempts) { attempt.complete = true; }
            return DeviceReportResponse.accepted();
        } catch (RuntimeException e) {
            ReportException safe = e instanceof ReportException r ? r : new ReportException(502, "EMAIL_UNCONFIRMED", "Email acceptance could not be confirmed. Please try later.");
            synchronized (attempts) { attempt.failure = safe; attempt.complete = true; }
            throw safe;
        }
    }
    private byte[] digest(Map<String, String> fields) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            fields.forEach((key, value) -> { digest.update(value.getBytes(StandardCharsets.UTF_8)); digest.update((byte) 0); });
            return digest.digest();
        } catch (NoSuchAlgorithmException e) { throw new IllegalStateException("SHA-256 unavailable"); }
    }
}
