package com.example.service;

import com.example.repository.OrderRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CleanService {
    private final OrderRepository orders;

    public CleanService(OrderRepository orders) {
        this.orders = orders;
    }

    @Transactional(readOnly = true)
    public long count() {
        return orders.count();
    }

    public String name() {
        return "clean";
    }
}
