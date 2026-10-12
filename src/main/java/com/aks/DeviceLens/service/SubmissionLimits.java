package com.aks.DeviceLens.service;
import com.aks.DeviceLens.exception.ReportException;
import java.time.Clock;
import org.springframework.stereotype.Component;

/** Global fixed windows, without storing IPs or visitor identifiers. Single-instance service. */
@Component
public class SubmissionLimits {
    private final Clock clock;
    private long minute = -1, hour = -1, day = -1;
    private int minuteCount, hourCount, dayCount;
    public SubmissionLimits(Clock clock) { this.clock = clock; }
    public synchronized void acquire() {
        long seconds = clock.instant().getEpochSecond();
        if (minute != seconds / 60) { minute = seconds / 60; minuteCount = 0; }
        if (hour != seconds / 3600) { hour = seconds / 3600; hourCount = 0; }
        if (day != seconds / 86400) { day = seconds / 86400; dayCount = 0; }
        if (minuteCount >= 6 || hourCount >= 60 || dayCount >= 200)
            throw new ReportException(429, "RATE_LIMITED", "Sharing capacity is temporarily reached. Please try later.");
        minuteCount++; hourCount++; dayCount++;
    }
}
