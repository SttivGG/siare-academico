package com.siare.core.infrastructure.adapter.in.web;

import org.springframework.core.MethodParameter;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.server.*;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;

@ControllerAdvice
public class PrivateResponseAdvice implements ResponseBodyAdvice<Object> {
    @Override public boolean supports(MethodParameter p,Class<? extends HttpMessageConverter<?>> c) { return true; }
    @Override public Object beforeBodyWrite(Object body,MethodParameter p,MediaType type,Class<? extends HttpMessageConverter<?>> c,
            ServerHttpRequest request,ServerHttpResponse response) {
        response.getHeaders().setCacheControl("no-store"); return body;
    }
}
