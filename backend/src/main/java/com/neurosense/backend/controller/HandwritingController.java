package com.neurosense.backend.controller;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;

@RestController
@RequestMapping("/predict")
public class HandwritingController {

    @PostMapping("/handwriting")
    public String predictHandwriting(@RequestParam("file") MultipartFile file) {

        try {

            File tempFile = File.createTempFile("handwriting", ".png");
            file.transferTo(tempFile);

            ProcessBuilder pb = new ProcessBuilder(
                    "python",
                    "ml-model/inference/predict_handwriting.py",
                    tempFile.getAbsolutePath()
            );

            Process process = pb.start();

            BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream())
            );

            String result = reader.readLine();

            return result;

        } catch (Exception e) {
            e.printStackTrace();
            return "{\"error\":\"prediction failed\"}";
        }
    }
}