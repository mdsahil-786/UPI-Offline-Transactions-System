package com.demo.upimesh.service;

import com.demo.upimesh.crypto.HybridCryptoService;
import com.demo.upimesh.crypto.ServerKeyHolder;
import com.demo.upimesh.crypto.SignatureService;
import com.demo.upimesh.crypto.SignedEnvelope;
import com.demo.upimesh.model.Account;
import com.demo.upimesh.model.AccountRepository;
import com.demo.upimesh.model.Device;
import com.demo.upimesh.model.DeviceRepository;
import com.demo.upimesh.model.MeshPacket;
import com.demo.upimesh.model.PaymentInstruction;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.security.KeyPair;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Seeds demo accounts and devices, and simulates a sender phone that builds a
 * signed + encrypted packet. Retired in Phase 3 when the browser takes over.
 */
@Service
public class DemoService {

    private static final Logger log = LoggerFactory.getLogger(DemoService.class);

    @Autowired private AccountRepository accounts;
    @Autowired private DeviceRepository devices;
    @Autowired private HybridCryptoService crypto;
    @Autowired private ServerKeyHolder serverKey;
    @Autowired private SignatureService signatures;

    private final ObjectMapper json = new ObjectMapper();
    private final Map<String, KeyPair> demoKeys = new ConcurrentHashMap<>();

    @PostConstruct
    public void seed() throws Exception {
        if (accounts.count() == 0) {
            accounts.save(new Account("alice@demo", "Alice", new BigDecimal("5000.00")));
            accounts.save(new Account("bob@demo",   "Bob",   new BigDecimal("1000.00")));
            accounts.save(new Account("carol@demo", "Carol", new BigDecimal("2500.00")));
            accounts.save(new Account("dave@demo",  "Dave",  new BigDecimal("500.00")));
            log.info("Seeded 4 demo accounts");
        }
        for (String vpa : List.of("alice@demo", "bob@demo", "carol@demo", "dave@demo")) {
            KeyPair kp = signatures.generateKeyPair();
            demoKeys.put(vpa, kp);
            devices.save(new Device(vpa, "demo-" + vpa,
                    Base64.getEncoder().encodeToString(kp.getPublic().getEncoded()), Instant.now()));
        }
        log.info("Registered 4 demo devices");
    }

    public MeshPacket createPacket(String senderVpa, String receiverVpa,
                                   BigDecimal amount, String pin, int ttl) throws Exception {
        KeyPair kp = demoKeys.get(senderVpa);
        if (kp == null) throw new IllegalArgumentException("No demo key for " + senderVpa);

        PaymentInstruction instruction = new PaymentInstruction(
                senderVpa, receiverVpa, amount, sha256Hex(pin),
                UUID.randomUUID().toString(), Instant.now().toEpochMilli());

        byte[] payloadBytes = json.writeValueAsBytes(instruction);
        byte[] sig = signatures.sign(kp.getPrivate(), payloadBytes);
        byte[] envelope = json.writeValueAsBytes(new SignedEnvelope(
                Base64.getEncoder().encodeToString(payloadBytes),
                Base64.getEncoder().encodeToString(sig)));

        MeshPacket packet = new MeshPacket();
        packet.setPacketId(UUID.randomUUID().toString());
        packet.setTtl(ttl);
        packet.setCreatedAt(Instant.now().toEpochMilli());
        packet.setCiphertext(crypto.encryptBytes(envelope, serverKey.getPublicKey()));
        return packet;
    }

    private String sha256Hex(String input) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        byte[] hash = md.digest(input.getBytes());
        StringBuilder hex = new StringBuilder();
        for (byte b : hash) hex.append(String.format("%02x", b));
        return hex.toString();
    }
}
