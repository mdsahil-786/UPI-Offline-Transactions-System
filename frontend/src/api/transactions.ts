import { api } from './client';
import type { Transaction } from './types';

/** GET /api/transactions (last 20, newest first) */
export const getTransactions = (signal?: AbortSignal) =>
    api.get<Transaction[]>('/api/transactions', signal);