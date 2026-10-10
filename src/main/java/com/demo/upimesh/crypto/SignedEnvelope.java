package com.demo.upimesh.crypto;

/**
 * What sits inside the encrypted blob. Both fields are base64.
 *   payload = the exact UTF-8 JSON bytes the sender signed
 *   sig     = ECDSA P-256 signature over those bytes, IEEE P1363 (r||s, 64 bytes)
 */
public record SignedEnvelope(String payload, String sig) {}