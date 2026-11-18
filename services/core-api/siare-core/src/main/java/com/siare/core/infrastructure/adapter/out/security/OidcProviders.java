package com.siare.core.infrastructure.adapter.out.security;

import com.siare.core.domain.account.BusinessException;
import com.siare.core.domain.identity.OidcFailure;
import static com.siare.core.domain.identity.OidcFailure.Code.*;
import java.net.URI;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.core.env.Environment;
import org.springframework.security.oauth2.client.registration.*;
import org.springframework.security.oauth2.core.*;
import org.springframework.stereotype.Component;

@Component
public class OidcProviders implements com.siare.core.application.port.out.ExternalProviderPolicy {
    public record Status(String provider, boolean enabled) {}
    private final Environment env;
    private final Map<String,ClientRegistration> registrations=new ConcurrentHashMap<>();
    public OidcProviders(Environment env) { this.env=env; }
    private String setting(String p,String key) { return env.getProperty("siare.oidc."+p+"."+key,"").strip(); }
    public boolean enabled(String p) {
        if(!Set.of("google","gitlab").contains(p)) return false;
        return Boolean.parseBoolean(setting(p,"enabled")) && !setting(p,"client-id").isEmpty() && !setting(p,"client-secret").isEmpty();
    }
    public List<Status> status() { return List.of(new Status("google",enabled("google")),new Status("gitlab",enabled("gitlab"))); }
    public String callback(String p) {
        String origin=env.getProperty("siare.oidc.app-origin","http://127.0.0.1:3100");
        URI uri=URI.create(origin);
        boolean loopback=Set.of("127.0.0.1","localhost","[::1]").contains(Objects.toString(uri.getHost(),""));
        if(uri.getHost()==null || uri.getRawUserInfo()!=null || uri.getRawQuery()!=null || uri.getRawFragment()!=null
                || !(uri.getRawPath().isEmpty() || uri.getRawPath().equals("/"))
                || !(uri.getScheme().equals("https") || uri.getScheme().equals("http") && loopback)) throw new IllegalStateException("Origen OIDC inválido.");
        String expected=origin.replaceAll("/$","")+"/api/oidc/callback/"+p;
        String configured=setting(p,"redirect-uri");
        if(!configured.isEmpty() && !configured.equals(expected)) throw new IllegalStateException("El callback OIDC debe coincidir exactamente con APP_ORIGIN.");
        return expected;
    }
    public ClientRegistration registration(String p) {
        if(!enabled(p)) throw new OidcFailure(BusinessException.Kind.NOT_FOUND,OIDC_PROVIDER_DISABLED,"El proveedor no está configurado.");
        // Check local configuration before discovery to distinguish configuration from network failures.
        try {
            callback(p);
            String expected=p.equals("google")?"https://accounts.google.com":"https://gitlab.com";
            if(!setting(p,"issuer").isEmpty() && !expected.equals(setting(p,"issuer"))) throw new IllegalStateException("Issuer inválido.");
        } catch(IllegalArgumentException | IllegalStateException ex) {
            throw new OidcFailure(BusinessException.Kind.VALIDATION,OIDC_CONFIGURATION_INVALID,"Revisa el origen, issuer y callback del proveedor.");
        }
        try { return registrations.computeIfAbsent(p,key -> discover(key)); }
        catch(IllegalArgumentException | IllegalStateException ex) {
            throw new OidcFailure(BusinessException.Kind.UNAUTHORIZED,OIDC_DISCOVERY_FAILED,"No se pudo obtener la configuración del proveedor.");
        }
    }
    protected ClientRegistration discover(String p) {
        String issuer=p.equals("google")?"https://accounts.google.com":"https://gitlab.com";
        String configured=setting(p,"issuer");
        if(!configured.isEmpty() && !issuer.equals(configured)) throw new IllegalStateException("Issuer fuera de la lista permitida.");
        // Discovery is lazy: no provider/network dependency during local login or application boot.
        return ClientRegistrations.fromIssuerLocation(issuer).registrationId(p)
                .clientId(setting(p,"client-id")).clientSecret(setting(p,"client-secret"))
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_POST)
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .scope("openid","email","profile").redirectUri(callback(p)).build();
    }
}
