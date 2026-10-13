package com.demo.upimesh.routing;

import com.demo.upimesh.routing.ExperimentResult.AlgorithmSummary;
import com.demo.upimesh.routing.ExperimentResult.RunMetrics;
import com.demo.upimesh.routing.ExperimentResult.Stat;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * A small discrete-time DTN simulator for the "deliver to ANY phone with internet" problem.
 *
 * Mobility and message creation use their own Random seeded per run, and no algorithm draws
 * from it, so every algorithm sees an identical world for a given run (paired comparison).
 * Nodes and contacts are always processed in index order, so results are deterministic.
 */
public final class RoutingSimulator {

    // PRoPHET constants (the values recommended in the original paper)
    private static final double P_INIT = 0.75;
    private static final double BETA = 0.25;
    private static final double GAMMA = 0.98;
    private static final double AGING_UNIT_STEPS = 30.0;

    private RoutingSimulator() {}

    public static ExperimentResult run(ExperimentConfig cfg) {
        cfg.validate();
        List<AlgorithmSummary> summaries = new ArrayList<>();
        for (Algorithm algo : cfg.algorithms()) {
            List<RunMetrics> runs = new ArrayList<>();
            for (int r = 0; r < cfg.runs(); r++) {
                runs.add(simulate(cfg, algo, cfg.seed() + r, r));
            }
            summaries.add(summarise(algo, runs));
        }
        return new ExperimentResult(cfg, summaries);
    }

    private static AlgorithmSummary summarise(Algorithm algo, List<RunMetrics> runs) {
        List<Double> ratio = new ArrayList<>();
        List<Double> latency = new ArrayList<>();
        List<Double> overhead = new ArrayList<>();
        List<Double> hops = new ArrayList<>();
        List<Double> tx = new ArrayList<>();
        for (RunMetrics m : runs) {
            ratio.add(m.deliveryRatio());
            if (m.meanLatencySeconds() != null) latency.add(m.meanLatencySeconds());
            if (m.overheadRatio() != null) overhead.add(m.overheadRatio());
            if (m.meanHops() != null) hops.add(m.meanHops());
            tx.add((double) m.transmissions());
        }
        return new AlgorithmSummary(algo.name(), runs, Stat.of(ratio), Stat.of(latency),
                Stat.of(overhead), Stat.of(hops), Stat.of(tx));
    }

    // ------------------------------------------------------------------ model

    private static final class Copy {
        final int messageId;
        final int hops;
        int copies; // SPRAY_AND_WAIT only

        Copy(int messageId, int hops, int copies) {
            this.messageId = messageId;
            this.hops = hops;
            this.copies = copies;
        }
    }

    private static final class Node {
        final int id;
        final boolean bridge;
        double x, y, destX, destY, speed;
        int pause;
        final Map<Integer, Copy> buffer = new LinkedHashMap<>(); // insertion order = deterministic
        double pGateway;   // PRoPHET: predictability of meeting any bridge
        double lastAged;

        Node(int id, boolean bridge) {
            this.id = id;
            this.bridge = bridge;
            this.pGateway = bridge ? 1.0 : 0.0;
        }
    }

    private static final class Message {
        final int source;
        final int createdStep;
        int deliveredStep = -1;
        int deliveredHops;

        Message(int source, int createdStep) {
            this.source = source;
            this.createdStep = createdStep;
        }
    }

    private static final class Counters {
        long transmissions;
    }

    // ------------------------------------------------------------- simulation

