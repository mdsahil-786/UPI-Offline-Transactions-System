package com.demo.upimesh.controller;

import com.demo.upimesh.model.OfflineWallet;
import com.demo.upimesh.service.WalletService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/wallets")
public class WalletController {

    @Autowired private WalletService wallets;

    public record LoadRequest(BigDecimal amount) {}

    @GetMapping
    public List<OfflineWallet> list() {
        return wallets.all();
    }

    @GetMapping("/policy")
    public Map<String, Object> policy() {
        return Map.of(
                "maxAllowance", wallets.maxAllowance(),
                "perTxnLimit", wallets.defaultPerTxnLimit(),
                "walletRequired", wallets.walletRequired());
    }

    @GetMapping("/{vpa}")
    public ResponseEntity<?> get(@PathVariable String vpa) {
        Optional<OfflineWallet> wallet = wallets.find(vpa);
        if (wallet.isPresent()) return ResponseEntity.ok(wallet.get());
        return ResponseEntity.status(404).body(Map.of("message", "No offline wallet for " + vpa));
    }

    @PostMapping("/{vpa}/load")
    public ResponseEntity<?> load(@PathVariable String vpa, @RequestBody LoadRequest req) {
        try {
            return ResponseEntity.ok(wallets.load(vpa, req.amount()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/{vpa}/refund")
    public ResponseEntity<?> refund(@PathVariable String vpa) {
        try {
            return ResponseEntity.ok(wallets.refund(vpa));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/{vpa}/close")
    public ResponseEntity<?> close(@PathVariable String vpa) {
        try {
            wallets.close(vpa);
            return ResponseEntity.ok(Map.of("status", "closed"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
}