package com.siare.core.domain.identity;

import com.siare.core.domain.account.BusinessException;

/** Fixed diagnostic identifiers. Never carry provider descriptions or credentials. */
public final class OidcFailure extends BusinessException {
    public enum Code {
        OIDC_CONTEXT_INVALID, OIDC_REDIRECT_CHANGED, OIDC_LINK_SESSION_CHANGED,
        OIDC_PROVIDER_DISABLED, OIDC_CONFIGURATION_INVALID, OIDC_DISCOVERY_FAILED,
        OIDC_STORE_UNAVAILABLE, OIDC_TOKEN_CLIENT_REJECTED, OIDC_TOKEN_GRANT_REJECTED,
        OIDC_TOKEN_ENDPOINT_UNAVAILABLE, OIDC_TOKEN_RESPONSE_INVALID,
        OIDC_ID_TOKEN_INVALID, OIDC_ISSUER_INVALID, OIDC_AUDIENCE_INVALID, OIDC_AZP_INVALID,
        OIDC_TOKEN_EXPIRED, OIDC_TOKEN_ISSUED_IN_FUTURE, OIDC_NONCE_INVALID,
        OIDC_EMAIL_LINK_REQUIRED, OIDC_EMAIL_UNVERIFIED, OIDC_REGISTRATION_CLOSED,
        OIDC_IDENTITY_ALREADY_LINKED, OIDC_ACCOUNT_REJECTED, OIDC_INTERNAL_ERROR
    }
    private final Code code;
    public OidcFailure(Kind kind, Code code, String message) {
        super(kind, message); this.code=code;
    }
    public Code code() { return code; }
}
