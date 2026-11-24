package com.example.service;

import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

@Service
public class ResponseService {
    // planted: HTTP type in a service
    public ResponseEntity<String> answer() {
        return ResponseEntity.ok("x");
    }
}
