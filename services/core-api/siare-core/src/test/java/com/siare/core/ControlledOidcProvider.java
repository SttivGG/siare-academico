package com.siare.core;

import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.*;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.*;
import com.sun.net.httpserver.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import tools.jackson.databind.ObjectMapper;
import org.springframework.security.oauth2.client.registration.*;
import org.springframework.security.oauth2.core.*;

/** Loopback-only discovery/token/JWKS server. No calls to real Google or GitLab. */
final class ControlledOidcProvider implements AutoCloseable {
    record Grant(String provider,String challenge,String nonce,String subject,String email,String fault) {}
    final ObjectMapper json=new ObjectMapper();
    final HttpServer server;
    final RSAKey key,foreign;
    final String base;
    final Map<String,Grant> grants=new ConcurrentHashMap<>();
    volatile String lastExternalToken;
    ControlledOidcProvider() throws Exception {
        key=new RSAKeyGenerator(2048).keyID("controlled-key").generate(); foreign=new RSAKeyGenerator(2048).keyID("controlled-key").generate();
        server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0); base="http://127.0.0.1:"+server.getAddress().getPort();
        server.createContext("/",this::handle); server.start();
    }
    String issuer(String p) { return base+"/"+p; }
    ClientRegistration registration(String p) {
        return ClientRegistrations.fromIssuerLocation(issuer(p)).registrationId(p).clientId("controlled-"+p).clientSecret("controlled-secret")
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_POST).scope("openid","email","profile")
                .redirectUri("http://127.0.0.1:3100/api/oidc/callback/"+p).build();
    }
    String code(String p,String authorization,String subject,String email,String fault) {
        var params=form(URI.create(authorization).getRawQuery()); String code=UUID.randomUUID().toString();
        grants.put(code,new Grant(p,params.get("code_challenge"),params.get("nonce"),subject,email,fault)); return code;
    }
    static Map<String,String> form(String text) {
        Map<String,String> result=new HashMap<>();
        for(String part:text.split("&")) { var pair=part.split("=",2); result.put(URLDecoder.decode(pair[0],StandardCharsets.UTF_8),pair.length==2?URLDecoder.decode(pair[1],StandardCharsets.UTF_8):""); }
        return result;
    }
    private void handle(HttpExchange x) throws java.io.IOException {
        try {
            String path=x.getRequestURI().getPath(),p=path.contains("/google")?"google":"gitlab";
            if(path.endsWith("openid-configuration")) {
                send(x,200,Map.of("issuer",issuer(p),"authorization_endpoint",issuer(p)+"/authorize","token_endpoint",issuer(p)+"/token",
                        "jwks_uri",issuer(p)+"/jwks","response_types_supported",List.of("code"),"subject_types_supported",List.of("public"),"id_token_signing_alg_values_supported",List.of("RS256"))); return;
            }
            if(path.endsWith("/jwks")) { send(x,200,new JWKSet(key.toPublicJWK()).toJSONObject()); return; }
            if(!path.endsWith("/token")) { send(x,404,Map.of()); return; }
            var input=form(new String(x.getRequestBody().readAllBytes(),StandardCharsets.UTF_8)); var grant=grants.remove(input.get("code"));
            if(grant==null) { send(x,400,Map.of("error","invalid_grant")); return; }
            String challenge=Base64.getUrlEncoder().withoutPadding().encodeToString(MessageDigest.getInstance("SHA-256").digest(input.getOrDefault("code_verifier","").getBytes(StandardCharsets.US_ASCII)));
            if(!challenge.equals(grant.challenge()) || !"controlled-secret".equals(input.get("client_secret")) || !("controlled-"+p).equals(input.get("client_id"))
                    || !("http://127.0.0.1:3100/api/oidc/callback/"+p).equals(input.get("redirect_uri"))) { send(x,400,Map.of("error","invalid_grant")); return; }
            if(grant.fault().equals("communication")) { send(x,503,Map.of("error","temporarily_unavailable")); return; }
            if(grant.fault().equals("client_rejected")) { send(x,400,Map.of("error","invalid_client","error_description","private-provider-description")); return; }
            if(grant.fault().equals("grant_rejected")) { send(x,400,Map.of("error","invalid_grant","error_description","private-provider-description")); return; }
            if(grant.fault().equals("missing_id_token")) { send(x,200,Map.of("access_token","controlled-token-do-not-log","token_type","Bearer","expires_in",300)); return; }
            Instant now=Instant.now();
            var claims=new JWTClaimsSet.Builder().issuer(grant.fault().equals("issuer")?base+"/evil":issuer(p))
                    .subject(grant.subject()).audience(grant.fault().equals("audience")?"other-client":"controlled-"+p)
                    .issueTime(Date.from(grant.fault().equals("future")?now.plusSeconds(120):grant.fault().equals("small_future")?now.plusSeconds(2):now.minusSeconds(grant.fault().equals("expired")?300:10)))
                    .expirationTime(Date.from(now.plusSeconds(grant.fault().equals("expired")?-120:grant.fault().equals("recently_expired")?-2:300)))
                    .claim("nonce",grant.fault().equals("nonce")?"incorrect-nonce":grant.nonce()).claim("name","Usuario controlado")
                    .claim("email_verified",!grant.fault().equals("unverified"));
            if(grant.email()!=null) claims.claim("email",grant.email());
            if(grant.fault().equals("azp")) claims.claim("azp","other-client");
            var token=new SignedJWT(new JWSHeader.Builder(grant.fault().equals("algorithm")?JWSAlgorithm.RS512:JWSAlgorithm.RS256).keyID(key.getKeyID()).build(),claims.build());
            token.sign(new RSASSASigner(grant.fault().equals("signature")?foreign:key)); lastExternalToken=token.serialize();
            send(x,200,Map.of("access_token","external-access-never-siare","token_type","Bearer","expires_in",300,"scope","openid email profile","id_token",lastExternalToken));
        } catch(Exception ex) { send(x,500,Map.of("error","fixture_failure")); }
    }
    private void send(HttpExchange x,int status,Object body) throws java.io.IOException {
        byte[] bytes=json.writeValueAsBytes(body); x.getResponseHeaders().set("Content-Type","application/json");
        x.sendResponseHeaders(status,bytes.length); try(var out=x.getResponseBody()) { out.write(bytes); }
    }
    @Override public void close() { server.stop(0); }
}
