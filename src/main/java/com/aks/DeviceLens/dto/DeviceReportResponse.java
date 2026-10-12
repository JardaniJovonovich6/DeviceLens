package com.aks.DeviceLens.dto;
public record DeviceReportResponse(boolean success, String status, String message) {
    public static DeviceReportResponse accepted() {
        return new DeviceReportResponse(true, "accepted", "Email request accepted by the provider.");
    }
}
