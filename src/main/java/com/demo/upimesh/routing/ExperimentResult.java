package com.demo.upimesh.routing;

import java.util.List;

public record ExperimentResult(ExperimentConfig config, List<AlgorithmSummary> algorithms) {

    /** Mean, sample standard deviation and 95% confidence half-width over n runs. */
    public record Stat(Double mean, Double std, Double ci95, int n) {

        private static final double[] T95 = {
                12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228,
                2.201, 2.179, 2.160, 2.145, 2.131, 2.120, 2.110, 2.101, 2.093, 2.086,
                2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042};

        public static Stat of(List<Double> values) {
            int n = values.size();
            if (n == 0) return new Stat(null, null, null, 0);
            double mean = 0;
            for (double v : values) mean += v;
            mean /= n;
            double std = 0;
            if (n > 1) {
                double ss = 0;
                for (double v : values) ss += (v - mean) * (v - mean);
                std = Math.sqrt(ss / (n - 1));
            }
            double ci = n > 1 ? tCritical(n - 1) * std / Math.sqrt(n) : 0;
            return new Stat(mean, std, ci, n);
        }

        private static double tCritical(int df) {
            if (df <= 30) return T95[df - 1];
            return df <= 120 ? 2.0 : 1.96;
        }
    }

    /** One simulation run. Nullable fields are undefined when nothing was delivered. */
    public record RunMetrics(
            int run,
            int generated,
            int delivered,
            double deliveryRatio,
            Double meanLatencySeconds,
            Double meanHops,
            long transmissions,
            Double overheadRatio) {}

    public record AlgorithmSummary(
            String algorithm,
            List<RunMetrics> runs,
            Stat deliveryRatio,
            Stat latencySeconds,
            Stat overheadRatio,
            Stat hops,
            Stat transmissions) {}
}