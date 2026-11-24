package com.example.service;

import com.example.repository.OrderRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class FieldInjectionService {
    // planted J1
    @Autowired
    private OrderRepository orders;
}
