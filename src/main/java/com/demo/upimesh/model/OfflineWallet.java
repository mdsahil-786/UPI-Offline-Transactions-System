package com.demo.upimesh.model;

import jakarta.persistence.*;

import java.math.BigDecimal;

/**
 * A pre-funded offline wallet. The money in `escrow` has already been taken
 * out of the owner's account balance, so an offline payment that fits inside
 * it cannot bounce for lack of funds.
 */
@Entity
@Table(name = "offline_wallets")
public class OfflineWallet {

    @Id
    private String vpa;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal escrow; // funds still available to spend offline

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal perTxnLimit; // largest single offline payment

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal totalLoaded; // lifetime, for the UI

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal totalSpent; // lifetime, for the UI

    @Version // two concurrent payments from one wallet cannot both read the same escrow
    private Long version;

    public OfflineWallet() {}

    public OfflineWallet(String vpa, BigDecimal escrow, BigDecimal perTxnLimit,
                         BigDecimal totalLoaded, BigDecimal totalSpent) {
        this.vpa = vpa;
        this.escrow = escrow;
        this.perTxnLimit = perTxnLimit;
        this.totalLoaded = totalLoaded;
        this.totalSpent = totalSpent;
    }

    public String getVpa() { return vpa; }
    public void setVpa(String vpa) { this.vpa = vpa; }

    public BigDecimal getEscrow() { return escrow; }
    public void setEscrow(BigDecimal escrow) { this.escrow = escrow; }

    public BigDecimal getPerTxnLimit() { return perTxnLimit; }
    public void setPerTxnLimit(BigDecimal perTxnLimit) { this.perTxnLimit = perTxnLimit; }

    public BigDecimal getTotalLoaded() { return totalLoaded; }
    public void setTotalLoaded(BigDecimal totalLoaded) { this.totalLoaded = totalLoaded; }

    public BigDecimal getTotalSpent() { return totalSpent; }
    public void setTotalSpent(BigDecimal totalSpent) { this.totalSpent = totalSpent; }

    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }
}
