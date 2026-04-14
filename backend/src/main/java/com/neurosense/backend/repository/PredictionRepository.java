package com.neurosense.backend.repository;

import com.neurosense.backend.entity.Prediction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PredictionRepository
        extends JpaRepository<Prediction, Long> {

    List<Prediction> findByPatientId(Long patientId);

    // Used by /api/predictions/latest on the dashboard
    Optional<Prediction> findTopByOrderByCreatedAtDesc();

    // Used by /api/predictions/all for the History page global view
    List<Prediction> findAllByOrderByCreatedAtDesc();

}