    static RunMetrics simulate(ExperimentConfig cfg, Algorithm algo, long seed, int runIndex) {
        final int n = cfg.nodes();
        Random rng = new Random(seed);

        Node[] nodes = new Node[n];
        for (int i = 0; i < n; i++) {
            nodes[i] = new Node(i, i >= n - cfg.bridges()); // the last `bridges` nodes have internet
            nodes[i].x = rng.nextDouble() * cfg.areaSize();
            nodes[i].y = rng.nextDouble() * cfg.areaSize();
            pickWaypoint(nodes[i], cfg, rng);
        }

        int sources = n - cfg.bridges();
        int generationEnd = Math.max(1, (int) (cfg.generationWindow() * cfg.durationSteps()));
        Message[] msgs = new Message[cfg.messages()];
        Map<Integer, List<Integer>> releaseAt = new HashMap<>();
        for (int m = 0; m < msgs.length; m++) {
            int when = rng.nextInt(generationEnd);
            int source = rng.nextInt(sources); // never a bridge
            msgs[m] = new Message(source, when);
            releaseAt.computeIfAbsent(when, k -> new ArrayList<>()).add(m);
        }

        double[][] pair = algo == Algorithm.PROPHET ? new double[n][n] : null;
        boolean[][] previous = new boolean[n][n];
        boolean[][] current = new boolean[n][n];
        double rangeSq = cfg.range() * cfg.range();
        Counters counters = new Counters();

        for (int step = 0; step < cfg.durationSteps(); step++) {
            final int now = step;

            // 1. new packets appear at their sources
            List<Integer> born = releaseAt.get(step);
            if (born != null) {
                for (int m : born) {
                    int copies = algo == Algorithm.SPRAY_AND_WAIT ? cfg.sprayCopies() : 1;
                    nodes[msgs[m].source].buffer.put(m, new Copy(m, 0, copies));
                }
            }

            // 2. everybody moves
            for (Node node : nodes) move(node, cfg, rng);

            // 3. expired packets disappear everywhere
            for (Node node : nodes) {
                node.buffer.values().removeIf(c -> now - msgs[c.messageId].createdStep >= cfg.ttlSteps());
            }

            // 4. who is in range of whom
            for (boolean[] row : current) Arrays.fill(row, false);
            for (int i = 0; i < n; i++) {
                for (int j = i + 1; j < n; j++) {
                    double dx = nodes[i].x - nodes[j].x;
                    double dy = nodes[i].y - nodes[j].y;
                    if (dx * dx + dy * dy <= rangeSq) current[i][j] = true;
                }
            }

            // 5. exchange packets over every contact
            for (int i = 0; i < n; i++) {
                for (int j = i + 1; j < n; j++) {
                    if (!current[i][j]) continue;
                    if (algo == Algorithm.PROPHET && !previous[i][j]) {
                        updatePredictability(nodes[i], nodes[j], pair, step); // only when a contact begins
                    }
                    transfer(nodes[i], nodes[j], cfg, algo, msgs, counters, step);
                    transfer(nodes[j], nodes[i], cfg, algo, msgs, counters, step);
                }
            }

            boolean[][] swap = previous;
            previous = current;
            current = swap;
        }

        int delivered = 0;
        long latencySum = 0;
        long hopSum = 0;
        for (Message m : msgs) {
            if (m.deliveredStep >= 0) {
                delivered++;
                latencySum += m.deliveredStep - m.createdStep;
                hopSum += m.deliveredHops;
            }
        }
        double ratio = (double) delivered / cfg.messages();
        Double meanLatency = delivered > 0 ? (double) latencySum / delivered : null;
        Double meanHops = delivered > 0 ? (double) hopSum / delivered : null;
        Double overhead = delivered > 0 ? (double) (counters.transmissions - delivered) / delivered : null;
        return new RunMetrics(runIndex, cfg.messages(), delivered, ratio, meanLatency, meanHops,
                counters.transmissions, overhead);
    }

    // --------------------------------------------------------------- routing

