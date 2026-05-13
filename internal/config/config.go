package config

import "fmt"

type Config struct {
	AppEnv                  string
	Host                    string
	Port                    string
	LogLevel                string
	DatabaseURL             string
	AuthSecret              string
	AuthTokenTTLHours       int
	SeedMockData            bool
	SimulatorEnabled        bool
	SimulatorIntervalSecond int
}

func Load() Config {
	return Config{
		AppEnv:                  envOrDefault("APP_ENV", "development"),
		Host:                    envOrDefault("APP_HOST", "0.0.0.0"),
		Port:                    envOrDefault("APP_PORT", "8080"),
		LogLevel:                envOrDefault("APP_LOG_LEVEL", "info"),
		DatabaseURL:             envOrDefault("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/network_monitoring?sslmode=disable"),
		AuthSecret:              envOrDefault("APP_AUTH_SECRET", "network-monitoring-dev-secret"),
		AuthTokenTTLHours:       envOrDefaultInt("APP_AUTH_TOKEN_TTL_HOURS", 24),
		SeedMockData:            envOrDefaultBool("APP_SEED_MOCK_DATA", true),
		SimulatorEnabled:        envOrDefaultBool("APP_SIMULATOR_ENABLED", true),
		SimulatorIntervalSecond: envOrDefaultInt("APP_SIMULATOR_INTERVAL_SECONDS", 20),
	}
}

func (c Config) Address() string {
	return fmt.Sprintf("%s:%s", c.Host, c.Port)
}
