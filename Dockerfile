# =========================
# Base Image
# =========================
FROM openjdk:17-slim

# Install Python + system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# =========================
# Copy ML models
# =========================
COPY ml-model ./ml-model

# Install Python dependencies
RUN pip3 install --no-cache-dir -r ml-model/requirements.txt

# =========================
# Copy Backend
# =========================
COPY backend ./backend

# Build Spring Boot
WORKDIR /app/backend
RUN chmod +x mvnw
RUN ./mvnw clean package -DskipTests

# =========================
# Runtime
# =========================
WORKDIR /app

# Expose backend port
EXPOSE 8080

# Run Spring Boot
CMD ["java", "-jar", "backend/target/backend-0.0.1-SNAPSHOT.jar"]