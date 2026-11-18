package com.siare.core.infrastructure.adapter.out.security;

import com.siare.core.domain.identity.FederatedPrincipal;
import com.siare.core.domain.identity.OidcFailure;
import static com.siare.core.domain.identity.OidcFailure.Code.*;
import static com.siare.core.domain.account.BusinessException.Kind.UNAUTHORIZED;
import com.siare.core.infrastructure.adapter.out.security.OidcFlowStore.Flow;
import java.time.*;
import java.util.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.security.oauth2.client.authentication.OAuth2LoginAuthenticationToken;
import org.springframework.security.oauth2.client.endpoint.*;
import org.springframework.security.oauth2.client.oidc.authentication.*;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.core.endpoint.*;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class OidcProtocol {
    // OIDC allows a small clock difference for iat. Expiration remains strict below.
    private static final Duration ISSUED_AT_SKEW=Duration.ofSeconds(60);
    private final OidcAuthorizationCodeAuthenticationProvider provider;
    public OidcProtocol(Clock clock) {
        var tokenClient=new RestClientAuthorizationCodeTokenResponseClient();
        var requests=new SimpleClientHttpRequestFactory(); requests.setConnectTimeout(5000); requests.setReadTimeout(8000);
        tokenClient.setRestClient(RestClient.builder().requestFactory(requests)
                .messageConverters(converters -> { converters.clear(); converters.add(new org.springframework.http.converter.FormHttpMessageConverter());
                    converters.add(new org.springframework.security.oauth2.core.http.converter.OAuth2AccessTokenResponseHttpMessageConverter()); })
                .defaultStatusHandler(new org.springframework.security.oauth2.client.http.OAuth2ErrorResponseErrorHandler()).build());
        var users=new OidcUserService(); users.setRetrieveUserInfo(request -> false);
        provider=new OidcAuthorizationCodeAuthenticationProvider(request -> {
            try { return tokenClient.getTokenResponse(request); }
            catch (org.springframework.security.oauth2.core.OAuth2AuthorizationException ex) {
                var code=switch(ex.getError().getErrorCode()) {
                    case "invalid_client", "unauthorized_client" -> OIDC_TOKEN_CLIENT_REJECTED;
                    case "invalid_grant" -> OIDC_TOKEN_GRANT_REJECTED;
                    case "temporarily_unavailable", "server_error" -> OIDC_TOKEN_ENDPOINT_UNAVAILABLE;
                    default -> OIDC_TOKEN_RESPONSE_INVALID;
                };
                for(Throwable cause=ex;cause!=null;cause=cause.getCause()) {
                    if(cause instanceof org.springframework.web.client.ResourceAccessException
                            || cause instanceof org.springframework.web.client.RestClientResponseException response && response.getStatusCode().is5xxServerError()) {
                        code=OIDC_TOKEN_ENDPOINT_UNAVAILABLE; break;
                    }
                }
                throw new OidcFailure(UNAUTHORIZED,code,"No se pudo completar el intercambio con el proveedor. Inicia el flujo de nuevo.");
            }
        },users);
        var decoders=new OidcIdTokenDecoderFactory();
        decoders.setJwsAlgorithmResolver(registration -> SignatureAlgorithm.RS256);
        decoders.setJwtValidatorFactory(registration -> {
            var oidc=new OidcIdTokenValidator(registration); oidc.setClock(clock); oidc.setClockSkew(ISSUED_AT_SKEW);
            var timestamps=new org.springframework.security.oauth2.jwt.JwtTimestampValidator(Duration.ZERO); timestamps.setClock(clock);
            var validator=new org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator<>(oidc,timestamps);
            return jwt -> {
                var result=validator.validate(jwt);
                if(result.hasErrors()) {
                    var code=OIDC_ID_TOKEN_INVALID;
                    if(jwt.getIssuer()!=null && !registration.getProviderDetails().getIssuerUri().equals(jwt.getIssuer().toExternalForm())) code=OIDC_ISSUER_INVALID;
                    else if(jwt.getAudience()==null || !jwt.getAudience().contains(registration.getClientId())) code=OIDC_AUDIENCE_INVALID;
                    else if(jwt.getClaimAsString("azp")!=null && !registration.getClientId().equals(jwt.getClaimAsString("azp"))
                            || jwt.getAudience().size()>1 && jwt.getClaimAsString("azp")==null) code=OIDC_AZP_INVALID;
                    else if(jwt.getExpiresAt()!=null && clock.instant().isAfter(jwt.getExpiresAt())) code=OIDC_TOKEN_EXPIRED;
                    else if(jwt.getIssuedAt()!=null && clock.instant().plus(ISSUED_AT_SKEW).isBefore(jwt.getIssuedAt())) code=OIDC_TOKEN_ISSUED_IN_FUTURE;
                    throw new OidcFailure(UNAUTHORIZED,code,"El ID token no superó la validación OIDC.");
                }
                return result;
            };
        });
        provider.setJwtDecoderFactory(decoders);
    }
    public static OAuth2AuthorizationRequest request(ClientRegistration r,Flow f) {
        var additional=new HashMap<String,Object>();
        additional.put("nonce",hash(f.nonce())); additional.put("code_challenge",hash(f.verifier())); additional.put("code_challenge_method","S256");
        // Keep Google's account selector. GitLab does not advertise select_account support.
        if(f.provider().equals("google")) additional.put("prompt","select_account");
        return OAuth2AuthorizationRequest.authorizationCode().authorizationUri(r.getProviderDetails().getAuthorizationUri())
                .clientId(r.getClientId()).redirectUri(f.redirectUri()).scopes(r.getScopes()).state(f.state())
                .attributes(Map.of("nonce",f.nonce(),"code_verifier",f.verifier()))
                .additionalParameters(additional).build();
    }
    private static String hash(String value) {
        try { return Base64.getUrlEncoder().withoutPadding().encodeToString(java.security.MessageDigest.getInstance("SHA-256").digest(value.getBytes(java.nio.charset.StandardCharsets.US_ASCII))); }
        catch(java.security.NoSuchAlgorithmException ex) { throw new IllegalStateException(ex); }
    }
    public FederatedPrincipal authenticate(ClientRegistration r,Flow f,String code,String state) {
        var response=OAuth2AuthorizationResponse.success(code).state(state).redirectUri(f.redirectUri()).build();
        var exchange=new OAuth2AuthorizationExchange(request(r,f),response);
        var result=(OAuth2LoginAuthenticationToken)provider.authenticate(new OAuth2LoginAuthenticationToken(r,exchange));
        var user=(OidcUser)result.getPrincipal();
        return new FederatedPrincipal(f.provider(),user.getIssuer().toString(),user.getSubject(),user.getFullName(),user.getEmail(),
                Boolean.TRUE.equals(user.getEmailVerified()));
    }
}
