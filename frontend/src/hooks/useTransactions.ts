import { useQuery } from '@tanstack/react-query';
import { getTransactions } from '../api/transactions';

export const TRANSACTIONS_KEY = ['transactions'] as const;

export function useTransactions() {
    return useQuery({
        queryKey: TRANSACTIONS_KEY,
        queryFn: ({ signal }) => getTransactions(signal),
        refetchInterval: 3000,
    });
}