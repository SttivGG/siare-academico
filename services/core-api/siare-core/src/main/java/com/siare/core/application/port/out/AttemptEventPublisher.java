package com.siare.core.application.port.out;
import com.siare.core.domain.activity.AttemptEvent;
/** Return normally only after durable acknowledgement. Receiver must deduplicate by eventId. */
public interface AttemptEventPublisher { void publish(AttemptEvent event); }
