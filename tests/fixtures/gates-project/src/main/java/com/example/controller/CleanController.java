package com.example.controller;

import com.example.service.CleanService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CleanController {
    private final CleanService service;

    public CleanController(CleanService service) {
        this.service = service;
    }

    @GetMapping("/count")
    public long count() {
        return service.count();
    }
}
