import { api } from './client';
import type { Account } from './types';

/** GET /api/accounts */
export const getAccounts = (signal?: AbortSignal) =>
    api.get<Account[]>('/api/accounts', signal);