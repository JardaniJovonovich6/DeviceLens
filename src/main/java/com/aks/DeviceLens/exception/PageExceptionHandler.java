package com.aks.DeviceLens.exception;

import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class PageExceptionHandler {
    @ExceptionHandler(NoResourceFoundException.class)
    public ProblemDetail missing(NoResourceFoundException exception) {
        return ProblemDetail.forStatusAndDetail(org.springframework.http.HttpStatus.NOT_FOUND, "Page not found.");
    }
    @ExceptionHandler(Exception.class)
    public ProblemDetail unexpected(Exception exception) {
        return ProblemDetail.forStatusAndDetail(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR,
                "The page could not be loaded.");
    }
}
