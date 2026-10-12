package com.aks.DeviceLens.exception;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(ReportException.class)
    public ResponseEntity<ProblemDetail> report(ReportException e) {
        var response = ResponseEntity.status(e.status());
        if (e.status() == 429) response.header("Retry-After", "3600");
        if (e.code().equals("SUBMISSION_PENDING")) response.header("Retry-After", "2");
        return response.body(problem(e.status(), e.code(), e.getMessage()));
    }
    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class})
    public ResponseEntity<ProblemDetail> invalid(Exception e) {
        return ResponseEntity.badRequest().body(problem(400, "INVALID_REQUEST", "Provide a valid JSON report with explicit consent and fields no longer than 120 characters."));
    }
    @ExceptionHandler(org.springframework.web.HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ProblemDetail> media(Exception e) {
        return ResponseEntity.status(415).body(problem(415, "JSON_REQUIRED", "Use application/json."));
    }
    @ExceptionHandler(org.springframework.web.HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ProblemDetail> method(Exception e) {
        return ResponseEntity.status(405).body(problem(405, "METHOD_NOT_ALLOWED", "This HTTP method is not supported."));
    }
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ProblemDetail> missing(Exception e) {
        return ResponseEntity.status(404).body(problem(404, "NOT_FOUND", "Page not found."));
    }
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ProblemDetail> unexpected(Exception e) {
        return ResponseEntity.internalServerError().body(problem(500, "INTERNAL_ERROR", "The request could not be completed."));
    }
    public static ProblemDetail problem(int status, String code, String message) {
        var detail = ProblemDetail.forStatusAndDetail(HttpStatusCode.valueOf(status), message);
        detail.setProperty("errorCode", code);
        return detail;
    }
}
