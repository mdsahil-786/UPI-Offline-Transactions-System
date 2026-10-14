package com.demo.upimesh;

import com.demo.upimesh.routing.Algorithm;
import com.demo.upimesh.routing.ExperimentConfig;
import com.demo.upimesh.routing.ExperimentResult;
import com.demo.upimesh.routing.SweepParameter;
import com.demo.upimesh.routing.SweepResult;
import com.demo.upimesh.routing.SweepRunner;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class SweepRunnerTest {

    private static ExperimentConfig base() {
        return new ExperimentConfig(25, 2, 500, 40, 0.5, 1.5, 60,
                1500, 40, 0.5, 1000, 5, 8, 3, 21L, List.of(Algorithm.values()));
    }

    @Test
    void valuesAreSortedDeduplicatedAndAppliedOnePerPoint() {
        SweepResult result = SweepRunner.run(base(), SweepParameter.MAX_HOPS, List.of(3.0, 1.0, 2.0, 2.0));

        assertEquals(List.of(1.0, 2.0, 3.0), result.values());
        assertEquals(3, result.points().size());
        for (int i = 0; i < 3; i++) {
            assertEquals(result.values().get(i).intValue(), result.points().get(i).config().maxHops());
        }
    }

    @Test
    void longerLifetimeNeverDeliversLessOnTheSameWorlds() {
        // Lifetime does not touch the random draws, so every value sees identical worlds.
        SweepResult result = SweepRunner.run(base(), SweepParameter.TTL_STEPS, List.of(100.0, 300.0, 1000.0));
        for (int a = 0; a < Algorithm.values().length; a++) {
            for (int run = 0; run < 3; run++) {
                int previous = -1;
                for (ExperimentResult point : result.points()) {
                    int delivered = point.algorithms().get(a).runs().get(run).delivered();
                    assertTrue(delivered >= previous,
                            point.algorithms().get(a).algorithm() + " run " + run + " lost deliveries");
                    previous = delivered;
                }
            }
        }
    }

    @Test
    void sweepsAreDeterministic() {
        assertEquals(
                SweepRunner.run(base(), SweepParameter.RANGE, List.of(20.0, 40.0)),
                SweepRunner.run(base(), SweepParameter.RANGE, List.of(20.0, 40.0)));
    }

    @Test
    void badSweepsAreRejected() {
        assertThrows(IllegalArgumentException.class,
                () -> SweepRunner.run(base(), SweepParameter.MAX_HOPS, List.of(1.5, 2.0))); // not whole
        assertThrows(IllegalArgumentException.class,
                () -> SweepRunner.run(base(), SweepParameter.MAX_HOPS, List.of(2.0)));      // one value
        assertThrows(IllegalArgumentException.class,
                () -> SweepRunner.run(base(), SweepParameter.NODES, List.of(3.0, 30.0)));   // 3 phones is invalid
    }
}