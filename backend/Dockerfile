# ─── 1단계: 빌드 ───────────────────────────────────────────────
FROM eclipse-temurin:21-jdk AS builder

WORKDIR /app

# Gradle wrapper + 의존성을 먼저 받아 캐시 레이어로 분리
# 라이브러리는 잘 안 바뀌므로 소스만 바뀌면 이 레이어를 재사용해 빌드가 빨라진다.
COPY gradlew .
COPY gradle gradle
COPY build.gradle settings.gradle ./
RUN ./gradlew dependencies --no-daemon -q

# 소스 복사 및 빌드 (테스트는 CI/로컬에서 돌리므로 이미지 빌드에서는 생략)
COPY src src
RUN ./gradlew bootJar --no-daemon -x test

# ─── 2단계: 실행 ───────────────────────────────────────────────
# 실행에는 빌드 도구가 필요 없으므로 JRE만 사용 (멀티스테이지 빌드)
FROM eclipse-temurin:21-jre AS runtime

WORKDIR /app

# 보안: non-root 실행
RUN groupadd -r spring && useradd -r -g spring spring \
    && mkdir -p /app/data && chown spring:spring /app/data
USER spring:spring

COPY --chown=spring:spring --from=builder /app/build/libs/*-SNAPSHOT.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
