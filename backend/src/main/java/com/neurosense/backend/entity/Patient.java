package com.neurosense.backend.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;

import java.util.List;

@Entity
@Table(name = "patients")

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder

// Prevents Hibernate proxy serialization errors
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Patient {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    private Integer age;

    private String gender;

    // Excluded from JSON — the frontend fetches predictions via a separate endpoint.
    // Without @JsonIgnore, Jackson triggers lazy-loading on every /api/patients call,
    // and missing @JsonManagedReference causes inconsistent serialization with @JsonBackReference.
    @JsonIgnore
    @OneToMany(mappedBy = "patient", cascade = CascadeType.ALL)
    private List<Prediction> predictions;
}
