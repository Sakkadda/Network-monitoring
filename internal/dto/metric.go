package dto

import (
	"time"

	"github.com/sakkada/network-monitoring-system/internal/domain/metric"
)

type CreateMetricRequest struct {
	DeviceID    int64         `json:"deviceId" binding:"required,gt=0"`
	MetricType  metric.Type   `json:"metricType" binding:"required,oneof=ping_latency packet_loss cpu_usage memory_usage uptime"`
	Value       float64       `json:"value" binding:"required"`
	Unit        string        `json:"unit" binding:"required,max=20"`
	Status      metric.Status `json:"status" binding:"omitempty,oneof=normal warning critical"`
	DataSource  metric.Source `json:"dataSource" binding:"omitempty,oneof=manual simulated collected"`
	CollectedAt *time.Time    `json:"collectedAt"`
}

type UpdateMetricRequest struct {
	DeviceID    int64         `json:"deviceId" binding:"required,gt=0"`
	MetricType  metric.Type   `json:"metricType" binding:"required,oneof=ping_latency packet_loss cpu_usage memory_usage uptime"`
	Value       float64       `json:"value" binding:"required"`
	Unit        string        `json:"unit" binding:"required,max=20"`
	Status      metric.Status `json:"status" binding:"required,oneof=normal warning critical"`
	DataSource  metric.Source `json:"dataSource" binding:"required,oneof=manual simulated collected"`
	CollectedAt time.Time     `json:"collectedAt" binding:"required"`
}
