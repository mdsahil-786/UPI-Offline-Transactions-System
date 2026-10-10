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

/**
 * Server-side pipeline for one inbound packet:
 *
 *   1. Hash the ciphertext.
 *   2. Claim the hash (idempotency). Duplicate -> drop.
 *   3. Decrypt (GCM tag verifies integrity). Failure -> decryption_failed.
 *   4. Parse the signed envelope {payload, sig}. Failure -> malformed_envelope.
 *   5. Look up the sender's registered device. None -> unknown_device.
 *   6. Verify the signature over the decoded payload bytes. Failure -> bad_signature.
 *   7. Freshness check (replay protection).
 *   8. Settle.
 */
@Service
public class BridgeIngestionService {

    private static final Logger log = LoggerFactory.getLogger(BridgeIngestionService.class);

    @Autowired private HybridCryptoService crypto;
    @Autowired private IdempotencyService idempotency;
    @Autowired private SettlementService settlement;
    @Autowired private DeviceRepository devices;
    @Autowired private SignatureService signatures;

    private final ObjectMapper json = new ObjectMapper();

    @Value("${upi.mesh.packet-max-age-seconds:86400}")
    private long maxAgeSeconds;

    public IngestResult ingest(MeshPacket packet, String bridgeNodeId, int hopCount) {
        try {
            String packetHash = crypto.hashCiphertext(packet.getCiphertext());
            String shortHash = packetHash.substring(0, 12) + "...";

            // ---- Idempotency gate ----
            if (!idempotency.claim(packetHash)) {
                log.info("DUPLICATE packet {} from bridge {} — dropped", shortHash, bridgeNodeId);
                return IngestResult.duplicate(packetHash);
            }

            // ---- Decrypt ----
            byte[] plaintext;
            try {
                plaintext = crypto.decryptBytes(packet.getCiphertext());
            } catch (Exception e) {
                log.warn("Decryption failed for packet {}: {}", shortHash, e.getMessage());
                return IngestResult.invalid(packetHash, "decryption_failed");
            }

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
                return IngestResult.invalid(packetHash, "malformed_envelope");
            }

            if (instruction.getSenderVpa() == null || instruction.getReceiverVpa() == null
                    || instruction.getAmount() == null || instruction.getSignedAt() == null) {
                return IngestResult.invalid(packetHash, "malformed_payload");
            }

            // ---- Verify signature ----
            Device device = devices.findById(instruction.getSenderVpa()).orElse(null);
            if (device == null) {
                log.warn("Packet {} claims unregistered sender {}", shortHash, instruction.getSenderVpa());
                return IngestResult.invalid(packetHash, "unknown_device");
            }
            if (!signatures.verify(device.getPublicKey(), payloadBytes, signature)) {
                log.warn("Bad signature on packet {} claiming sender {}", shortHash, instruction.getSenderVpa());
                return IngestResult.invalid(packetHash, "bad_signature");
            }

            // ---- Freshness check (replay protection) ----
            long ageSeconds = (Instant.now().toEpochMilli() - instruction.getSignedAt()) / 1000;
            if (ageSeconds > maxAgeSeconds) {
                log.warn("Packet {} too old ({}s), rejected", shortHash, ageSeconds);
                return IngestResult.invalid(packetHash, "stale_packet");
            }
            if (ageSeconds < -300) { // small clock-skew tolerance
                return IngestResult.invalid(packetHash, "future_dated");
            }

            // ---- Settle ----
            Transaction tx = settlement.settle(instruction, packetHash, bridgeNodeId, hopCount);
            return IngestResult.settled(packetHash, tx);

        } catch (Exception e) {
            log.error("Ingestion error: {}", e.getMessage(), e);
            return IngestResult.invalid("?", "internal_error: " + e.getMessage());
        }
    }

    public record IngestResult(String outcome, String packetHash, String reason, Long transactionId) {
        public static IngestResult settled(String hash, Transaction tx) {
            return new IngestResult("SETTLED", hash, null, tx.getId());
        }
        public static IngestResult duplicate(String hash) {
            return new IngestResult("DUPLICATE_DROPPED", hash, null, null);
        }
        public static IngestResult invalid(String hash, String reason) {
            return new IngestResult("INVALID", hash, reason, null);
        }
    }
}