import { api } from './client';
import type { FlushResult, GossipResult, MeshPacket, MeshState, ResetResult } from './types';

/** GET /api/mesh/state */
export const getMeshState = (signal?: AbortSignal) =>
    api.get<MeshState>('/api/mesh/state', signal);

/** POST /api/mesh/gossip: one round of gossip across all virtual devices */
export const runGossip = () => api.post<GossipResult>('/api/mesh/gossip');

/** POST /api/mesh/flush: devices with internet upload everything they hold */
export const flushBridges = () => api.post<FlushResult>('/api/mesh/flush');

/** POST /api/mesh/reset: clears all devices and the idempotency cache */
export const resetMesh = () => api.post<ResetResult>('/api/mesh/reset');

/**
 * POST /api/mesh/inject: drop a browser-built packet into the mesh.
 *
 * NOT IMPLEMENTED ON THE BACKEND YET. It is added in Phase 3 and will return
 * 404 until then. Nothing in Phase 1 calls it.
 */
export const injectPacket = (deviceId: string, packet: MeshPacket) =>
    api.post<{ injectedAt: string; packetId: string }>('/api/mesh/inject', { deviceId, packet });