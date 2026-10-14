package com.demo.upimesh;

import com.demo.upimesh.routing.Algorithm;
import com.demo.upimesh.routing.ExperimentConfig;
import com.demo.upimesh.routing.ExperimentResult;
import com.demo.upimesh.routing.ExperimentResult.RunMetrics;
import com.demo.upimesh.routing.RoutingSimulator;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class RoutingSimulatorTest {

    private static ExperimentConfig scenario(int maxHops) {
        return new ExperimentConfig(30, 2, 600, 40, 0.5, 1.5, 60,
                3000, 60, 0.5, 2000, maxHops, 8, 5, 42L, List.of(Algorithm.values()));
    }

    private static List<RunMetrics> runsOf(ExperimentResult result, Algorithm algo) {
        return result.algorithms().stream()
                .filter(s -> s.algorithm().equals(algo.name()))
                .findFirst().orElseThrow().runs();
    }

    @Test
    void sameSeedGivesIdenticalResults() {
        assertEquals(RoutingSimulator.run(scenario(5)), RoutingSimulator.run(scenario(5)));
    }

    @Test
    void whenEveryoneIsInRangeEveryAlgorithmDeliversEverythingInstantly() {
        ExperimentConfig cfg = new ExperimentConfig(10, 1, 100, 1000, 1, 2, 0,
                120, 20, 0.5, 100, 5, 8, 2, 7L, List.of(Algorithm.values()));
        for (var summary : RoutingSimulator.run(cfg).algorithms()) {
            assertEquals(1.0, summary.deliveryRatio().mean(), 1e-9, summary.algorithm());
            assertEquals(0.0, summary.latencySeconds().mean(), 1e-9, summary.algorithm());
        }
    }

    @Test
    void epidemicNeverDeliversLessThanDirectOnTheSameWorld() {
        for (int hops : new int[] {0, 5}) {
            ExperimentResult result = RoutingSimulator.run(scenario(hops));
            List<RunMetrics> epidemic = runsOf(result, Algorithm.EPIDEMIC);
            List<RunMetrics> direct = runsOf(result, Algorithm.DIRECT);
            for (int i = 0; i < epidemic.size(); i++) {
                assertTrue(epidemic.get(i).delivered() >= direct.get(i).delivered(),
                        "hops=" + hops + " run " + i);
            }
        }
    }

    @Test
    void sprayAndProphetNeverRelayMoreThanEpidemicWhenHopsAreUnlimited() {
        ExperimentResult result = RoutingSimulator.run(scenario(0));
        List<RunMetrics> epidemic = runsOf(result, Algorithm.EPIDEMIC);
        for (Algorithm other : new Algorithm[] {Algorithm.SPRAY_AND_WAIT, Algorithm.PROPHET}) {
            List<RunMetrics> runs = runsOf(result, other);
            for (int i = 0; i < epidemic.size(); i++) {
                assertTrue(runs.get(i).transmissions() <= epidemic.get(i).transmissions(),
                        other + " transmissions, run " + i);
                assertTrue(runs.get(i).delivered() <= epidemic.get(i).delivered(),
                        other + " delivered, run " + i);
            }
        }
    }

    @Test
    void invalidConfigurationsAreRejected() {
        ExperimentConfig tooFewNodes = new ExperimentConfig(4, 1, 600, 40, 0.5, 1.5, 60,
                3000, 60, 0.5, 2000, 5, 8, 5, 1L, List.of(Algorithm.EPIDEMIC));
        assertThrows(IllegalArgumentException.class, () -> RoutingSimulator.run(tooFewNodes));

        ExperimentConfig tooBig = new ExperimentConfig(100, 2, 600, 40, 0.5, 1.5, 60,
                20000, 60, 0.5, 2000, 5, 8, 30, 1L, List.of(Algorithm.values()));
        assertThrows(IllegalArgumentException.class, () -> RoutingSimulator.run(tooBig));
    }

    @Test
    void skippingUnchangedContactsChangesNothing() {
        for (int hops : new int[] {0, 5}) {
            ExperimentConfig cfg = new ExperimentConfig(25, 2, 500, 40, 0.5, 1.5, 60,
                    1500, 40, 0.5, 1000, hops, 8, 2, 11L, List.of(Algorithm.values()));
            assertEquals(RoutingSimulator.run(cfg, 120_000, false),
                    RoutingSimulator.run(cfg, 120_000, true), "hops=" + hops);
        }
    }

    @Test
    void aRunPastTheTimeLimitIsStopped() {
        assertThrows(IllegalArgumentException.class, () -> RoutingSimulator.run(scenario(5), 1, true));
    }

    @Test
    void withAHopLimitOfOneEveryAlgorithmDeliversTheSamePayments() {
        ExperimentResult result = RoutingSimulator.run(scenario(1));
        List<RunMetrics> direct = runsOf(result, Algorithm.DIRECT);
        for (Algorithm other : new Algorithm[] {Algorithm.EPIDEMIC, Algorithm.SPRAY_AND_WAIT, Algorithm.PROPHET}) {
            List<RunMetrics> runs = runsOf(result, other);
            for (int i = 0; i < direct.size(); i++) {
                assertEquals(direct.get(i).delivered(), runs.get(i).delivered(), other + " run " + i);
                assertEquals(direct.get(i).meanLatencySeconds(), runs.get(i).meanLatencySeconds(),
                        other + " latency, run " + i);
            }
        }
    }
}
