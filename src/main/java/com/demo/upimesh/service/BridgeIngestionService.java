package com.demo.upimesh.service;

import com.demo.upimesh.crypto.HybridCryptoService;
import com.demo.upimesh.crypto.SignatureService;
import com.demo.upimesh.crypto.SignedEnvelope;
import com.demo.upimesh.model.Device;
import com.demo.upimesh.model.DeviceRepository;
import com.demo.upimesh.model.MeshPacket;
import com.demo.upimesh.model.PaymentInstruction;
import com.demo.upimesh.model.Transaction;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

/**
 * Server-side pipeline for one inbound packet:
 *
 *   HASH       hash the ciphertext
 *   CLAIM      claim the hash (idempotency). Duplicate -> drop.
 *   DECRYPT    decrypt (the GCM tag verifies integrity)
 *   VERIFY     parse the signed envelope, find the sender's registered device,
 *              verify the signature over the decoded payload bytes
 *   FRESHNESS  replay protection
 *   SETTLE     balance check, debit, credit, ledger row
 *
 * Each stage publishes a "stage" event so the live simulation can light it up.
 */
@Service
public class BridgeIngestionService {

    private static final Logger log = LoggerFactory.getLogger(BridgeIngestionService.class);

    @Autowired private HybridCryptoService crypto;
    @Autowired private IdempotencyService idempotency;
    @Autowired private SettlementService settlement;
    @Autowired private DeviceRepository devices;
    @Autowired private SignatureService signatures;
    @Autowired private EventBus bus;

    private final ObjectMapper json = new ObjectMapper();

    @Value("${upi.mesh.packet-max-age-seconds:86400}")
    private long maxAgeSeconds;

    public IngestResult ingest(MeshPacket packet, String bridgeNodeId, int hopCount) {
        String ingestId = UUID.randomUUID().toString().substring(0, 8);
        bus.publish("ingest-start", EventBus.fields(
                "ingestId", ingestId,
                "bridgeNodeId", bridgeNodeId,
                "packetId", shortId(packet.getPacketId()),
                "hops", hopCount));

        IngestResult result = process(ingestId, packet, bridgeNodeId, hopCount);

        bus.publish("ingest-done", EventBus.fields(
                "ingestId", ingestId,
                "outcome", result.outcome(),
                "reason", result.reason()));
        return result;
    }

