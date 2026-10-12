// ---- Outcomes -------------------------------------------------------------

/** Result of BridgeIngestionService.ingest() */
// export type IngestOutcome = 'SETTLED' | 'DUPLICATE_DROPPED' | 'INVALID';

export type IngestOutcome = 'SETTLED' | 'REJECTED' | 'DUPLICATE_DROPPED' | 'INVALID';

/** Transaction.Status in the ledger */
export type TransactionStatus = 'SETTLED' | 'REJECTED';

/** Anything the UI colours as an outcome (Badge uses this). */
export type Outcome = IngestOutcome | TransactionStatus;

// ---- Domain (model/) ------------------------------------------------------

export interface Account {
    vpa: string;
    holderName: string;
    balance: number; // BigDecimal -> JSON number
    version: number;
}

export interface Transaction {
    id: number;
    packetHash: string;
    senderVpa: string;
    receiverVpa: string;
    amount: number;
    signedAt: string; // Instant -> ISO-8601 string
    settledAt: string; // Instant -> ISO-8601 string
    bridgeNodeId: string;
    hopCount: number;
    status: TransactionStatus;
    rejectReason: string | null;
}

/** Wire format that hops between phones (model/MeshPacket.java). */
export interface MeshPacket {
    packetId: string;
    ttl: number;
    createdAt: number; // epoch millis
    ciphertext: string; // base64
}

// ---- Ingestion ------------------------------------------------------------

/** BridgeIngestionService.IngestResult record */
export interface IngestResult {
    outcome: IngestOutcome;
    packetHash: string;
    reason: string | null; // populated on INVALID
    transactionId: number | null; // populated on SETTLED
}

// ---- Mesh simulator -------------------------------------------------------

export interface MeshDevice {
    deviceId: string;
    hasInternet: boolean;
    packetCount: number;
    packetIds: string[]; // first 8 chars of each packetId
}

export interface MeshState {
    devices: MeshDevice[];
    idempotencyCacheSize: number;
}

export interface GossipResult {
    transfers: number;
    deviceCounts: Record<string, number>;
}

export interface FlushItem {
    bridgeNode: string;
    packetId: string; // first 8 chars
    outcome: IngestOutcome;
    reason: string; // "" when none
    transactionId: number; // -1 when none
}

export interface FlushResult {
    uploadsAttempted: number;
    results: FlushItem[];
}

export interface ResetResult {
    status: string;
}

// ---- Server key -----------------------------------------------------------

export interface ServerKeyInfo {
    publicKey: string; // base64 X.509 SPKI
    algorithm: string;
    hybridScheme: string;
}
// ---- Devices --------------------------------------------------------------

export interface RegisterDeviceRequest {
    vpa: string;
    deviceId: string;
    publicKey: string; // base64 X.509 SPKI, P-256
}

export interface DeviceInfo {
    vpa: string;
    deviceId: string;
    registeredAt: string; // ISO-8601
}
export interface OfflineWallet {
    vpa: string;
    escrow: number;
    perTxnLimit: number;
    totalLoaded: number;
    totalSpent: number;
    version: number;
}

export interface WalletPolicy {
    maxAllowance: number;
    perTxnLimit: number;
    walletRequired: boolean;
}









// ---- Legacy demo endpoint (retired in Phase 3) ----------------------------

export interface DemoSendRequest {
    senderVpa: string;
    receiverVpa: string;
    amount: number;
    pin: string;
    ttl?: number;
    startDevice?: string;
}

export interface DemoSendResponse {
    packetId: string;
    ciphertextPreview: string;
    ttl: number;
    injectedAt: string;
}