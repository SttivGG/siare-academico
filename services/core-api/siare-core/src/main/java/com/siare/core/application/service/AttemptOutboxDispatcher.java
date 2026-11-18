package com.siare.core.application.service;
import com.siare.core.application.port.out.*;
import java.time.Clock;
/** Runs outside the student's transaction; a crash after publish safely repeats the same event. */
public final class AttemptOutboxDispatcher {
    private final AttemptOutbox outbox;
    private final AttemptEventPublisher publisher;
    private final Clock clock;
    public AttemptOutboxDispatcher(AttemptOutbox outbox,AttemptEventPublisher publisher,Clock clock) { this.outbox=outbox; this.publisher=publisher; this.clock=clock; }
    public int dispatch(int limit) {
        if(limit<1 || limit>100) throw new IllegalArgumentException("Batch size must be 1..100");
        int delivered=0;
        for(var delivery:outbox.claim(clock.instant(),limit)) {
            try { publisher.publish(delivery.event()); outbox.delivered(delivery,clock.instant()); delivered++; }
            catch(RuntimeException error) {
                long delay=Math.min(3600,5L << Math.min(10,delivery.deliveryAttempts()));
                outbox.retry(delivery,clock.instant().plusSeconds(delay));
            }
        }
        return delivered;
    }
}
