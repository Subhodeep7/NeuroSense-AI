package com.neurosense.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import com.fasterxml.jackson.annotation.JsonBackReference;

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

    @JsonBackReference
    @ManyToOne
    @JoinColumn(name = "patient_id")
    private Patient patient;

}