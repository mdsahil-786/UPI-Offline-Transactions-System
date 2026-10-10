package com.demo.upimesh.crypto;

import org.springframework.stereotype.Service;

import java.security.*;
import java.security.interfaces.ECPublicKey;
import java.security.spec.*;
import java.util.Base64;

/**
 * ECDSA P-256 sign/verify.
 *
 * Web Crypto emits signatures as raw r||s (IEEE P1363). Java's default
 * "SHA256withECDSA" expects ASN.1 DER, so we use the P1363 variant explicitly.
 */
@Service
public class SignatureService {

    private static final String ALGORITHM = "SHA256withECDSAinP1363Format";
    private static final int P256_SIGNATURE_BYTES = 64;
    private static final ECParameterSpec P256 = loadP256();

    private static ECParameterSpec loadP256() {
        try {
            AlgorithmParameters params = AlgorithmParameters.getInstance("EC");
            params.init(new ECGenParameterSpec("secp256r1"));
            return params.getParameterSpec(ECParameterSpec.class);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("P-256 not available", e);
        }
    }

    /** Parse a base64 X.509 SPKI key and require it to be on the P-256 curve. */
    public PublicKey parsePublicKey(String base64Spki) throws GeneralSecurityException {
        byte[] der = Base64.getDecoder().decode(base64Spki);
        PublicKey key = KeyFactory.getInstance("EC").generatePublic(new X509EncodedKeySpec(der));
        if (!(key instanceof ECPublicKey ec) || !ec.getParams().getCurve().equals(P256.getCurve())) {
            throw new InvalidKeySpecException("Only P-256 keys are accepted");
        }
        return key;
    }

    /** True only if the signature is a valid 64-byte r||s over exactly these bytes. */
    public boolean verify(String base64Spki, byte[] data, byte[] signature) {
        if (signature == null || signature.length != P256_SIGNATURE_BYTES) return false;
        try {
            Signature s = Signature.getInstance(ALGORITHM);
            s.initVerify(parsePublicKey(base64Spki));
            s.update(data);
            return s.verify(signature);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            return false; // bad key encoding, wrong curve, malformed signature
        }
    }

    public byte[] sign(PrivateKey key, byte[] data) throws GeneralSecurityException {
        Signature s = Signature.getInstance(ALGORITHM);
        s.initSign(key);
        s.update(data);
        return s.sign();
    }

    public KeyPair generateKeyPair() throws GeneralSecurityException {
        KeyPairGenerator gen = KeyPairGenerator.getInstance("EC");
        gen.initialize(new ECGenParameterSpec("secp256r1"));
        return gen.generateKeyPair();
    }
}