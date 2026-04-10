package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/sakkada/network-monitoring-system/internal/config"
)

type HealthHandler struct {
	config config.Config
}

func NewHealthHandler(cfg config.Config) HealthHandler {
	return HealthHandler{config: cfg}
}

func (h HealthHandler) GetHealth(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "ok",
		"service":   "network-monitoring-system",
		"env":       h.config.AppEnv,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}
