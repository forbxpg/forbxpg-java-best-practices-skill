package com.example.service;

import com.example.controller.CleanController;
import org.springframework.stereotype.Service;

// planted: a service depending on a controller
@Service
public class ControllerAwareService {
    public Class<?> controller() {
        return CleanController.class;
    }
}
