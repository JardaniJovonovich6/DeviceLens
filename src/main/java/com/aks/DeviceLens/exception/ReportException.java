package com.aks.DeviceLens.exception;
public class ReportException extends RuntimeException {
    private final int status;
    private final String code;
    public ReportException(int status, String code, String message) {
        super(message); this.status = status; this.code = code;
    }
    public int status() { return status; }
    public String code() { return code; }
}
