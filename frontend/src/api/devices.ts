import { api } from './client';
import type { DeviceInfo, RegisterDeviceRequest } from './types';

/** POST /api/devices/register: binds a public key to a VPA (replaces any existing one) */
export const registerDevice = (req: RegisterDeviceRequest) =>
    api.post<DeviceInfo>('/api/devices/register', req);

/** GET /api/devices */
export const listDevices = (signal?: AbortSignal) =>
    api.get<DeviceInfo[]>('/api/devices', signal);
