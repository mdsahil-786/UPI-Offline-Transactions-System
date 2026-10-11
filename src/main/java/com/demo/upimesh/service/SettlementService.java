package com.demo.upimesh.service;

import com.demo.upimesh.model.Account;
import com.demo.upimesh.model.AccountRepository;
import com.demo.upimesh.model.OfflineWallet;
import com.demo.upimesh.model.OfflineWalletRepository;
import com.demo.upimesh.model.PaymentInstruction;
import com.demo.upimesh.model.Transaction;
import com.demo.upimesh.model.TransactionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Where the actual ledger update happens, inside one DB transaction.
 *
 * Two modes, chosen per sender:
 *   - sender HAS an offline wallet: the payment must fit the per-payment limit
 *     and the escrow. It is paid out of the escrow, so it cannot bounce for lack
 *     of funds. The sender's account balance is not touched (it was debited
 *     when the wallet was loaded).
 *   - sender has NO wallet: the original behaviour (debit the balance), unless
 *     the server is configured to require a wallet.
 *
 * The @Version columns give optimistic locking as a second line of defence
 * against two payments racing on the same row.
 */
@Service
public class SettlementService {

    private static final Logger log = LoggerFactory.getLogger(SettlementService.class);

    @Autowired private AccountRepository accounts;
    @Autowired private TransactionRepository transactions;
    @Autowired private OfflineWalletRepository wallets;
    @Autowired private WalletService walletService;

    @Transactional
    public Transaction settle(PaymentInstruction instruction, String packetHash,
                              String bridgeNodeId, int hopCount) {

        Account sender = accounts.findById(instruction.getSenderVpa())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Unknown sender VPA: " + instruction.getSenderVpa()));

        Account receiver = accounts.findById(instruction.getReceiverVpa())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Unknown receiver VPA: " + instruction.getReceiverVpa()));

        BigDecimal amount = instruction.getAmount();
        if (amount.signum() <= 0) {
            throw new IllegalArgumentException("Amount must be positive");
        }

        OfflineWallet wallet = wallets.findById(sender.getVpa()).orElse(null);

        if (wallet != null) {
            if (amount.compareTo(wallet.getPerTxnLimit()) > 0) {
                log.warn("Per-payment limit: {} tried ₹{}, limit is ₹{}",
                        sender.getVpa(), amount, wallet.getPerTxnLimit());
                return recordRejected(instruction, packetHash, bridgeNodeId, hopCount, "per_transaction_limit");
            }
            if (amount.compareTo(wallet.getEscrow()) > 0) {
                log.warn("Allowance exceeded: {} tried ₹{}, wallet holds ₹{}",
                        sender.getVpa(), amount, wallet.getEscrow());
                return recordRejected(instruction, packetHash, bridgeNodeId, hopCount, "allowance_exceeded");
            }
            wallet.setEscrow(wallet.getEscrow().subtract(amount));
            wallet.setTotalSpent(wallet.getTotalSpent().add(amount));
            wallets.save(wallet);
        } else {
            if (walletService.walletRequired()) {
                log.warn("{} has no offline wallet and this server requires one", sender.getVpa());
                return recordRejected(instruction, packetHash, bridgeNodeId, hopCount, "no_offline_wallet");
            }
            if (sender.getBalance().compareTo(amount) < 0) {
                log.warn("Insufficient balance: {} has ₹{}, tried to send ₹{}",
                        sender.getVpa(), sender.getBalance(), amount);
                return recordRejected(instruction, packetHash, bridgeNodeId, hopCount, "insufficient_balance");
            }
            sender.setBalance(sender.getBalance().subtract(amount));
            accounts.save(sender);
        }

        receiver.setBalance(receiver.getBalance().add(amount));
        accounts.save(receiver);

        Transaction tx = new Transaction();
        tx.setPacketHash(packetHash);
        tx.setSenderVpa(instruction.getSenderVpa());
        tx.setReceiverVpa(instruction.getReceiverVpa());
        tx.setAmount(amount);
        tx.setSignedAt(Instant.ofEpochMilli(instruction.getSignedAt()));
        tx.setSettledAt(Instant.now());
        tx.setBridgeNodeId(bridgeNodeId);
        tx.setHopCount(hopCount);
        tx.setStatus(Transaction.Status.SETTLED);
        transactions.save(tx);

        log.info("SETTLED ₹{} from {} to {} (packetHash={}, bridge={}, hops={}, via {})",
                amount, sender.getVpa(), receiver.getVpa(),
                packetHash.substring(0, 12) + "...", bridgeNodeId, hopCount,
                wallet != null ? "offline wallet" : "balance");

        return tx;
    }

    private Transaction recordRejected(PaymentInstruction instruction, String packetHash,
                                       String bridgeNodeId, int hopCount, String reason) {
        Transaction tx = new Transaction();
        tx.setPacketHash(packetHash);
        tx.setSenderVpa(instruction.getSenderVpa());
        tx.setReceiverVpa(instruction.getReceiverVpa());
        tx.setAmount(instruction.getAmount());
        tx.setSignedAt(Instant.ofEpochMilli(instruction.getSignedAt()));
        tx.setSettledAt(Instant.now());
        tx.setBridgeNodeId(bridgeNodeId);
        tx.setHopCount(hopCount);
        tx.setStatus(Transaction.Status.REJECTED);
        tx.setRejectReason(reason);
        return transactions.save(tx);
    }
}