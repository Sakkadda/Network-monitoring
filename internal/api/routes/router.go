package routes

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/sakkada/network-monitoring-system/internal/api/handlers"
	"github.com/sakkada/network-monitoring-system/internal/config"
	devicesvc "github.com/sakkada/network-monitoring-system/internal/service/device"
	logssvc "github.com/sakkada/network-monitoring-system/internal/service/logs"
	monitoringsvc "github.com/sakkada/network-monitoring-system/internal/service/monitoring"
)

func Register(
	router *gin.Engine,
	cfg config.Config,
	deviceService *devicesvc.Service,
	metricService *monitoringsvc.Service,
	logService *logssvc.Service,
) {
	healthHandler := handlers.NewHealthHandler(cfg)
	deviceHandler := handlers.NewDeviceHandler(deviceService)
	metricHandler := handlers.NewMetricHandler(metricService)
	logHandler := handlers.NewLogEntryHandler(logService)

	router.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "network monitoring system API",
			"version": "v1",
		})
	})

	api := router.Group("/api")
	{
		v1 := api.Group("/v1")
		{
			v1.GET("/health", healthHandler.GetHealth)
			v1.GET("/devices", deviceHandler.List)
			v1.GET("/devices/:id", deviceHandler.GetByID)
			v1.POST("/devices", deviceHandler.Create)
			v1.PUT("/devices/:id", deviceHandler.Update)
			v1.DELETE("/devices/:id", deviceHandler.Delete)

			v1.GET("/metrics", metricHandler.List)
			v1.GET("/metrics/:id", metricHandler.GetByID)
			v1.POST("/metrics", metricHandler.Create)
			v1.PUT("/metrics/:id", metricHandler.Update)
			v1.DELETE("/metrics/:id", metricHandler.Delete)

			v1.GET("/logs", logHandler.List)
			v1.GET("/logs/:id", logHandler.GetByID)
			v1.POST("/logs", logHandler.Create)
			v1.PUT("/logs/:id", logHandler.Update)
			v1.DELETE("/logs/:id", logHandler.Delete)
		}
	}
}
