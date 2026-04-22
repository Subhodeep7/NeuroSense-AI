package com.neurosense.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

@Service
public class AudioStorageService {

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    public String store(MultipartFile file) throws Exception {

        // Always resolve to an absolute path — relative paths break with Tomcat
        Path uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
        Files.createDirectories(uploadPath);  // create dir if it doesn't exist

        String fileName = UUID.randomUUID() + "_" + file.getOriginalFilename();
        Path destination = uploadPath.resolve(fileName);

        file.transferTo(destination.toFile());

        return destination.toString();
    }
}
