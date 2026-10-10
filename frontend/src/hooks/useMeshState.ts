import { useQuery } from '@tanstack/react-query';
import { getMeshState } from '../api/mesh';

export const MESH_STATE_KEY = ['mesh', 'state'] as const;

export function useMeshState() {
    return useQuery({
        queryKey: MESH_STATE_KEY,
        queryFn: ({ signal }) => getMeshState(signal),
        refetchInterval: 3000,
    });
}