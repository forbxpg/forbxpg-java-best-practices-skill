package com.example.repository;

import com.example.entity.Customer;
import com.example.service.CleanService;
import org.springframework.data.jpa.repository.JpaRepository;

// planted: a repository depending on a service
public interface ServiceAwareRepository extends JpaRepository<Customer, Long> {
    default String describe(CleanService service) {
        return service.name();
    }
}
