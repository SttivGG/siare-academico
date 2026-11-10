package com.siare.core.infrastructure.config;

import com.siare.core.application.port.in.SubjectUseCase;
import com.siare.core.application.port.out.*;
import com.siare.core.application.service.DocumentService;
import com.siare.core.infrastructure.adapter.out.document.*;
import java.time.Clock;
import java.util.concurrent.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.boot.ApplicationRunner;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import tools.jackson.databind.ObjectMapper;

@Configuration(proxyBeanMethods = false)
public class DocumentConfiguration {
    @Bean DocumentValidator documentValidator(@Value("${siare.documents.max-bytes}") long max) { return new StructuralDocumentValidator(max); }
    @Bean(destroyMethod = "shutdown") ThreadPoolExecutor documentExecutor() {
        return new ThreadPoolExecutor(1, 1, 0, TimeUnit.SECONDS, new ArrayBlockingQueue<>(2), r -> new Thread(r, "document-processor"), new ThreadPoolExecutor.AbortPolicy());
    }
    @Bean DocumentService documentService(SubjectUseCase subjects, DocumentRepository documents, DocumentStorage storage,
            DocumentValidator validator, DocumentProcessor processor, ThreadPoolExecutor documentExecutor, Clock clock,
            @Value("${siare.documents.max-bytes}") long max) {
        return new DocumentService(subjects, documents, storage, validator, processor, documentExecutor, clock, max);
    }
    @Configuration(proxyBeanMethods = false)
    @Profile("!test")
    static class Adapters {
        @Bean MongoDocumentRepository documentRepository(MongoTemplate mongo) { return new MongoDocumentRepository(mongo); }
        @Bean ApplicationRunner documentIndexes(MongoDocumentRepository repository) { return args -> repository.ensureIndexes(); }
        @Bean DocumentStorage documentStorage(GridFsTemplate grid) { return new GridFsDocumentStorage(grid); }
        @Bean DocumentProcessor documentProcessor(@Value("${siare.documents.processor-url}") String url,
                @Value("${siare.documents.service-token}") String token, ObjectMapper mapper) { return new HttpDocumentProcessor(url, token, mapper); }
    }
}
