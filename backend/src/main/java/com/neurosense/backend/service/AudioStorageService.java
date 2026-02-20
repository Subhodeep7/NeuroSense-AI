package com.neurosense.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.util.UUID;

@Service
public class AudioStorageService {

    private final String uploadDir =
            "C:/Users/mitra/Documents/NeuroSense-AI/uploads/";

    public String store(MultipartFile file) throws Exception {

        File dir = new File(uploadDir);

        if (!dir.exists()) {
            dir.mkdirs();
        }

        String fileName =
                UUID.randomUUID() + "_" + file.getOriginalFilename();

        File destination =
                new File(uploadDir + fileName);

        file.transferTo(destination);

        return destination.getAbsolutePath();
    }
}
