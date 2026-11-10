package com.siare.core.infrastructure.adapter.in.web;

import com.siare.core.domain.account.BusinessException;
import java.time.Instant;
import java.util.LinkedHashMap;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(com.siare.core.domain.document.DocumentException.class)
    ResponseEntity<ApiError> document(com.siare.core.domain.document.DocumentException ex) {
        return ResponseEntity.status(ex.status()).body(ApiError.of(ex.status(), ex.code(), ex.getMessage()));
    }

    @ExceptionHandler(org.springframework.web.multipart.MaxUploadSizeExceededException.class)
    ResponseEntity<ApiError> oversized(Exception ex) {
        return ResponseEntity.status(413).body(ApiError.of(413, "FILE_TOO_LARGE", "El archivo o la solicitud supera el límite permitido."));
    }

    @ExceptionHandler({org.springframework.web.multipart.support.MissingServletRequestPartException.class,
            org.springframework.web.multipart.MultipartException.class})
    ResponseEntity<ApiError> multipart(Exception ex) {
        return ResponseEntity.badRequest().body(ApiError.of(400, "INVALID_FILE", "Envía un archivo en el campo multipart file."));
    }

    @ExceptionHandler(org.springframework.web.HttpMediaTypeNotSupportedException.class)
    ResponseEntity<ApiError> media(Exception ex) {
        return ResponseEntity.status(415).body(ApiError.of(415, "UNSUPPORTED_MEDIA_TYPE", "El tipo de contenido de la solicitud no es válido."));
    }
    @ExceptionHandler(BusinessException.class)
    ResponseEntity<ApiError> business(BusinessException ex) {
        int status = switch (ex.kind()) {
            case VALIDATION -> 400;
            case DUPLICATE_EMAIL -> 409;
            case UNAUTHORIZED -> 401;
            case FORBIDDEN -> 403;
            case NOT_FOUND -> 404;
        };
        return ResponseEntity.status(status).body(ApiError.of(status, ex.kind().name(), ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> validation(MethodArgumentNotValidException ex) {
        var fields = new LinkedHashMap<String, String>();
        ex.getBindingResult().getFieldErrors().forEach(error -> fields.putIfAbsent(error.getField(), error.getDefaultMessage()));
        return ResponseEntity.badRequest().body(new ApiError(Instant.now(), 400, "VALIDATION", "Revisa los campos indicados.", fields));
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    ResponseEntity<ApiError> malformed(Exception ex) {
        return ResponseEntity.badRequest().body(ApiError.of(400, "VALIDATION", "La solicitud no tiene un formato válido."));
    }

    @ExceptionHandler(NoResourceFoundException.class)
    ResponseEntity<ApiError> missing(Exception ex) {
        return ResponseEntity.status(404).body(ApiError.of(404, "NOT_FOUND", "Recurso no encontrado."));
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    ResponseEntity<ApiError> method(Exception ex) {
        return ResponseEntity.status(405).body(ApiError.of(405, "METHOD_NOT_ALLOWED", "Método no permitido."));
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiError> unexpected(Exception ex) {
        // Do not include SQL, request payloads, credentials or token contents in errors or logs.
        return ResponseEntity.internalServerError().body(ApiError.of(500, "INTERNAL_ERROR", "No se pudo completar la solicitud."));
    }
}
