package com.siare.core.infrastructure.config;
import com.siare.core.application.port.out.*;
import com.siare.core.application.service.AttemptOutboxDispatcher;
import java.time.Clock;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
/** With no transport installed, rows stay durable and pending for the future Express integration. */
@Component
public class AttemptDeliveryMaintenance {
    private final AttemptOutbox outbox;
    private final ObjectProvider<AttemptEventPublisher> publisher;
    private final Clock clock;
    public AttemptDeliveryMaintenance(AttemptOutbox outbox,ObjectProvider<AttemptEventPublisher> publisher,Clock clock) { this.outbox=outbox; this.publisher=publisher; this.clock=clock; }
    @Scheduled(fixedDelayString="${siare.activities.delivery-delay-ms:10000}")
    public void deliver() {
        var transport=publisher.getIfAvailable();
        if(transport!=null) new AttemptOutboxDispatcher(outbox,transport,clock).dispatch(10);
    }
}
