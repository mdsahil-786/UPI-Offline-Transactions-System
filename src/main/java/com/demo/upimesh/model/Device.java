package com.demo.upimesh.model;

import jakarta.persistence.*;

import java.time.Instant;

/**
 * A registered sender device. One active device per VPA in this demo, so the
 * VPA is the primary key and re-registering replaces the key.
 */
@Entity
@Table(name = "devices")
public class Device {

    @Id
    private String vpa;

    @Column(nullable = false, unique = true)
    private String deviceId;

    @Column(nullable = false, length = 512)
    private String publicKey; // base64 X.509 SPKI, P-256

    @Column(nullable = false)
    private Instant registeredAt;

    public Device() {}

    public Device(String vpa, String deviceId, String publicKey, Instant registeredAt) {
        this.vpa = vpa;
        this.deviceId = deviceId;
        this.publicKey = publicKey;
        this.registeredAt = registeredAt;
    }

    public String getVpa() { return vpa; }
    public void setVpa(String vpa) { this.vpa = vpa; }

    public String getDeviceId() { return deviceId; }
    public void setDeviceId(String deviceId) { this.deviceId = deviceId; }

    public String getPublicKey() { return publicKey; }
    public void setPublicKey(String publicKey) { this.publicKey = publicKey; }

    public Instant getRegisteredAt() { return registeredAt; }
    public void setRegisteredAt(Instant registeredAt) { this.registeredAt = registeredAt; }
}