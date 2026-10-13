import { api } from './client';
import type { ExperimentConfig, ExperimentResult } from './types';

/** GET /api/experiments/defaults */
export const getExperimentDefaults = (signal?: AbortSignal) =>
    api.get<ExperimentConfig>('/api/experiments/defaults', signal);

/** POST /api/experiments/run: synchronous, a default-sized run takes a few seconds */
export const runExperiment = (config: Partial<ExperimentConfig>) =>
    api.post<ExperimentResult>('/api/experiments/run', config);