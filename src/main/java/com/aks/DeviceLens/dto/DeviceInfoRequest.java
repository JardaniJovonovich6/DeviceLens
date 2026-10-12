package com.aks.DeviceLens.dto;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import jakarta.validation.constraints.*;

public record DeviceInfoRequest(
        @NotNull UUID submissionId,
        @NotNull @AssertTrue Boolean consent,
        @Pattern(regexp = "mobile|tablet|desktop|Unavailable") String deviceCategory,
        @Size(max = 120) String manufacturer,
        @Size(max = 120) String model,
        @Size(max = 120) String modelNumber,
        @Size(max = 120) String operatingSystem,
        @Size(max = 120) String osVersion,
        @Size(max = 120) String browser,
        @Size(max = 120) String browserVersion,
        @Size(max = 120) String screenResolution,
        @Size(max = 120) String pixelRatio,
        @Size(max = 120) String deviceMemory,
        @Size(max = 120) String processorCount) {
    public Map<String, String> fields() {
        Map<String, String> fields = new LinkedHashMap<>();
        fields.put("Device Category", clean(deviceCategory));
        fields.put("Manufacturer", clean(manufacturer));
        fields.put("Model", clean(model));
        fields.put("Model Number", clean(modelNumber));
        fields.put("Operating System", clean(operatingSystem));
        fields.put("OS Version", clean(osVersion));
        fields.put("Browser", clean(browser));
        fields.put("Browser Version", clean(browserVersion));
        fields.put("Screen Resolution", clean(screenResolution));
        fields.put("Pixel Ratio", clean(pixelRatio));
        fields.put("Device Memory", clean(deviceMemory));
        fields.put("Processor Count", clean(processorCount));
        return fields;
    }
    private static String clean(String value) {
        if (value == null) return "Unavailable";
        String clean = value.replaceAll("[\\p{Cc}\\p{Cf}]", " ").strip();
        return clean.isEmpty() ? "Unavailable" : clean;
    }
    @Override public String toString() { return "DeviceInfoRequest[redacted]"; }
}
