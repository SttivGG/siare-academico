package com.siare.core.infrastructure.adapter.out.security;

import com.siare.core.application.port.out.SecurityMailPort;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;

public final class SmtpSecurityMail implements SecurityMailPort {
    private final JavaMailSenderImpl sender;
    private final String from,origin;
    public SmtpSecurityMail(String host,int port,String username,String password,String from,String origin) {
        this.from=from; this.origin=origin;
        if(!origin.matches("https?://[^/?#]+")) throw new IllegalArgumentException("Configura el origen público de SIARE sin rutas.");
        sender=new JavaMailSenderImpl(); sender.setHost(host); sender.setPort(port); sender.setUsername(username); sender.setPassword(password);
        var properties=sender.getJavaMailProperties();
        properties.setProperty("mail.smtp.auth",Boolean.toString(!username.isBlank()));
        properties.setProperty("mail.smtp.starttls.enable","true"); properties.setProperty("mail.smtp.starttls.required","true");
        properties.setProperty("mail.smtp.ssl.checkserveridentity","true");
        properties.setProperty("mail.smtp.connectiontimeout","5000"); properties.setProperty("mail.smtp.timeout","5000"); properties.setProperty("mail.smtp.writetimeout","5000");
        properties.setProperty("mail.debug","false");
    }
    private void send(String recipient,String subject,String body) {
        if(sender.getHost()==null || sender.getHost().isBlank() || from.isBlank()) throw new IllegalStateException("SMTP no configurado.");
        var message=new SimpleMailMessage(); message.setFrom(from); message.setTo(recipient); message.setSubject(subject); message.setText(body);
        sender.send(message);
    }
    @Override public void passwordReset(String recipient,String token) {
        // Fragment is excluded from HTTP URLs, proxy logs and Referer. The browser clears it on load.
        send(recipient,"Restablece tu contraseña SIARE","Abre este enlace en los próximos 15 minutos:\n"+origin+"/recuperar/confirmar#token="+token+"\nSi no lo solicitaste, ignora este mensaje. MFA permanecerá activo.");
    }
    @Override public void passwordChanged(String recipient) {
        send(recipient,"Tu contraseña SIARE cambió","Tu contraseña se ha restablecido y las sesiones anteriores se cerraron. MFA permanece activo. Si no autorizaste este cambio, contacta al responsable institucional.");
    }
}
