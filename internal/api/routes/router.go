package routes

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/sakkada/network-monitoring-system/internal/api/middleware"
	"github.com/sakkada/network-monitoring-system/internal/api/handlers"
	"github.com/sakkada/network-monitoring-system/internal/config"
	authsvc "github.com/sakkada/network-monitoring-system/internal/service/auth"
	devicesvc "github.com/sakkada/network-monitoring-system/internal/service/device"
	logssvc "github.com/sakkada/network-monitoring-system/internal/service/logs"
	monitoringsvc "github.com/sakkada/network-monitoring-system/internal/service/monitoring"
	"github.com/sakkada/network-monitoring-system/internal/simulator"
)

func Register(
	router *gin.Engine,
	cfg config.Config,
	authService *authsvc.Service,
	deviceService *devicesvc.Service,
	metricService *monitoringsvc.Service,
	logService *logssvc.Service,
	simulatorEngine *simulator.DeviceStateSimulator,
) {
	healthHandler := handlers.NewHealthHandler(cfg)
	authHandler := handlers.NewAuthHandler(authService)
	userHandler := handlers.NewUserHandler(authService)
	deviceHandler := handlers.NewDeviceHandler(deviceService)
	metricHandler := handlers.NewMetricHandler(metricService)
	logHandler := handlers.NewLogEntryHandler(logService)
	simulatorHandler := handlers.NewSimulatorHandler(simulatorEngine)

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
			v1.POST("/auth/login", authHandler.Login)

			protected := v1.Group("")
			protected.Use(middleware.Authenticate(authService))
			{
				protected.GET("/auth/me", authHandler.Me)
				protected.PUT("/auth/me/profile", authHandler.UpdateOwnProfile)
				protected.PUT("/auth/me/password", authHandler.UpdateOwnPassword)

				protected.GET("/devices", deviceHandler.List)
				protected.GET("/devices/:id", deviceHandler.GetByID)

				protected.GET("/metrics", metricHandler.List)
				protected.GET("/metrics/:id", metricHandler.GetByID)

				protected.GET("/simulator/settings", simulatorHandler.GetSettings)
			}

			adminOnly := v1.Group("")
			adminOnly.Use(middleware.Authenticate(authService), middleware.RequireAdmin())
			{
				adminOnly.GET("/users", userHandler.List)
				adminOnly.GET("/users/:username", userHandler.GetByUsername)
				adminOnly.POST("/users", userHandler.Create)
				adminOnly.PUT("/users/:username", userHandler.Update)
				adminOnly.PUT("/users/:username/password", userHandler.UpdatePassword)
				adminOnly.DELETE("/users/:username", userHandler.Delete)

				adminOnly.POST("/devices", deviceHandler.Create)
				adminOnly.PUT("/devices/:id", deviceHandler.Update)
				adminOnly.DELETE("/devices/:id", deviceHandler.Delete)

				adminOnly.POST("/metrics", metricHandler.Create)
				adminOnly.PUT("/metrics/:id", metricHandler.Update)
				adminOnly.DELETE("/metrics/:id", metricHandler.Delete)

				adminOnly.GET("/logs", logHandler.List)
				adminOnly.DELETE("/logs", logHandler.Clear)
				adminOnly.GET("/logs/:id", logHandler.GetByID)
				adminOnly.POST("/logs", logHandler.Create)
				adminOnly.PUT("/logs/:id", logHandler.Update)
				adminOnly.DELETE("/logs/:id", logHandler.Delete)

				adminOnly.PUT("/simulator/settings", simulatorHandler.UpdateSettings)
			}
		}
	}
}
