package com.siare.core.infrastructure.adapter.out.security;

import com.siare.core.application.port.out.TotpPort;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.*;
import java.time.Instant;
import java.util.*;
import javax.crypto.*;
import javax.crypto.spec.*;

/** RFC 6238: SHA-1, six digits, 30 seconds, +/- one step. Seed envelopes use AES-256-GCM. */
public final class AesTotpAdapter implements TotpPort {
    private static final String ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    private final SecureRandom random = new SecureRandom();
    private final byte[] key;
    public AesTotpAdapter(String keyFile) {
        try {
            key = Base64.getDecoder().decode(Files.readString(Path.of(keyFile)).trim());
            if (key.length != 32) throw new IllegalArgumentException();
        } catch (Exception ex) { throw new IllegalStateException("La clave MFA externa debe contener 32 bytes en Base64; restaura la clave existente, nunca la reemplaces automáticamente."); }
    }
    @Override public String generateSecret() {
        byte[] bytes = new byte[20]; random.nextBytes(bytes);
        StringBuilder encoded = new StringBuilder(); int buffer=0, bits=0;
        for (byte b:bytes) {
            buffer=(buffer<<8)|(b&255); bits+=8;
            while(bits>=5) { bits-=5; encoded.append(ALPHABET.charAt((buffer>>>bits)&31)); }
        }
        return encoded.toString();
    }
    private byte[] decode(String secret) {
        byte[] result=new byte[secret.length()*5/8]; int buffer=0,bits=0,index=0;
        for(char c:secret.toCharArray()) {
            int value=ALPHABET.indexOf(c); if(value<0) throw new IllegalArgumentException("Semilla inválida.");
            buffer=(buffer<<5)|value; bits+=5;
            if(bits>=8) { bits-=8; result[index++]=(byte)(buffer>>>bits); }
        }
        return result;
    }
    @Override public String encrypt(UUID owner,String secret) {
        try {
            byte[] nonce=new byte[12]; random.nextBytes(nonce);
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE,new SecretKeySpec(key,"AES"),new GCMParameterSpec(128,nonce));
            cipher.updateAAD(("siare:totp:v1:"+owner).getBytes(StandardCharsets.US_ASCII));
            byte[] encrypted=cipher.doFinal(secret.getBytes(StandardCharsets.US_ASCII));
            return "v1."+Base64.getUrlEncoder().withoutPadding().encodeToString(ByteBuffer.allocate(nonce.length+encrypted.length).put(nonce).put(encrypted).array());
        } catch(GeneralSecurityException ex) { throw new IllegalStateException("No se pudo proteger el factor."); }
    }
    @Override public String decrypt(UUID owner,String encrypted) {
        try {
            if(!encrypted.startsWith("v1.")) throw new GeneralSecurityException();
            byte[] bytes=Base64.getUrlDecoder().decode(encrypted.substring(3));
            if(bytes.length<29) throw new GeneralSecurityException();
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE,new SecretKeySpec(key,"AES"),new GCMParameterSpec(128,Arrays.copyOf(bytes,12)));
            cipher.updateAAD(("siare:totp:v1:"+owner).getBytes(StandardCharsets.US_ASCII));
            return new String(cipher.doFinal(Arrays.copyOfRange(bytes,12,bytes.length)),StandardCharsets.US_ASCII);
        } catch(Exception ex) { throw new IllegalStateException("No se pudo abrir el factor. Verifica la clave externa y su respaldo."); }
    }
    public String code(String secret,long step,int digits) {
        try {
            Mac mac=Mac.getInstance("HmacSHA1"); mac.init(new SecretKeySpec(decode(secret),"HmacSHA1"));
            byte[] h=mac.doFinal(ByteBuffer.allocate(8).putLong(step).array()); int offset=h[h.length-1]&15;
            int binary=((h[offset]&127)<<24)|((h[offset+1]&255)<<16)|((h[offset+2]&255)<<8)|(h[offset+3]&255);
            int modulo=digits==8?100000000:1000000;
            return String.format(Locale.ROOT,"%0"+digits+"d",binary%modulo);
        } catch(GeneralSecurityException ex) { throw new IllegalStateException("TOTP no disponible."); }
    }
    @Override public long verify(String secret,String code,Instant now,long lastUsedStep) {
        if(code==null || !code.matches("[0-9]{6}")) return -1;
        long current=now.getEpochSecond()/30, matched=-1;
        // Prefer the latest match in the extremely rare event of equal truncated codes.
        for(long step=current-1;step<=current+1;step++) {
            if(step>=0 && MessageDigest.isEqual(code(secret,step,6).getBytes(StandardCharsets.US_ASCII),code.getBytes(StandardCharsets.US_ASCII))) matched=step;
        }
        return matched>lastUsedStep?matched:-1;
    }
    @Override public String uri(String email,String secret) {
        return "otpauth://totp/"+java.net.URLEncoder.encode("SIARE:"+email,StandardCharsets.UTF_8).replace("+","%20")
                +"?secret="+secret+"&issuer=SIARE&algorithm=SHA1&digits=6&period=30";
    }
}
