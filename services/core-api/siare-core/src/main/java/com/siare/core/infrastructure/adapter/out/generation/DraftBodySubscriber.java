package com.siare.core.infrastructure.adapter.out.generation;

import com.siare.core.domain.draft.DraftGenerationException;
import java.io.ByteArrayOutputStream;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.Flow;

/** Enforces observed bytes even for chunked bodies and false Content-Length headers. */
final class DraftBodySubscriber implements HttpResponse.BodySubscriber<byte[]> {
    private final CompletableFuture<byte[]> result = new CompletableFuture<>();
    private final ByteArrayOutputStream output = new ByteArrayOutputStream();
    private Flow.Subscription subscription;
    @Override public CompletionStage<byte[]> getBody() { return result; }
    @Override public void onSubscribe(Flow.Subscription subscription) { this.subscription = subscription; subscription.request(1); }
    @Override public void onNext(List<ByteBuffer> buffers) {
        for (var buffer : buffers) {
            if ((long) output.size() + buffer.remaining() > DraftJsonContract.RESPONSE_BYTES) {
                subscription.cancel(); result.completeExceptionally(DraftGenerationException.invalidContract()); return;
            }
            byte[] bytes = new byte[buffer.remaining()]; buffer.get(bytes); output.writeBytes(bytes);
        }
        subscription.request(1);
    }
    @Override public void onError(Throwable error) { result.completeExceptionally(error); }
    @Override public void onComplete() { result.complete(output.toByteArray()); }
}
