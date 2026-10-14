package com.demo.upimesh.routing;

import java.util.List;

/** One full experiment per swept value. points.get(i) was run with values.get(i). */
public record SweepResult(String parameter, List<Double> values, List<ExperimentResult> points) {}