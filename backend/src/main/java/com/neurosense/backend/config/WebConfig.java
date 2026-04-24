package com.neurosense.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * WebConfig:
 * 1. CORS — allows the Vite dev server (any localhost port) to call the backend
 * 2. Static resources — serves uploads/ at /uploads/** for annotated skeleton images
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Value("${app.upload.dir}")
    private String uploadDir;

    // ── CORS ────────────────────────────────────────────────────────────────
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns("*")   // allowedOriginPatterns supports * without credentials conflict
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .maxAge(3600);
    }

    // ── Static uploads ───────────────────────────────────────────────────────
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String location = uploadDir.endsWith("/") ? uploadDir : uploadDir + "/";
        if (!location.startsWith("file:")) {
            location = "file:///" + location.replace("\\", "/");
        }
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations(location);
    }
}
