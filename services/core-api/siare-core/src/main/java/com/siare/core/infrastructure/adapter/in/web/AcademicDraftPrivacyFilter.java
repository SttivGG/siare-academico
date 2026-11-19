package com.siare.core.infrastructure.adapter.in.web;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Private draft responses, including validation/authorization failures, cannot be cached. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class AcademicDraftPrivacyFilter extends OncePerRequestFilter {
    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (request.getRequestURI().startsWith("/api/v1/activity-drafts")) response.setHeader("Cache-Control", "no-store");
        chain.doFilter(request, response);
    }
}
