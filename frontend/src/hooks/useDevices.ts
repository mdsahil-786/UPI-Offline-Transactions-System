import { useQuery } from '@tanstack/react-query';
import { listDevices } from '../api/devices';

export const DEVICES_KEY = ['devices'] as const;

export function useDevices() {
    return useQuery({
        queryKey: DEVICES_KEY,
        queryFn: ({ signal }) => listDevices(signal),
        refetchInterval: 3000,
    });
}