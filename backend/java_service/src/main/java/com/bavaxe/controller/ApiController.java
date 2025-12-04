package com.bavaxe.controller;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

@RestController
@RequestMapping("/api")
public class ApiController {

    @Value("${nodejs.service.url:http://localhost:4000}")
    private String nodejsServiceUrl;

    private final RestTemplate restTemplate;

    public ApiController(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> response = new HashMap<>();
        response.put("status", "healthy");
        response.put("service", "java-spring-service");
        response.put("version", "1.0.0");
        response.put("timestamp", Instant.now().toString());
        response.put("uptime", "running");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/billing/process")
    public ResponseEntity<Map<String, Object>> processBilling(@RequestBody Map<String, Object> request) {
        String userId = (String) request.get("user_id");
        String plan = (String) request.get("plan");
        Double amount = request.get("amount") instanceof Number 
            ? ((Number) request.get("amount")).doubleValue() 
            : null;

        if (userId == null || plan == null || amount == null) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "user_id, plan, and amount required");
            return ResponseEntity.badRequest().body(error);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("user_id", userId);
        result.put("plan", plan);
        result.put("amount", amount);
        result.put("status", "processed");
        result.put("transaction_id", UUID.randomUUID().toString());
        result.put("processed_at", Instant.now().toString());

        return ResponseEntity.ok(result);
    }

    @GetMapping("/billing/history")
    public ResponseEntity<Map<String, Object>> getBillingHistory(@RequestParam String user_id) {
        try {
            String url = nodejsServiceUrl + "/api/billing/history?user_id=" + user_id;
            ResponseEntity<Map> response = restTemplate.getForEntity(url, Map.class);
            
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> result = new HashMap<>();
                result.put("user_id", user_id);
                result.put("transactions", response.getBody().get("transactions"));
                result.put("total_amount", calculateTotal(response.getBody()));
                result.put("timestamp", Instant.now().toString());
                return ResponseEntity.ok(result);
            }
        } catch (Exception e) {
        }

        Map<String, Object> result = new HashMap<>();
        result.put("user_id", user_id);
        result.put("transactions", new ArrayList<>());
        result.put("total_amount", 0.0);
        result.put("timestamp", Instant.now().toString());
        return ResponseEntity.ok(result);
    }

    @PostMapping("/billing/validate")
    public ResponseEntity<Map<String, Object>> validatePayment(@RequestBody Map<String, Object> request) {
        String paymentMethod = (String) request.get("payment_method");
        String cardNumber = (String) request.get("card_number");

        Map<String, Object> result = new HashMap<>();
        result.put("valid", paymentMethod != null && !paymentMethod.isEmpty());
        result.put("payment_method", paymentMethod);
        result.put("validation_score", 0.95);
        result.put("timestamp", Instant.now().toString());

        return ResponseEntity.ok(result);
    }

    private Double calculateTotal(Map<String, Object> data) {
        if (data == null || !data.containsKey("transactions")) {
            return 0.0;
        }
        
        Object transactionsObj = data.get("transactions");
        if (transactionsObj instanceof List) {
            List<?> transactions = (List<?>) transactionsObj;
            return transactions.stream()
                .filter(t -> t instanceof Map)
                .map(t -> (Map<?, ?>) t)
                .filter(t -> t.containsKey("amount"))
                .mapToDouble(t -> {
                    Object amount = t.get("amount");
                    if (amount instanceof Number) {
                        return ((Number) amount).doubleValue();
                    }
                    return 0.0;
                })
                .sum();
        }
        return 0.0;
    }
}

