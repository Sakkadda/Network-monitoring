package main

import (
	"log"

	"github.com/sakkada/network-monitoring-system/internal/app"
	"github.com/sakkada/network-monitoring-system/internal/config"
)

func main() {
	cfg := config.Load()

	server, cleanup, err := app.NewServer(cfg)
	if err != nil {
		log.Fatalf("failed to create server: %v", err)
	}
	defer cleanup()

	log.Printf("starting API server on %s", cfg.Address())

	if err := server.Run(cfg.Address()); err != nil {
		log.Fatalf("server stopped: %v", err)
	}
}
