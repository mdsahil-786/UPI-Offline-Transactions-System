package com.demo.upimesh;

import com.demo.upimesh.crypto.SignatureService;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.Signature;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

class SignatureServiceTest {

    private final SignatureService svc = new SignatureService();
    private final byte[] data = "pay bob 100".getBytes(StandardCharsets.UTF_8);

    private String spki(KeyPair kp) {
        return Base64.getEncoder().encodeToString(kp.getPublic().getEncoded());
    }

    @Test
    void signAndVerifyRoundTrip() throws Exception {
        KeyPair kp = svc.generateKeyPair();
        byte[] sig = svc.sign(kp.getPrivate(), data);
        assertEquals(64, sig.length);
        assertTrue(svc.verify(spki(kp), data, sig));
    }

    @Test
    void alteredDataFails() throws Exception {
        KeyPair kp = svc.generateKeyPair();
        byte[] sig = svc.sign(kp.getPrivate(), data);
        byte[] altered = data.clone();
        altered[0] ^= 1;
        assertFalse(svc.verify(spki(kp), altered, sig));
    }

    @Test
    void signatureFromAnotherKeyFails() throws Exception {
        byte[] sig = svc.sign(svc.generateKeyPair().getPrivate(), data);
        assertFalse(svc.verify(spki(svc.generateKeyPair()), data, sig));
    }

    @Test
    void derEncodedSignatureIsRejected() throws Exception {
        // The classic gotcha: Java's default ECDSA output is DER, Web Crypto sends r||s.
        KeyPair kp = svc.generateKeyPair();
        Signature der = Signature.getInstance("SHA256withECDSA");
        der.initSign(kp.getPrivate());
        der.update(data);
        assertFalse(svc.verify(spki(kp), data, der.sign()));
    }

    @Test
    void garbagePublicKeyFailsWithoutThrowing() {
        assertFalse(svc.verify("not-base64!!", data, new byte[64]));
    }
}