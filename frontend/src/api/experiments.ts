import { api } from './client';
import type { ExperimentConfig, ExperimentResult, SweepParameter, SweepResult } from './types';

/** GET /api/experiments/defaults */
export const getExperimentDefaults = (signal?: AbortSignal) =>
    api.get<ExperimentConfig>('/api/experiments/defaults', signal);

/** POST /api/experiments/run: synchronous, a default-sized run takes a few seconds */
export const runExperiment = (config: Partial<ExperimentConfig>) =>
    api.post<ExperimentResult>('/api/experiments/run', config);

/** POST /api/experiments/sweep: one experiment per value; the scenario's value for the swept field is ignored */
export const runSweep = (scenario: Partial<ExperimentConfig>, parameter: SweepParameter, values: number[]) =>
    api.post<SweepResult>('/api/experiments/sweep', { scenario, parameter, values });