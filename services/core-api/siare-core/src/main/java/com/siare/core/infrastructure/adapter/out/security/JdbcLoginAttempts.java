package com.siare.core.infrastructure.adapter.out.security;

import com.siare.core.application.port.out.*;
import com.siare.core.application.service.SessionService;
import com.siare.core.domain.account.BusinessException;
import java.sql.Timestamp;
import java.time.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.dao.DuplicateKeyException;

public final class JdbcLoginAttempts implements LoginAttemptPort {
    private final JdbcTemplate db;
    private final TransactionPort tx;
    private final Clock clock;
    private final int perAccount,global;
    public JdbcLoginAttempts(JdbcTemplate db,TransactionPort tx,Clock clock,int perAccount,int global) {
        if(perAccount<1 || perAccount>20 || global<1 || global>10000) throw new IllegalArgumentException("Límites de autenticación inválidos.");
        this.db=db; this.tx=tx; this.clock=clock; this.perAccount=perAccount; this.global=global;
    }
    @Override public void acquire(String email) {
        String aggregate=SessionService.fingerprint("global-auth");
        String account=SessionService.fingerprint("account:"+email);
        initialize(aggregate); initialize(account);
        boolean allowed=tx.required(() -> reserve(aggregate,global,Duration.ofMinutes(1)) && reserve(account,perAccount,Duration.ofMinutes(15)));
        if(!allowed) throw new BusinessException(BusinessException.Kind.RATE_LIMITED,"Demasiados intentos. Espera antes de volver a iniciar sesión.");
    }
    private void initialize(String key) {
        try { db.update("INSERT INTO login_attempts(attempt_key,window_start,attempts) VALUES (?,?,0)",key,Timestamp.from(clock.instant())); }
        catch(DuplicateKeyException ignored) { /* Another node already owns the same durable counter. */ }
    }
    private boolean reserve(String key,int maximum,Duration window) {
        return db.query("SELECT window_start,attempts FROM login_attempts WHERE attempt_key=? FOR UPDATE",rs -> {
            rs.next(); var start=rs.getTimestamp(1).toInstant(); int count=rs.getInt(2);
            if(!clock.instant().isBefore(start.plus(window))) { start=clock.instant(); count=0; }
            if(count>=maximum) return false;
            db.update("UPDATE login_attempts SET window_start=?,attempts=? WHERE attempt_key=?",Timestamp.from(start),count+1,key);
            return true;
        },key);
    }
}
