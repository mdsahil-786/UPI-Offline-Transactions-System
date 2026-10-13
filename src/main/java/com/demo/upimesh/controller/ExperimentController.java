
package com.demo.upimesh.controller;

import com.demo.upimesh.routing.Algorithm;
import com.demo.upimesh.routing.ExperimentConfig;
import com.demo.upimesh.routing.RoutingSimulator;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/experiments")
public class ExperimentController {

    /** Every field is optional; anything missing falls back to the default. */
    public record Request(
            Integer nodes, Integer bridges, Double areaSize, Double range,
            Double minSpeed, Double maxSpeed, Integer maxPauseSteps,
            Integer durationSteps, Integer messages, Double generationWindow,
            Integer ttlSteps, Integer maxHops, Integer sprayCopies,
            Integer runs, Long seed, List<String> algorithms) {}

    @GetMapping("/defaults")
    public ExperimentConfig defaults() {
        return ExperimentConfig.defaults();
    }

    /** Runs synchronously. A default-sized experiment takes a few seconds. */
    @PostMapping("/run")
    public ResponseEntity<?> run(@RequestBody Request req) {
        try {
            ExperimentConfig d = ExperimentConfig.defaults();
            ExperimentConfig cfg = new ExperimentConfig(
                    or(req.nodes(), d.nodes()),
                    or(req.bridges(), d.bridges()),
                    or(req.areaSize(), d.areaSize()),
                    or(req.range(), d.range()),
                    or(req.minSpeed(), d.minSpeed()),
                    or(req.maxSpeed(), d.maxSpeed()),
                    or(req.maxPauseSteps(), d.maxPauseSteps()),
                    or(req.durationSteps(), d.durationSteps()),
                    or(req.messages(), d.messages()),
                    or(req.generationWindow(), d.generationWindow()),
                    or(req.ttlSteps(), d.ttlSteps()),
                    or(req.maxHops(), d.maxHops()),
                    or(req.sprayCopies(), d.sprayCopies()),
                    or(req.runs(), d.runs()),
                    or(req.seed(), d.seed()),
                    parseAlgorithms(req.algorithms(), d.algorithms()));
            return ResponseEntity.ok(RoutingSimulator.run(cfg));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    private static <T> T or(T value, T fallback) {
        return value != null ? value : fallback;
    }

    private static List<Algorithm> parseAlgorithms(List<String> names, List<Algorithm> fallback) {
        if (names == null || names.isEmpty()) return fallback;
        Set<Algorithm> chosen = new LinkedHashSet<>();
        for (String name : names) {
            try {
                chosen.add(Algorithm.valueOf(name.trim().toUpperCase()));
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("Unknown algorithm: " + name
                        + " (use DIRECT, EPIDEMIC, SPRAY_AND_WAIT or PROPHET)");
            }
        }
        return new ArrayList<>(chosen);
    }
}