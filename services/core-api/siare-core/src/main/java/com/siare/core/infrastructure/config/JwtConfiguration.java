package com.siare.core.infrastructure.config;

import com.siare.core.application.port.out.TokenPort;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.interfaces.*;
import java.security.spec.*;
import java.time.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.core.io.Resource;
import org.springframework.security.oauth2.core.*;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.*;

@Configuration(proxyBeanMethods = false)
public class JwtConfiguration {
    @Bean @Profile("!test")
    KeyPair jwtKeyPair(@Value("${siare.jwt.public-key}") Resource publicKey,
                       @Value("${siare.jwt.private-key}") Resource privateKey) throws Exception {
        var factory = KeyFactory.getInstance("RSA");
        var pub = (RSAPublicKey) factory.generatePublic(new X509EncodedKeySpec(readPem(publicKey)));
        var priv = (RSAPrivateKey) factory.generatePrivate(new PKCS8EncodedKeySpec(readPem(privateKey)));
        if (pub.getModulus().bitLength() < 2048 || !pub.getModulus().equals(priv.getModulus())) {
            throw new IllegalStateException("Se necesita un par de claves RSA coincidente de al menos 2048 bits.");
        }
        return new KeyPair(pub, priv);
    }

    private byte[] readPem(Resource resource) throws Exception {
        try (var stream = resource.getInputStream()) {
            var pem = new String(stream.readAllBytes(), StandardCharsets.US_ASCII)
                    .replaceAll("-----[^-]+-----", "").replaceAll("\\s", "");
            return Base64.getDecoder().decode(pem);
        }
    }

    @Bean JwtEncoder jwtEncoder(KeyPair pair) {
        return NimbusJwtEncoder.withKeyPair((RSAPublicKey) pair.getPublic(), (RSAPrivateKey) pair.getPrivate())
                .algorithm(SignatureAlgorithm.RS256).build();
    }

    @Bean JwtDecoder jwtDecoder(KeyPair pair, @Value("${siare.jwt.issuer}") String issuer) {
        var decoder = NimbusJwtDecoder.withPublicKey((RSAPublicKey) pair.getPublic())
                .signatureAlgorithm(SignatureAlgorithm.RS256).build();
        OAuth2TokenValidator<Jwt> requiredClaims = jwt -> {
            try {
                UUID.fromString(jwt.getSubject());
                if (jwt.getExpiresAt() == null || jwt.getIssuedAt() == null) throw new IllegalArgumentException();
                return OAuth2TokenValidatorResult.success();
            } catch (IllegalArgumentException | NullPointerException ex) {
                return OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Token no válido.", null));
            }
        };
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefaultWithIssuer(issuer), new JwtTimestampValidator(Duration.ZERO), requiredClaims));
        return decoder;
    }

    @Bean TokenPort tokenPort(JwtEncoder encoder, Clock clock, @Value("${siare.jwt.issuer}") String issuer,
                              @Value("${siare.jwt.ttl}") Duration ttl) {
        if (ttl.isNegative() || ttl.isZero() || issuer.isBlank()) throw new IllegalArgumentException("Configuración JWT inválida.");
        return userId -> {
            var now = clock.instant();
            var expires = now.plus(ttl);
            var claims = JwtClaimsSet.builder().issuer(issuer).subject(userId.toString()).issuedAt(now)
                    .expiresAt(expires).id(UUID.randomUUID().toString()).build();
            var token = encoder.encode(JwtEncoderParameters.from(
                    JwsHeader.with(SignatureAlgorithm.RS256).type("JWT").build(), claims));
            return new TokenPort.AccessToken(token.getTokenValue(), "Bearer", expires);
        };
    }
}
