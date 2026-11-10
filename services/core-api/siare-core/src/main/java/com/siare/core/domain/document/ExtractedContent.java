package com.siare.core.domain.document;

import java.util.List;

public record ExtractedContent(String fileType, String text, List<Fragment> fragments, int unitCount,
                               List<String> warnings, String extractionStatus) {
    public record Fragment(int index, String unitType, int unitNumber, String text) {}
}
