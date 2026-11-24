package com.example.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PrivateTransactionService {
    public void run() {
        save();
    }

    // planted W4
    @Transactional
    private void save() {
    }
}
