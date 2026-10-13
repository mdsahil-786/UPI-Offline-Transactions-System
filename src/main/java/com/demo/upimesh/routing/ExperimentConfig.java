package com.demo.upimesh.routing;

import java.util.List;

/** Everything that defines one experiment. One simulation step is one second. */
public record ExperimentConfig(
        int nodes,
        int bridges,
        double areaSize,        // metres, square side
        double range,           // metres, contact radius
        double minSpeed,        // metres per second
        double maxSpeed,
        int maxPauseSteps,      // pause at each waypoint is uniform in [0, maxPauseSteps]
        int durationSteps,
        int messages,
        double generationWindow, // packets are created during the first fraction of the run
        int ttlSteps,
        int maxHops,            // 0 = unlimited
        int sprayCopies,        // initial copies for SPRAY_AND_WAIT
        int runs,
        long seed,
        List<Algorithm> algorithms) {

    public static ExperimentConfig defaults() {
        return new ExperimentConfig(
                40, 2, 1000, 30, 0.5, 1.5, 120,
                7200, 100, 0.5, 3600, 5, 8,
                10, 1L, List.of(Algorithm.values()));
    }

    /** Throws IllegalArgumentException with a readable message. */
    public void validate() {
        require(nodes >= 5 && nodes <= 100, "nodes must be between 5 and 100");
        require(bridges >= 1 && bridges <= nodes / 2, "bridges must be between 1 and half of the nodes");
        require(areaSize >= 100 && areaSize <= 5000, "areaSize must be between 100 and 5000 metres");
        require(range >= 1 && range <= 1000, "range must be between 1 and 1000 metres");
        require(minSpeed > 0 && minSpeed <= maxSpeed && maxSpeed <= 30,
                "speeds must satisfy 0 < minSpeed <= maxSpeed <= 30 m/s (a zero minimum makes random waypoint stall)");
        require(maxPauseSteps >= 0 && maxPauseSteps <= 3600, "maxPauseSteps must be between 0 and 3600");
        require(durationSteps >= 60 && durationSteps <= 20000, "durationSteps must be between 60 and 20000");
        require(messages >= 1 && messages <= 500, "messages must be between 1 and 500");
        require(generationWindow > 0 && generationWindow <= 1, "generationWindow must be in (0, 1]");
        require(ttlSteps >= 10 && ttlSteps <= 20000, "ttlSteps must be between 10 and 20000");
        require(maxHops >= 0 && maxHops <= 20, "maxHops must be between 0 (unlimited) and 20");
        require(sprayCopies >= 2 && sprayCopies <= 64, "sprayCopies must be between 2 and 64");
        require(runs >= 1 && runs <= 30, "runs must be between 1 and 30");
        require(algorithms != null && !algorithms.isEmpty(), "choose at least one algorithm");

        long work = (long) nodes * (nodes - 1) / 2 * durationSteps * runs * algorithms.size();
        require(work <= 1_500_000_000L,
                "this experiment is too large; reduce nodes, duration, runs or algorithms");
    }

    private static void require(boolean ok, String message) {
        if (!ok) throw new IllegalArgumentException(message);
    }
}
