package com.demo.upimesh.routing;

/** The numeric settings a sweep can vary. Everything else stays as in the base scenario. */
public enum SweepParameter {
    MAX_HOPS("maxHops", true),
    TTL_STEPS("ttlSteps", true),
    RANGE("range", false),
    NODES("nodes", true),
    BRIDGES("bridges", true),
    SPRAY_COPIES("sprayCopies", true);

    private final String label;
    private final boolean whole;

    SweepParameter(String label, boolean whole) {
        this.label = label;
        this.whole = whole;
    }

    /** A copy of `c` with this setting changed to `value`. Validation happens later, per point. */
    public ExperimentConfig apply(ExperimentConfig c, double value) {
        if (whole && value != Math.rint(value)) {
            throw new IllegalArgumentException(label + " must be a whole number (got " + value + ")");
        }
        int i = (int) Math.rint(value);
        switch (this) {
            case MAX_HOPS:
                return with(c, c.nodes(), c.bridges(), c.range(), c.ttlSteps(), i, c.sprayCopies());
            case TTL_STEPS:
                return with(c, c.nodes(), c.bridges(), c.range(), i, c.maxHops(), c.sprayCopies());
            case RANGE:
                return with(c, c.nodes(), c.bridges(), value, c.ttlSteps(), c.maxHops(), c.sprayCopies());
            case NODES:
                return with(c, i, c.bridges(), c.range(), c.ttlSteps(), c.maxHops(), c.sprayCopies());
            case BRIDGES:
                return with(c, c.nodes(), i, c.range(), c.ttlSteps(), c.maxHops(), c.sprayCopies());
            case SPRAY_COPIES:
                return with(c, c.nodes(), c.bridges(), c.range(), c.ttlSteps(), c.maxHops(), i);
            default:
                throw new IllegalStateException();
        }
    }

    private static ExperimentConfig with(ExperimentConfig c, int nodes, int bridges, double range,
                                         int ttlSteps, int maxHops, int sprayCopies) {
        return new ExperimentConfig(nodes, bridges, c.areaSize(), range, c.minSpeed(), c.maxSpeed(),
                c.maxPauseSteps(), c.durationSteps(), c.messages(), c.generationWindow(),
                ttlSteps, maxHops, sprayCopies, c.runs(), c.seed(), c.algorithms());
    }
}
