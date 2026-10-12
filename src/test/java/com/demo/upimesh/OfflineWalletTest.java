package com.demo.upimesh;

import com.demo.upimesh.model.AccountRepository;
import com.demo.upimesh.model.MeshPacket;
import com.demo.upimesh.model.OfflineWallet;
import com.demo.upimesh.model.OfflineWalletRepository;
import com.demo.upimesh.service.BridgeIngestionService;
import com.demo.upimesh.service.BridgeIngestionService.IngestResult;
import com.demo.upimesh.service.DemoService;
import com.demo.upimesh.service.WalletService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class OfflineWalletTest {

    private static final String SENDER = "carol@demo";
    private static final String RECEIVER = "dave@demo";

    @Autowired private DemoService demo;
    @Autowired private BridgeIngestionService bridge;
    @Autowired private WalletService walletService;
    @Autowired private AccountRepository accounts;
    @Autowired private OfflineWalletRepository wallets;

    @BeforeEach
    void startWithoutWallet() {
        if (wallets.existsById(SENDER)) {
            walletService.refund(SENDER); // put any escrow back, then drop the wallet row
            wallets.deleteById(SENDER);
        }
    }

    private IngestResult pay(String amount) throws Exception {
        MeshPacket p = demo.createPacket(SENDER, RECEIVER, new BigDecimal(amount), "1234", 5);
        return bridge.ingest(p, "test-bridge", 1);
    }

    private BigDecimal balance(String vpa) {
        return accounts.findById(vpa).orElseThrow().getBalance();
    }

    private BigDecimal escrow() {
        return wallets.findById(SENDER).map(OfflineWallet::getEscrow).orElseThrow();
    }

    @Test
    void loadMovesMoneyFromBalanceIntoEscrow() {
        BigDecimal before = balance(SENDER);
        walletService.load(SENDER, new BigDecimal("300"));

        assertEquals(0, before.subtract(new BigDecimal("300")).compareTo(balance(SENDER)));
        assertEquals(0, new BigDecimal("300").compareTo(escrow()));
    }

    @Test
    void paymentWithinAllowanceIsPaidFromEscrowNotBalance() throws Exception {
        walletService.load(SENDER, new BigDecimal("300"));
        BigDecimal senderAfterLoad = balance(SENDER);
        BigDecimal receiverBefore = balance(RECEIVER);

        IngestResult r = pay("100");

        assertEquals("SETTLED", r.outcome());
        assertEquals(0, senderAfterLoad.compareTo(balance(SENDER)), "balance must not change");
        assertEquals(0, receiverBefore.add(new BigDecimal("100")).compareTo(balance(RECEIVER)));
        assertEquals(0, new BigDecimal("200").compareTo(escrow()));
    }

    @Test
    void paymentAbovePerTransactionLimitIsRejected() throws Exception {
        walletService.load(SENDER, new BigDecimal("1000"));
        BigDecimal receiverBefore = balance(RECEIVER);

        IngestResult r = pay("600"); // default limit is 500

        assertEquals("REJECTED", r.outcome());
        assertEquals("per_transaction_limit", r.reason());
        assertEquals(0, new BigDecimal("1000").compareTo(escrow()), "escrow untouched");
        assertEquals(0, receiverBefore.compareTo(balance(RECEIVER)));
    }

    @Test
    void secondPaymentBeyondRemainingAllowanceIsRejected() throws Exception {
        walletService.load(SENDER, new BigDecimal("200"));

        assertEquals("SETTLED", pay("150").outcome());
        IngestResult second = pay("100");

        assertEquals("REJECTED", second.outcome());
        assertEquals("allowance_exceeded", second.reason());
        assertEquals(0, new BigDecimal("50").compareTo(escrow()));
    }

    @Test
    void loadingBeyondTheCapIsRefused() {
        assertThrows(IllegalArgumentException.class,
                () -> walletService.load(SENDER, new BigDecimal("2500"))); // cap is 2000
    }

    @Test
    void senderWithoutAWalletStillPaysFromBalance() throws Exception {
        BigDecimal before = balance(SENDER);

        IngestResult r = pay("10");

        assertEquals("SETTLED", r.outcome());
        assertEquals(0, before.subtract(new BigDecimal("10")).compareTo(balance(SENDER)));
    }

    @Test
    void closingReturnsEscrowAndRemovesTheWallet() {
        BigDecimal before = balance(SENDER);
        walletService.load(SENDER, new BigDecimal("300"));

        walletService.close(SENDER);

        assertEquals(0, before.compareTo(balance(SENDER)));
        assertFalse(wallets.existsById(SENDER));
    }
}