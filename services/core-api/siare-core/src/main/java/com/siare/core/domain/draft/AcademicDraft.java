package com.siare.core.domain.draft;

import com.siare.core.domain.activity.ActivityFamily;
import java.util.List;
import java.util.UUID;

/** H5-A v1 wire DTOs. A draft is never an H3 validated ActivityBank. */
public final class AcademicDraft {
    private AcademicDraft() {}

    public record Selection(UUID documentId, String extractionVersion, ActivityFamily type, String topic,
                            int count, int gridSize, List<Integer> fragmentIndexes) {
        public Selection { fragmentIndexes = fragmentIndexes == null ? null : List.copyOf(fragmentIndexes); }
        @Override public String toString() { return "Selection[documentId=" + documentId + "]"; }
    }
    public record Fragment(int index, String reference, String unitType, int unitNumber, String text) {
        @Override public String toString() { return "Fragment[index=" + index + "]"; }
    }
    public record Request(int schemaVersion, UUID requestId, UUID documentId, String extractionVersion,
                          ActivityFamily type, String topic, int count, int gridSize, String language,
                          List<String> extractionWarnings, List<Fragment> fragments) {
        public Request { extractionWarnings = List.copyOf(extractionWarnings); fragments = List.copyOf(fragments); }
        @Override public String toString() { return "DraftRequest[requestId=" + requestId + "]"; }
    }
    public record Source(String reference, int fragmentIndex, String unitType, int unitNumber, String quote) {
        @Override public String toString() { return "Source[fragmentIndex=" + fragmentIndex + "]"; }
    }
    public record Option(String id, String text) {
        @Override public String toString() { return "Option[id=" + id + "]"; }
    }
    public record Question(String id, String prompt, List<Option> options, String correctOptionId,
                           String topic, Source source, String explanation) {
        public Question { options = List.copyOf(options); }
        @Override public String toString() { return "Question[id=" + id + "]"; }
    }
    public record Word(String id, String answer, String clue, String topic, Source source, String explanation) {
        @Override public String toString() { return "Word[id=" + id + "]"; }
    }
    public record Bank(boolean validated, List<Question> questions, List<Word> words) {
        public Bank { questions = List.copyOf(questions); words = List.copyOf(words); }
        @Override public String toString() { return "ActivityBankDraft[validated=" + validated + "]"; }
    }
    public record Checks(boolean evidenceSupported, boolean answerSupported, boolean explanationSupported,
                         boolean unambiguous, boolean topicAligned, boolean noDuplicates) {}
    public record Quality(boolean requiresHumanReview, Checks checks) {}
    public record Response(int schemaVersion, UUID requestId, UUID documentId, String extractionVersion,
                           ActivityFamily type, String topic, int count, String status, String generatorVersion,
                           Bank draft, List<String> warnings, Quality quality) {
        public Response { warnings = List.copyOf(warnings); }
        @Override public String toString() { return "DraftResponse[requestId=" + requestId + "]"; }
    }
}
