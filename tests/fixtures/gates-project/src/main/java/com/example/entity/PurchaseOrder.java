package com.example.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;

@Entity
public class PurchaseOrder {
    @Id
    private Long id;

    // planted W2: EAGER by default
    @ManyToOne
    private Customer customer;

    @ManyToOne(fetch = FetchType.LAZY)
    private Customer reviewer;

    // planted W3: stored by position
    @Enumerated
    private OrderStatus status;

    @Enumerated(EnumType.STRING)
    private OrderStatus previousStatus;

    public Long getId() {
        return id;
    }
}
