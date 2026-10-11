package com.demo.upimesh.service;

import com.demo.upimesh.model.Account;
import com.demo.upimesh.model.AccountRepository;
import com.demo.upimesh.model.OfflineWallet;
import com.demo.upimesh.model.OfflineWalletRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

/**
 * Loading and refunding the offline wallet, and the policy numbers.
 *
 * DEMO LIMITATION: load and refund are unauthenticated. A real system would
 * require the account holder's PIN or an OTP before moving money.
 */
@Service
public class WalletService {

    @Autowired private AccountRepository accounts;
    @Autowired private OfflineWalletRepository wallets;

    @Value("${upi.mesh.offline.max-allowance:2000}")
    private BigDecimal maxAllowance;

    @Value("${upi.mesh.offline.per-txn-limit:500}")
    private BigDecimal defaultPerTxnLimit;

    @Value("${upi.mesh.offline.require-wallet:false}")
    private boolean walletRequired;

    public BigDecimal maxAllowance() { return maxAllowance; }
    public BigDecimal defaultPerTxnLimit() { return defaultPerTxnLimit; }
    public boolean walletRequired() { return walletRequired; }

    public Optional<OfflineWallet> find(String vpa) {
        return wallets.findById(vpa);
    }

    public List<OfflineWallet> all() {
        return wallets.findAll();
    }

    /** Move `amount` from the account balance into the wallet's escrow. */
    @Transactional
    public OfflineWallet load(String vpa, BigDecimal amount) {
        if (amount == null || amount.signum() <= 0) {
            throw new IllegalArgumentException("Amount must be positive");
        }
        Account account = accounts.findById(vpa)
                .orElseThrow(() -> new IllegalArgumentException("Unknown VPA: " + vpa));
        OfflineWallet wallet = wallets.findById(vpa).orElseGet(() ->
                new OfflineWallet(vpa, BigDecimal.ZERO, defaultPerTxnLimit, BigDecimal.ZERO, BigDecimal.ZERO));

        BigDecimal newEscrow = wallet.getEscrow().add(amount);
        if (newEscrow.compareTo(maxAllowance) > 0) {
            throw new IllegalArgumentException(
                    "The offline wallet is capped at ₹" + maxAllowance + " (it would hold ₹" + newEscrow + ")");
        }
        if (account.getBalance().compareTo(amount) < 0) {
            throw new IllegalArgumentException("Insufficient balance: " + vpa + " has ₹" + account.getBalance());
        }

        account.setBalance(account.getBalance().subtract(amount));
        wallet.setEscrow(newEscrow);
        wallet.setTotalLoaded(wallet.getTotalLoaded().add(amount));
        accounts.save(account);
        return wallets.save(wallet);
    }

    /** Return all unspent escrow to the account balance. */
    @Transactional
    public OfflineWallet refund(String vpa) {
        OfflineWallet wallet = wallets.findById(vpa)
                .orElseThrow(() -> new IllegalArgumentException("No offline wallet for " + vpa));
        Account account = accounts.findById(vpa)
                .orElseThrow(() -> new IllegalArgumentException("Unknown VPA: " + vpa));

        account.setBalance(account.getBalance().add(wallet.getEscrow()));
        wallet.setEscrow(BigDecimal.ZERO);
        accounts.save(account);
        return wallets.save(wallet);
    }
}