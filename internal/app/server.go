package app

import (
	"context"
	"log"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/sakkada/network-monitoring-system/internal/api/routes"
	"github.com/sakkada/network-monitoring-system/internal/config"
	"github.com/sakkada/network-monitoring-system/internal/domain/user"
	postgresrepo "github.com/sakkada/network-monitoring-system/internal/repository/postgres"
	"github.com/sakkada/network-monitoring-system/internal/seed"
	authsvc "github.com/sakkada/network-monitoring-system/internal/service/auth"
	devicesvc "github.com/sakkada/network-monitoring-system/internal/service/device"
	logssvc "github.com/sakkada/network-monitoring-system/internal/service/logs"
	monitoringsvc "github.com/sakkada/network-monitoring-system/internal/service/monitoring"
	"github.com/sakkada/network-monitoring-system/internal/simulator"
)

func NewServer(cfg config.Config) (*gin.Engine, func(), error) {
	router := gin.New()
	router.Use(
		gin.Logger(),
		gin.Recovery(),
		corsMiddleware(),
	)

	pool, err := postgresrepo.NewPool(context.Background(), cfg.DatabaseURL)
	if err != nil {
		return nil, nil, err
	}

	authService := authsvc.NewService(
		postgresrepo.NewUserRepository(pool),
		cfg.AuthSecret,
		time.Duration(cfg.AuthTokenTTLHours)*time.Hour,
	)
	deviceService := devicesvc.NewService(postgresrepo.NewDeviceRepository(pool))
	metricService := monitoringsvc.NewService(postgresrepo.NewMetricRepository(pool))
	logService := logssvc.NewService(postgresrepo.NewLogRepository(pool))
	simulatorCtx, cancelSimulator := context.WithCancel(context.Background())
	var simulatorEngine *simulator.DeviceStateSimulator

	if err := authService.EnsureDefaultUsers([]authsvc.SeedUser{
		{
			Username:          "admin",
			Password:          "admin123",
			Role:              user.RoleAdmin,
			DisplayName:       "admin",
			PreferredLanguage: user.LanguageRU,
			StartTab:          user.StartTabDashboard,
		},
		{
			Username:          "skd",
			Password:          "1234",
			Role:              user.RoleAdmin,
			DisplayName:       "skd",
			PreferredLanguage: user.LanguageRU,
			StartTab:          user.StartTabDashboard,
		},
		{
			Username:          "user",
			Password:          "user123",
			Role:              user.RoleUser,
			DisplayName:       "user",
			PreferredLanguage: user.LanguageRU,
			StartTab:          user.StartTabDashboard,
		},
	}); err != nil {
		return nil, nil, err
	}

	if cfg.SeedMockData {
		if err := seed.SeedMockData(deviceService, metricService, logService); err != nil {
			log.Printf("failed to seed mock data: %v", err)
		}
	}

	if cfg.SimulatorEnabled {
		simulatorEngine = simulator.NewDeviceStateSimulator(
			deviceService,
			metricService,
			logService,
			time.Duration(cfg.SimulatorIntervalSecond)*time.Second,
		)

		go simulatorEngine.Start(simulatorCtx)
		log.Printf("device simulator enabled with interval %ds", cfg.SimulatorIntervalSecond)
	}

	routes.Register(
		router,
		cfg,
		authService,
		deviceService,
		metricService,
		logService,
		simulatorEngine,
	)

	cleanup := func() {
		cancelSimulator()
		pool.Close()
	}

	return router, cleanup, nil
}

func corsMiddleware() gin.HandlerFunc {
	allowedOrigins := map[string]struct{}{
		"http://localhost:4173": {},
		"http://127.0.0.1:4173": {},
		"http://localhost:5173": {},
		"http://127.0.0.1:5173": {},
	}

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if _, ok := allowedOrigins[origin]; ok {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Vary", "Origin")
			c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization")
		}

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}
