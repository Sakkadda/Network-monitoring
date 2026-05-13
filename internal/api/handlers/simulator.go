package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/sakkada/network-monitoring-system/internal/simulator"
)

type SimulatorHandler struct {
	engine *simulator.DeviceStateSimulator
}

type updateSimulatorSettingsRequest struct {
	IntervalSeconds int `json:"intervalSeconds" binding:"required,min=5,max=3600"`
}

func NewSimulatorHandler(engine *simulator.DeviceStateSimulator) SimulatorHandler {
	return SimulatorHandler{engine: engine}
}

func (h SimulatorHandler) GetSettings(c *gin.Context) {
	if h.engine == nil {
		c.JSON(http.StatusOK, gin.H{
			"data": gin.H{
				"enabled":         false,
				"intervalSeconds": 0,
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"enabled":         true,
			"intervalSeconds": h.engine.IntervalSeconds(),
		},
	})
}

func (h SimulatorHandler) UpdateSettings(c *gin.Context) {
	if h.engine == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "simulator is disabled"})
		return
	}

	var input updateSimulatorSettingsRequest
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.engine.SetIntervalSeconds(input.IntervalSeconds); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"enabled":         true,
			"intervalSeconds": h.engine.IntervalSeconds(),
		},
	})
}
