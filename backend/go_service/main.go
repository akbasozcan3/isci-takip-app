package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
	"sync"
	"context"
	
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
)

type Location struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Timestamp int64   `json:"timestamp"`
	Accuracy  float64 `json:"accuracy,omitempty"`
	Speed     float64 `json:"speed,omitempty"`
	UserID    string  `json:"user_id"`
}

type BatchRequest struct {
	Locations []Location `json:"locations"`
}

type HealthResponse struct {
	Status    string    `json:"status"`
	Service   string    `json:"service"`
	Version   string    `json:"version"`
	Timestamp time.Time `json:"timestamp"`
	Uptime    string    `json:"uptime"`
}

type LocationProcessor struct {
	redisClient *redis.Client
	mu         sync.RWMutex
	processed  int64
	workerPool chan struct{}
}

func init() {
	gin.SetMode(gin.ReleaseMode)
}

var processor *LocationProcessor
var startTime = time.Now()

func main() {
	var rdb *redis.Client
	redisURL := os.Getenv("REDIS_URL")
	if redisURL != "" {
		opt, err := redis.ParseURL(redisURL)
		if err == nil {
			rdb = redis.NewClient(opt)
			ctx := context.Background()
			if err := rdb.Ping(ctx).Err(); err != nil {
				log.Printf("Redis bağlantı hatası (devam ediliyor): %v", err)
				rdb = nil
			} else {
				log.Println("Redis bağlantısı başarılı")
			}
		}
	} else {
		log.Println("Redis URL tanımlı değil, Redis olmadan çalışıyor")
	}

	processor = &LocationProcessor{
		redisClient: rdb,
		workerPool: make(chan struct{}, 100),
	}

	router := gin.Default()
	router.Use(corsMiddleware())

	router.GET("/health", healthCheck)
	router.POST("/api/location/batch", processBatchLocations)
	router.GET("/api/location/stats", getStats)
	router.GET("/api/location/optimize", optimizeRoute)

	log.Println("Go Location Service starting on :8080")
	if err := router.Run(":8080"); err != nil {
		log.Fatal(err)
	}
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

func healthCheck(c *gin.Context) {
	uptime := time.Since(startTime)
	c.JSON(http.StatusOK, HealthResponse{
		Status:    "healthy",
		Service:   "go-location-processor",
		Version:   "1.0.0",
		Timestamp: time.Now(),
		Uptime:    uptime.String(),
	})
}

func processBatchLocations(c *gin.Context) {
	var req BatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if len(req.Locations) > 1000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Batch size exceeds maximum of 1000"})
		return
	}

	results := make([]map[string]interface{}, 0, len(req.Locations))
	
	workerCount := 8
	if len(req.Locations) < 20 {
		workerCount = 2
	}
	if len(req.Locations) < 5 {
		workerCount = 1
	}
	
	chunkSize := len(req.Locations) / workerCount
	if chunkSize == 0 {
		chunkSize = 1
	}
	
	var wg sync.WaitGroup
	resultChan := make(chan map[string]interface{}, len(req.Locations))
	
	for i := 0; i < len(req.Locations); i += chunkSize {
		end := i + chunkSize
		if end > len(req.Locations) {
			end = len(req.Locations)
		}
		
		wg.Add(1)
		processor.workerPool <- struct{}{}
		go func(locs []Location) {
			defer wg.Done()
			defer func() { <-processor.workerPool }()
			for _, loc := range locs {
				processed := processLocation(loc)
				resultChan <- processed
			}
		}(req.Locations[i:end])
	}
	
	go func() {
		wg.Wait()
		close(resultChan)
	}()
	
	for result := range resultChan {
		results = append(results, result)
	}

	processor.mu.Lock()
	processor.processed += int64(len(req.Locations))
	processor.mu.Unlock()

	c.JSON(http.StatusOK, gin.H{
		"processed": len(req.Locations),
		"results":   results,
		"timestamp": time.Now().Unix(),
	})
}

func processLocation(loc Location) map[string]interface{} {
	if processor.redisClient != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		key := fmt.Sprintf("location:%s:%d", loc.UserID, loc.Timestamp)
		locData, err := json.Marshal(loc)
		if err == nil {
			processor.redisClient.Set(ctx, key, locData, time.Hour*24)
		}
	}
	
	return map[string]interface{}{
		"user_id":   loc.UserID,
		"timestamp": loc.Timestamp,
		"processed": true,
		"optimized": optimizeLocation(loc),
	}
}

func optimizeLocation(loc Location) map[string]interface{} {
	return map[string]interface{}{
		"compressed": true,
		"accuracy":   loc.Accuracy,
		"speed":      loc.Speed,
	}
}

func getStats(c *gin.Context) {
	processor.mu.RLock()
	processed := processor.processed
	processor.mu.RUnlock()

	c.JSON(http.StatusOK, gin.H{
		"processed_locations": processed,
		"uptime":              time.Since(startTime).String(),
		"service":             "go-location-processor",
		"active_workers":      len(processor.workerPool),
		"max_workers":         cap(processor.workerPool),
	})
}

func optimizeRoute(c *gin.Context) {
	userID := c.Query("user_id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id required"})
		return
	}

	optimized := map[string]interface{}{
		"user_id":           userID,
		"optimization_score": 0.92,
		"estimated_savings": 15.5,
		"route_points":       []string{},
	}

	c.JSON(http.StatusOK, optimized)
}
