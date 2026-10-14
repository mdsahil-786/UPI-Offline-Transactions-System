package com.demo.upimesh.routing;

import java.util.ArrayList;
import java.util.List;

public final class SweepRunner {

    private static final long MAX_MILLIS = 120_000;
    private static final long MAX_WORK = 4_000_000_000L;

    private SweepRunner() {}

    public static SweepResult run(ExperimentConfig base, SweepParameter parameter, List<Double> requested) {
        if (requested == null || requested.size() < 2 || requested.size() > 12) {
            throw new IllegalArgumentException("give between 2 and 12 values to sweep");
        }
        for (Double v : requested) {
            if (v == null || v.isNaN() || v.isInfinite()) {
                throw new IllegalArgumentException("every sweep value must be a number");
            }
        }
        List<Double> values = requested.stream().distinct().sorted().toList();
        if (values.size() < 2) {
            throw new IllegalArgumentException("give at least two different values to sweep");
        }

        // Build and validate every point before running any of them.
        List<ExperimentConfig> configs = new ArrayList<>();
        long work = 0;
        for (double v : values) {
            ExperimentConfig point = parameter.apply(base, v);
            point.validate();
            configs.add(point);
            work += (long) point.nodes() * (point.nodes() - 1) / 2
                    * point.durationSteps() * point.runs() * point.algorithms().size();
        }
        if (work > MAX_WORK) {
            throw new IllegalArgumentException(
                    "this sweep is too large; use fewer values, runs, algorithms or a shorter duration");
        }

        long deadline = System.nanoTime() + MAX_MILLIS * 1_000_000L;
        List<ExperimentResult> points = new ArrayList<>();
        for (ExperimentConfig point : configs) {
            long remaining = (deadline - System.nanoTime()) / 1_000_000L;
            if (remaining <= 0) {
                throw new IllegalArgumentException(
                        "The sweep ran past the time limit; use fewer values, runs or algorithms");
            }
            points.add(RoutingSimulator.run(point, remaining, true));
        }
        return new SweepResult(parameter.name(), values, points);
    }
}