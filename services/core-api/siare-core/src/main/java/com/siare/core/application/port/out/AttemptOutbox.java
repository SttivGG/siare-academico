package com.siare.core.application.port.out;
import com.siare.core.domain.activity.AttemptEvent;
import java.time.Instant;
import java.util.*;
public interface AttemptOutbox {
    record Delivery(AttemptEvent event,UUID leaseToken,int deliveryAttempts) { }
    List<Delivery> claim(Instant now,int limit);
    void delivered(Delivery delivery,Instant now);
    void retry(Delivery delivery,Instant availableAt);
}
