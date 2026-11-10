FROM maven:3.9.16-eclipse-temurin-21@sha256:99e61abcff91a9b1333463bd8451fb18495d6eba9250ac66a338b518f8278320 AS build
WORKDIR /build
COPY pom.xml ./
RUN mvn -B -ntp dependency:go-offline
COPY src ./src
COPY docker/Healthcheck.java ./docker/Healthcheck.java
RUN mvn -B -ntp verify && javac --release 21 -d /health docker/Healthcheck.java

FROM eclipse-temurin:21.0.13_9-jre-jammy@sha256:1eac8b8fee11ca7d6725a48bc5d41992ed1561504ebae25490d2d062847e8269
WORKDIR /app
RUN groupadd --gid 10001 siare && useradd --uid 10001 --gid siare --no-create-home siare
COPY --from=build --chown=10001:10001 /build/target/siare-core-0.0.1-SNAPSHOT.jar app.jar
COPY --from=build --chown=10001:10001 /health /opt/health
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
