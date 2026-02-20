package com.neurosense.backend.controller;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter

public class PredictionRequest {

    private String name;

    private Integer age;

    private String gender;

    private double[] features;
}
