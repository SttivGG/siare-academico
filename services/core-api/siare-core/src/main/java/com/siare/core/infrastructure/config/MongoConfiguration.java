package com.siare.core.infrastructure.config;

import java.util.concurrent.TimeUnit;
import org.springframework.boot.mongodb.autoconfigure.MongoClientSettingsBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class MongoConfiguration {
    @Bean
    MongoClientSettingsBuilderCustomizer boundedMongoTimeouts() {
        return builder -> builder
                .applyToClusterSettings(settings -> settings.serverSelectionTimeout(2, TimeUnit.SECONDS))
                .applyToSocketSettings(settings -> settings
                        .connectTimeout(2, TimeUnit.SECONDS)
                        .readTimeout(2, TimeUnit.SECONDS))
                .applyToConnectionPoolSettings(settings -> settings.maxSize(5));
    }
}
