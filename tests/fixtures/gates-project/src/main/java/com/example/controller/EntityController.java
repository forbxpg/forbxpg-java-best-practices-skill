package com.example.controller;

import com.example.entity.Customer;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

// planted: an entity in a controller signature
@RestController
public class EntityController {
    @GetMapping("/customer")
    public Customer customer() {
        return null;
    }
}
