package com.siare.core.application.port.in;
import com.siare.core.domain.activity.*;
import java.util.*;
public interface ActivityUseCase {
    SavedActivity create(UUID owner,UUID subject,ActivityFamily family,UUID document,String topic,ActivityBank bank,int count,int gridSize);
    List<SavedActivity> list(UUID owner,UUID subject,UUID after,int limit);
    SavedActivity get(UUID owner,UUID activity);
    AttemptResult submit(UUID owner,UUID activity,UUID idempotencyKey,Map<String,String> answers,long durationMs);
    AttemptResult result(UUID owner,UUID activity,UUID attempt);
}
