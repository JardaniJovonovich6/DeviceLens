package com.aks.DeviceLens.controller;
import com.aks.DeviceLens.dto.*;
import com.aks.DeviceLens.service.DeviceReportService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
public class DeviceInfoController {
    private final DeviceReportService reports;
    public DeviceInfoController(DeviceReportService reports) { this.reports = reports; }
    @PostMapping(value = "/api/device-info", consumes = "application/json", produces = "application/json")
    public DeviceReportResponse submit(@Valid @RequestBody DeviceInfoRequest request) {
        return reports.submit(request);
    }
}