    private IngestResult process(String ingestId, MeshPacket packet, String bridgeNodeId, int hopCount) {
        String packetHash = null;
        try {
            packetHash = crypto.hashCiphertext(packet.getCiphertext());
            String shortHash = packetHash.substring(0, 12) + "...";
            stage(ingestId, "HASH", true, "SHA-256 " + packetHash.substring(0, 12) + "…");

            // ---- Idempotency gate ----
            if (!idempotency.claim(packetHash)) {
                log.info("DUPLICATE packet {} from bridge {} — dropped", shortHash, bridgeNodeId);
                stage(ingestId, "CLAIM", false, "already claimed, duplicate dropped");
                return IngestResult.duplicate(packetHash);
            }
            stage(ingestId, "CLAIM", true, "first claim of this fingerprint");

            // ---- Decrypt ----
            byte[] plaintext;
            try {
                plaintext = crypto.decryptBytes(packet.getCiphertext());
            } catch (Exception e) {
                log.warn("Decryption failed for packet {}: {}", shortHash, e.getMessage());
                stage(ingestId, "DECRYPT", false, "decryption_failed: " + e.getMessage());
                return IngestResult.invalid(packetHash, "decryption_failed");
            }
            stage(ingestId, "DECRYPT", true, "RSA-OAEP key unwrapped, GCM tag verified");

            // ---- Parse envelope ----
            byte[] payloadBytes;
            byte[] signature;
            PaymentInstruction instruction;
            try {
                SignedEnvelope envelope = json.readValue(plaintext, SignedEnvelope.class);
                payloadBytes = Base64.getDecoder().decode(envelope.payload());
                signature = Base64.getDecoder().decode(envelope.sig());
                // Read the CLAIMED sender only to choose which key to verify with.
                // Nothing in here is trusted until the signature check passes.
                instruction = json.readValue(payloadBytes, PaymentInstruction.class);
            } catch (Exception e) {
                log.warn("Malformed envelope in packet {}: {}", shortHash, e.getMessage());
                stage(ingestId, "VERIFY", false, "malformed_envelope");
                return IngestResult.invalid(packetHash, "malformed_envelope");
            }

            if (instruction.getSenderVpa() == null || instruction.getReceiverVpa() == null
                    || instruction.getAmount() == null || instruction.getSignedAt() == null) {
                stage(ingestId, "VERIFY", false, "malformed_payload");
                return IngestResult.invalid(packetHash, "malformed_payload");
            }

            // ---- Verify signature ----
            Device device = devices.findById(instruction.getSenderVpa()).orElse(null);
            if (device == null) {
                log.warn("Packet {} claims unregistered sender {}", shortHash, instruction.getSenderVpa());
                // The sender may register later; don't let this hash block a legitimate retry.
                idempotency.release(packetHash);
                stage(ingestId, "VERIFY", false, "unknown_device: no key registered for " + instruction.getSenderVpa());
                return IngestResult.invalid(packetHash, "unknown_device");
            }
            if (!signatures.verify(device.getPublicKey(), payloadBytes, signature)) {
                log.warn("Bad signature on packet {} claiming sender {}", shortHash, instruction.getSenderVpa());
                stage(ingestId, "VERIFY", false, "bad_signature: does not match the key registered for " + instruction.getSenderVpa());
                return IngestResult.invalid(packetHash, "bad_signature");
            }
            stage(ingestId, "VERIFY", true, "valid ECDSA signature by " + instruction.getSenderVpa());

            // ---- Freshness check (replay protection) ----
            long ageSeconds = (Instant.now().toEpochMilli() - instruction.getSignedAt()) / 1000;
            if (ageSeconds > maxAgeSeconds) {
                log.warn("Packet {} too old ({}s), rejected", shortHash, ageSeconds);
                stage(ingestId, "FRESHNESS", false, "stale_packet: signed " + ageSeconds + "s ago");
                return IngestResult.invalid(packetHash, "stale_packet");
            }
            if (ageSeconds < -300) { // small clock-skew tolerance
                stage(ingestId, "FRESHNESS", false, "future_dated: signed " + (-ageSeconds) + "s in the future");
                return IngestResult.invalid(packetHash, "future_dated");
            }
            stage(ingestId, "FRESHNESS", true, "signed " + Math.max(ageSeconds, 0) + "s ago");

            // ---- Settle ----
            Transaction tx = settlement.settle(instruction, packetHash, bridgeNodeId, hopCount);
            if (tx.getStatus() == Transaction.Status.REJECTED) {
                stage(ingestId, "SETTLE", false, "insufficient_balance: " + instruction.getSenderVpa()
                        + " cannot cover ₹" + instruction.getAmount());
                return IngestResult.rejected(packetHash, tx);
            }
            stage(ingestId, "SETTLE", true, "₹" + instruction.getAmount() + " moved "
                    + instruction.getSenderVpa() + " → " + instruction.getReceiverVpa() + " (tx #" + tx.getId() + ")");
            return IngestResult.settled(packetHash, tx);

        } catch (Exception e) {
            log.error("Ingestion error: {}", e.getMessage(), e);
            // Unexpected failure (e.g. transient DB error): nothing settled, so allow a retry.
            if (packetHash != null) idempotency.release(packetHash);
            return IngestResult.invalid(packetHash == null ? "?" : packetHash,
                    "internal_error: " + e.getMessage());
        }
    }

    private void stage(String ingestId, String stage, boolean ok, String detail) {
        bus.publish("stage", EventBus.fields(
                "ingestId", ingestId,
                "stage", stage,
                "status", ok ? "PASS" : "FAIL",
                "detail", detail));
    }

    private static String shortId(String id) {
        return id == null ? "?" : id.length() > 8 ? id.substring(0, 8) : id;
    }

    public record IngestResult(String outcome, String packetHash, String reason, Long transactionId) {
        public static IngestResult settled(String hash, Transaction tx) {
            return new IngestResult("SETTLED", hash, null, tx.getId());
        }
        public static IngestResult rejected(String hash, Transaction tx) {
            return new IngestResult("REJECTED", hash, "insufficient_balance", tx.getId());
        }
        public static IngestResult duplicate(String hash) {
            return new IngestResult("DUPLICATE_DROPPED", hash, null, null);
        }
        public static IngestResult invalid(String hash, String reason) {
            return new IngestResult("INVALID", hash, reason, null);
        }
    }
}