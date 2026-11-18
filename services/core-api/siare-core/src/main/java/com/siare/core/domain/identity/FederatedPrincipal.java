package com.siare.core.domain.identity;

/** Claims accepted exclusively from the infrastructure's validated OIDC authentication. */
public record FederatedPrincipal(String provider, String issuer, String subject, String name, String email, boolean emailVerified) {}
