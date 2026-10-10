import { useQuery } from '@tanstack/react-query';
import { getAccounts } from '../api/accounts';

export const ACCOUNTS_KEY = ['accounts'] as const;

export function useAccounts() {
    return useQuery({
        queryKey: ACCOUNTS_KEY,
        queryFn: ({ signal }) => getAccounts(signal),
        refetchInterval: 3000,
    });
}