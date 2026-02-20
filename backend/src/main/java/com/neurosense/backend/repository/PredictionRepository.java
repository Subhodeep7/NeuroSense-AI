package com.neurosense.backend.repository;

import com.neurosense.backend.entity.Prediction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PredictionRepository
        extends JpaRepository<Prediction, Long> {

    List<Prediction> findByPatientId(Long patientId);

}
