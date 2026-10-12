import { useQuery } from '@tanstack/react-query';
import { getWalletPolicy, listWallets } from '../api/wallets';

export const WALLETS_KEY = ['wallets'] as const;

export function useWallets() {
    return useQuery({
        queryKey: WALLETS_KEY,
        queryFn: ({ signal }) => listWallets(signal),
        refetchInterval: 3000,
    });
}

export function useWalletPolicy() {
    return useQuery({
        queryKey: ['wallet-policy'],
        queryFn: ({ signal }) => getWalletPolicy(signal),
        staleTime: Infinity,
    });
}