    private static void transfer(Node from, Node to, ExperimentConfig cfg, Algorithm algo,
                                 Message[] msgs, Counters counters, int step) {
        if (from.bridge || from.buffer.isEmpty()) return; // bridges only receive
        for (Copy copy : new ArrayList<>(from.buffer.values())) {
            if (to.buffer.containsKey(copy.messageId)) continue;
            if (cfg.maxHops() > 0 && copy.hops >= cfg.maxHops()) continue;
            int give = grant(algo, copy, from, to);
            if (give == 0) continue;

            counters.transmissions++;
            Message msg = msgs[copy.messageId];
            if (to.bridge) {
                // remembered so the same bridge is not offered the packet again
                to.buffer.put(copy.messageId, new Copy(copy.messageId, copy.hops + 1, 0));
                if (msg.deliveredStep < 0) {
                    msg.deliveredStep = step;
                    msg.deliveredHops = copy.hops + 1;
                }
            } else {
                to.buffer.put(copy.messageId, new Copy(copy.messageId, copy.hops + 1, give));
                if (algo == Algorithm.SPRAY_AND_WAIT) copy.copies -= give;
            }
        }
    }

    /** How many copies the receiver gets; 0 means "do not forward this packet". */
    private static int grant(Algorithm algo, Copy copy, Node from, Node to) {
        switch (algo) {
            case DIRECT:
                return (to.bridge && copy.hops == 0) ? 1 : 0; // only the source hands over, only to a bridge
            case EPIDEMIC:
                return 1;
            case SPRAY_AND_WAIT:
                if (to.bridge) return 1;                      // the wait phase still delivers
                return copy.copies >= 2 ? copy.copies / 2 : 0; // binary spraying
            case PROPHET:
                return (to.bridge || to.pGateway > from.pGateway) ? 1 : 0;
            default:
                return 0;
        }
    }

    private static void updatePredictability(Node a, Node b, double[][] pair, int step) {
        age(a, pair, step);
        age(b, pair, step);

        pair[a.id][b.id] = pair[a.id][b.id] + (1 - pair[a.id][b.id]) * P_INIT;
        pair[b.id][a.id] = pair[b.id][a.id] + (1 - pair[b.id][a.id]) * P_INIT;

        if (a.bridge) {
            b.pGateway = b.pGateway + (1 - b.pGateway) * P_INIT;
        } else if (b.bridge) {
            a.pGateway = a.pGateway + (1 - a.pGateway) * P_INIT;
        } else {
            // transitivity: each learns about the bridges through the other
            double aOld = a.pGateway;
            double bOld = b.pGateway;
            a.pGateway = aOld + (1 - aOld) * pair[a.id][b.id] * bOld * BETA;
            b.pGateway = bOld + (1 - bOld) * pair[b.id][a.id] * aOld * BETA;
        }
    }

    private static void age(Node node, double[][] pair, int step) {
        double k = (step - node.lastAged) / AGING_UNIT_STEPS;
        if (k <= 0) return;
        double factor = Math.pow(GAMMA, k);
        double[] row = pair[node.id];
        for (int x = 0; x < row.length; x++) row[x] *= factor;
        if (!node.bridge) node.pGateway *= factor;
        node.lastAged = step;
    }

    // -------------------------------------------------------------- mobility

    private static void pickWaypoint(Node node, ExperimentConfig cfg, Random rng) {
        node.destX = rng.nextDouble() * cfg.areaSize();
        node.destY = rng.nextDouble() * cfg.areaSize();
        node.speed = cfg.minSpeed() + rng.nextDouble() * (cfg.maxSpeed() - cfg.minSpeed());
        node.pause = 0;
    }

    private static void move(Node node, ExperimentConfig cfg, Random rng) {
        if (node.pause > 0) {
            node.pause--;
            return;
        }
        double dx = node.destX - node.x;
        double dy = node.destY - node.y;
        double dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= node.speed) { // arrives this step
            node.x = node.destX;
            node.y = node.destY;
            int pause = cfg.maxPauseSteps() > 0 ? rng.nextInt(cfg.maxPauseSteps() + 1) : 0;
            pickWaypoint(node, cfg, rng);
            node.pause = pause;
        } else {
            node.x += dx / dist * node.speed;
            node.y += dy / dist * node.speed;
        }
    }
}