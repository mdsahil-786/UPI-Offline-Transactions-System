package com.demo.upimesh.controller;

import com.demo.upimesh.crypto.SignatureService;
import com.demo.upimesh.model.AccountRepository;
import com.demo.upimesh.model.Device;
import com.demo.upimesh.model.DeviceRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Device registration: binds a P-256 public key to a VPA.
 *
 * DEMO LIMITATION: anyone can register a key for any existing VPA, and
 * re-registering replaces the old key. The signature check proves the sender
 * holds the registered key, NOT that they own the VPA. Real systems bind the
 * key during bank-side enrollment (SIM binding + OTP + PIN set).
 */
@RestController
@RequestMapping("/api/devices")
public class DeviceController {

    @Autowired private DeviceRepository devices;
    @Autowired private AccountRepository accounts;
    @Autowired private SignatureService signatures;

    public record RegisterRequest(String vpa, String deviceId, String publicKey) {}

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest req) {
        if (isBlank(req.vpa()) || isBlank(req.deviceId()) || isBlank(req.publicKey())) {
            return error(400, "vpa, deviceId and publicKey are required");
        }
        if (!accounts.existsById(req.vpa())) {
            return error(404, "Unknown VPA: " + req.vpa());
        }
        try {
            signatures.parsePublicKey(req.publicKey()); // must be a valid P-256 SPKI key
        } catch (Exception e) {
            return error(400, "Invalid public key (expected base64 X.509 P-256): " + e.getMessage());
        }

        Device device = new Device(req.vpa(), req.deviceId(), req.publicKey(), Instant.now());
        try {
            devices.save(device); // replaces any existing device for this VPA
        } catch (DataIntegrityViolationException e) {
            return error(409, "deviceId already registered to another VPA");
        }

        return ResponseEntity.ok(Map.of(
                "vpa", device.getVpa(),
                "deviceId", device.getDeviceId(),
                "registeredAt", device.getRegisteredAt().toString()));
    }

    /** For the Admin page. Public keys are omitted on purpose. */
    @GetMapping
    public List<Map<String, String>> list() {
        return devices.findAll().stream()
                .map(d -> Map.of(
                        "vpa", d.getVpa(),
                        "deviceId", d.getDeviceId(),
                        "registeredAt", d.getRegisteredAt().toString()))
                .toList();
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    // Same {"message": ...} shape that api/client.ts already knows how to read.
    private static ResponseEntity<Map<String, String>> error(int status, String message) {
        return ResponseEntity.status(status).body(Map.of("message", message));
    }
}
