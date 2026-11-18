package com.siare.core.application.port.out;
import com.siare.core.domain.activity.ActivityBank;
public interface StructuredActivityContent { ActivityBank read(String extractedText); }
