package com.neurosense.backend.config;

import com.neurosense.backend.entity.Patient;
import com.neurosense.backend.repository.PatientRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Seeds the database with demo patients on startup IF the patients table is empty.
 * This ensures fresh clones (empty DB) work immediately — no manual setup needed.
 * Existing production data is never touched.
 */
@Configuration
public class DataInitializer {

    @Bean
    CommandLineRunner seedPatients(PatientRepository patientRepository) {
        return args -> {
            if (patientRepository.count() == 0) {
                System.out.println("[DataInitializer] Empty database detected — seeding demo patients...");

                patientRepository.save(Patient.builder()
                        .name("Rajesh Kumar")
                        .age(67)
                        .gender("Male")
                        .build());

                patientRepository.save(Patient.builder()
                        .name("Priya Sharma")
                        .age(58)
                        .gender("Female")
                        .build());

                patientRepository.save(Patient.builder()
                        .name("Arjun Mehta")
                        .age(72)
                        .gender("Male")
                        .build());

                patientRepository.save(Patient.builder()
                        .name("Sunita Patel")
                        .age(64)
                        .gender("Female")
                        .build());

                patientRepository.save(Patient.builder()
                        .name("Demo Patient")
                        .age(55)
                        .gender("Male")
                        .build());

                System.out.println("[DataInitializer] ✓ 5 demo patients created successfully.");
            } else {
                System.out.println("[DataInitializer] Patients already exist (" 
                        + patientRepository.count() + ") — skipping seed.");
            }
        };
    }
}
