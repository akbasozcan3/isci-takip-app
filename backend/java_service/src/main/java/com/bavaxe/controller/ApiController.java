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

    private static class CacheEntry {
        Map<String, Object> data;
        long timestamp;
        
        CacheEntry(Map<String, Object> data) {
            this.data = data;
            this.timestamp = System.currentTimeMillis();
        }
        
        boolean isExpired() {
            return System.currentTimeMillis() - timestamp > CACHE_TTL_MS;
        }
    }

    private static final long CACHE_TTL_MS = 300000;
    private static final int MAX_CACHE_SIZE = 200;

    @Value("${nodejs.service.url:http://localhost:4000}")
    private String nodejsServiceUrl;

    private final RestTemplate restTemplate;

    private final Map<String, CacheEntry> cache = new java.util.concurrent.ConcurrentHashMap<>();

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
        String cacheKey = "billing:" + user_id;
        CacheEntry cached = cache.get(cacheKey);
        
        if (cached != null && !cached.isExpired()) {
            return ResponseEntity.ok(cached.data);
        }
        
        try {
            String url = nodejsServiceUrl + "/api/billing/history?user_id=" + user_id;
            @SuppressWarnings("unchecked")
            ResponseEntity<Map<String, Object>> response = (ResponseEntity<Map<String, Object>>) (ResponseEntity<?>) restTemplate.getForEntity(url, Map.class);
            
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> body = (Map<String, Object>) response.getBody();
                Map<String, Object> result = new HashMap<>();
                result.put("user_id", user_id);
                result.put("transactions", body.get("transactions"));
                result.put("total_amount", calculateTotal(body));
                result.put("timestamp", Instant.now().toString());
                
                cache.put(cacheKey, new CacheEntry(result));
                if (cache.size() > MAX_CACHE_SIZE) {
                    cache.entrySet().removeIf(e -> e.getValue().isExpired());
                    if (cache.size() > MAX_CACHE_SIZE) {
                        cache.entrySet().stream()
                            .sorted((a, b) -> Long.compare(a.getValue().timestamp, b.getValue().timestamp))
                            .limit(cache.size() - MAX_CACHE_SIZE + 20)
                            .forEach(e -> cache.remove(e.getKey()));
                    }
                }
                
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

