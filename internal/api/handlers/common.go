package handlers

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	devicesvc "github.com/sakkada/network-monitoring-system/internal/service/device"
	logssvc "github.com/sakkada/network-monitoring-system/internal/service/logs"
	monitoringsvc "github.com/sakkada/network-monitoring-system/internal/service/monitoring"
)

func parseIDParam(c *gin.Context) (int64, bool) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return 0, false
	}

	return id, true
}

func handleServiceError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, devicesvc.ErrDeviceNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	case errors.Is(err, logssvc.ErrLogEntryNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	case errors.Is(err, monitoringsvc.ErrMetricNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
	}
}
