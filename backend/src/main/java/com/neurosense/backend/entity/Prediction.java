package com.neurosense.backend.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "predictions")

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder

public class Prediction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String filePath;

    private String originalFileName;

    private Double voiceConfidence;

    private Double handwritingConfidence;

    private Double gaitConfidence;

    private Double tremorConfidence;

    private Double visualConfidence;

    private Integer reactionTimeMs;

    private Integer finalPrediction;

    private Double finalRisk;

    private LocalDateTime createdAt;

    // @JsonIgnore prevents Jackson from serializing the patient (avoids proxy crash).
    // FetchType.EAGER ensures pred.getPatient() is always available when the
    // controller manually extracts patient info — no LazyInitializationException.
    @JsonIgnore
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "patient_id")
    private Patient patient;

}