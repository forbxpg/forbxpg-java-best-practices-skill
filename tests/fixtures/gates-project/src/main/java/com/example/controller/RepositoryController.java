package com.example.controller;

import com.example.repository.OrderRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

// planted W9
@RestController
public class RepositoryController {
    private final OrderRepository orders;

    public RepositoryController(OrderRepository orders) {
        this.orders = orders;
    }

    @GetMapping("/raw-count")
    public long count() {
        return orders.count();
    }
}
