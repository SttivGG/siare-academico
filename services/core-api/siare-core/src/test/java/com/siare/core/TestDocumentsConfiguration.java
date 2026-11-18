package com.siare.core;

import com.siare.core.application.port.out.*;
import org.springframework.context.annotation.*;
import static org.mockito.Mockito.mock;

@Configuration(proxyBeanMethods = false)
@Profile("test")
class TestDocumentsConfiguration {
    @Bean DocumentRepository documentRepository() { return mock(DocumentRepository.class); }
    @Bean DocumentStorage documentStorage() { return mock(DocumentStorage.class); }
    @Bean DocumentProcessor documentProcessor() { return mock(DocumentProcessor.class); }
}
