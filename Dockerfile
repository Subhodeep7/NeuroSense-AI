FROM eclipse-temurin:21-jdk-jammy

WORKDIR /app

# Install Python + dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Copy ML models
COPY ml-model ./ml-model

# Install ML dependencies
RUN pip3 install --no-cache-dir -r ml-model/requirements.txt

# Copy Spring Boot JAR (already built)
COPY backend/target/backend-0.0.1-SNAPSHOT.jar app.jar

# Run the application
CMD ["java", "-jar", "app.jar"]