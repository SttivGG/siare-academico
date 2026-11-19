package com.siare.core.application.service;

import com.siare.core.domain.activity.ActivityRules;
import com.siare.core.domain.draft.AcademicDraft.*;
import com.siare.core.domain.draft.DraftGenerationException;
import java.util.*;

/** Cross-field H5-A rules, independent of transport and of the H3 bank constructor. */
public final class DraftEvidence {
    private DraftEvidence() {}
    public static String reference(String unitType, int unitNumber) {
        String label = switch (unitType) {
            case "page" -> "Página"; case "slide" -> "Diapositiva";
            case "section" -> "Sección"; case "image" -> "Imagen";
            default -> throw DraftGenerationException.invalidContract();
        };
        return label + " " + unitNumber;
    }
    public static void request(Request request) {
        require(request.schemaVersion() == 1 && request.requestId() != null && request.documentId() != null);
        require(request.extractionVersion() != null && request.extractionVersion().matches("operation:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"));
        require(request.type() != null && request.topic() != null && !request.topic().isBlank()
                && request.topic().length() <= 100 && request.topic().equals(request.topic().strip()));
        require(request.count() >= (request.type().name().equals("QUIZ") ? 1 : 2)
                && request.count() <= (request.type().name().equals("QUIZ") ? 50 : 12));
        require(request.gridSize() >= 5 && request.gridSize() <= 25 && "es".equals(request.language()));
        warnings(request.extractionWarnings());
        require(!request.fragments().isEmpty() && request.fragments().size() <= 32);
        int previous = -1, total = 0;
        for (var fragment : request.fragments()) {
            require(fragment.index() > previous && fragment.index() <= 1999 && fragment.unitNumber() >= 1 && fragment.unitNumber() <= 2000);
            require(reference(fragment.unitType(), fragment.unitNumber()).equals(fragment.reference()));
            require(fragment.text() != null && !fragment.text().isBlank());
            total += fragment.text().length(); require(total <= 100_000); previous = fragment.index();
        }
    }
    public static void response(Request request, Response response) {
        request(request);
        require(response != null && response.schemaVersion() == 1 && request.requestId().equals(response.requestId())
                && request.documentId().equals(response.documentId()) && request.extractionVersion().equals(response.extractionVersion())
                && request.type() == response.type() && request.topic().equals(response.topic()) && request.count() == response.count()
                && "DRAFT".equals(response.status()) && response.generatorVersion() != null && !response.generatorVersion().isBlank()
                && response.generatorVersion().length() <= 128);
        warnings(response.warnings()); require(response.warnings().containsAll(request.extractionWarnings()));
        require(response.draft() != null && !response.draft().validated() && response.quality() != null && response.quality().requiresHumanReview());
        var checks = response.quality().checks();
        require(checks != null && checks.evidenceSupported() && checks.answerSupported() && checks.explanationSupported()
                && checks.unambiguous() && checks.topicAligned() && checks.noDuplicates());
        bank(request, response.draft());
    }
    /** Revalidate edited content without assigning producer quality claims to it. */
    public static void bank(Request request, Bank bank) {
        request(request);
        require(bank != null && !bank.validated());
        var fragments = new HashMap<Integer, Fragment>(); request.fragments().forEach(f -> fragments.put(f.index(), f));
        Set<String> ids = new HashSet<>(), content = new HashSet<>();
        if (request.type().name().equals("QUIZ")) {
            require(bank.questions().size() == request.count() && bank.words().isEmpty());
            for (var question : bank.questions()) {
                id(question.id()); require(ids.add(question.id())); text(question.prompt(), 2000);
                require(content.add(ActivityRules.normalize(question.prompt())) && request.topic().equals(question.topic()));
                text(question.explanation(), 2000); require(question.options().size() >= 2 && question.options().size() <= 6);
                Set<String> optionIds = new HashSet<>(), optionTexts = new HashSet<>(); String answer = null;
                for (var option : question.options()) {
                    id(option.id()); text(option.text(), 1000);
                    require(optionIds.add(option.id()) && optionTexts.add(option.text().strip().toLowerCase(Locale.ROOT)));
                    if (option.id().equals(question.correctOptionId())) answer = option.text();
                }
                require(answer != null); evidence(question.source(), answer, fragments);
            }
        } else {
            require(bank.words().size() == request.count() && bank.questions().isEmpty());
            for (var word : bank.words()) {
                id(word.id()); text(word.answer(), 100); text(word.clue(), 2000); text(word.explanation(), 2000);
                String answer = ActivityRules.normalize(word.answer());
                require(ids.add(word.id()) && content.add(answer) && answer.matches("[A-ZÑ]{2,25}") && request.topic().equals(word.topic()));
                evidence(word.source(), answer, fragments);
            }
        }
    }
    private static void evidence(Source source, String answer, Map<Integer, Fragment> fragments) {
        require(source != null); var fragment = fragments.get(source.fragmentIndex()); require(fragment != null);
        text(source.quote(), 4000); text(source.reference(), 500);
        require(fragment.reference().equals(source.reference()) && fragment.unitType().equals(source.unitType())
                && fragment.unitNumber() == source.unitNumber() && fragment.text().contains(source.quote()));
        String normalized = ActivityRules.normalize(answer);
        require(!normalized.isEmpty() && ActivityRules.normalize(source.quote()).contains(normalized));
    }
    private static void warnings(List<String> warnings) {
        require(warnings != null && warnings.size() <= 3 && new HashSet<>(warnings).size() == warnings.size()
                && Set.of("OCR_APPLIED", "PROVENANCE_UNVERIFIED", "ASSOCIATED_FILES_IGNORED").containsAll(warnings));
    }
    private static void text(String value, int maximum) { require(value != null && !value.isBlank() && value.length() <= maximum); }
    private static void id(String value) { require(value != null && value.matches("[A-Za-z0-9_-]{1,64}")); }
    private static void require(boolean condition) { if (!condition) throw DraftGenerationException.invalidContract(); }
}
