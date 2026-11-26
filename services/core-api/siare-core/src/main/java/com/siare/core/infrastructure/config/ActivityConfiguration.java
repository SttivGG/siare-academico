package com.siare.core.infrastructure.config;
import com.siare.core.application.port.in.*;
import com.siare.core.application.port.out.*;
import com.siare.core.application.service.*;
import com.siare.core.infrastructure.adapter.out.document.JsonStructuredActivityContent;
import java.time.Clock;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.*;
import tools.jackson.databind.ObjectMapper;
@Configuration(proxyBeanMethods=false)
public class ActivityConfiguration {
    @Bean ActivityFactoryProvider activityFactories() { return new RegisteredActivityFactories(); }
    @Bean GenerateActivityUseCase generateActivity(ActivityFactoryProvider factories) { return new GenerateActivityService(factories); }
    @Bean StructuredActivityContent structuredActivityContent(ObjectMapper json) { return new JsonStructuredActivityContent(json); }
    @Bean ActivityUseCase activityUseCase(SubjectUseCase subjects,GetDocumentUseCase documents,StructuredActivityContent structured,
            GenerateActivityUseCase generator,ActivityFactoryProvider factories,ActivityRepository repository,TransactionPort tx,Clock clock,
            ObjectProvider<GenerativeAssessmentProcessor> generative) {
        return new ActivityService(subjects,documents,structured,generator,factories,repository,tx,clock,generative);
    }
}
