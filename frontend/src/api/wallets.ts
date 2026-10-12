import { api, ApiError } from './client';
import type { OfflineWallet, WalletPolicy } from './types';

const path = (vpa: string) => `/api/wallets/${encodeURIComponent(vpa)}`;

export const listWallets = (signal?: AbortSignal) => api.get<OfflineWallet[]>('/api/wallets', signal);

export const getWalletPolicy = (signal?: AbortSignal) =>
    api.get<WalletPolicy>('/api/wallets/policy', signal);

/** GET one wallet, or null when the account has none. */
export async function getWallet(vpa: string): Promise<OfflineWallet | null> {
    try {
        return await api.get<OfflineWallet>(path(vpa));
    } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
    }
}

/** Move money from the account balance into the offline wallet. */
export const loadWallet = (vpa: string, amount: number) =>
    api.post<OfflineWallet>(`${path(vpa)}/load`, { amount });

/** Return unspent escrow to the account, keeping the wallet. */
export const refundWallet = (vpa: string) => api.post<OfflineWallet>(`${path(vpa)}/refund`);

/** Return unspent escrow and remove the wallet. */
export const closeWallet = (vpa: string) => api.post<{ status: string }>(`${path(vpa)}/close`);