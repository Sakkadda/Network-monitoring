package metric

import "time"

type Type string

const (
	TypePingLatency Type = "ping_latency"
	TypePacketLoss  Type = "packet_loss"
	TypeCPUUsage    Type = "cpu_usage"
	TypeMemoryUsage Type = "memory_usage"
	TypeUptime      Type = "uptime"
)

type Status string

const (
	StatusNormal   Status = "normal"
	StatusWarning  Status = "warning"
	StatusCritical Status = "critical"
)

type Source string

const (
	SourceManual    Source = "manual"
	SourceSimulated Source = "simulated"
	SourceCollected Source = "collected"
)

type Metric struct {
	ID          int64     `json:"id" db:"id"`
	DeviceID    int64     `json:"deviceId" db:"device_id"`
	MetricType  Type      `json:"metricType" db:"metric_type"`
	Value       float64   `json:"value" db:"value"`
	Unit        string    `json:"unit" db:"unit"`
	Status      Status    `json:"status" db:"status"`
	DataSource  Source    `json:"dataSource" db:"data_source"`
	CollectedAt time.Time `json:"collectedAt" db:"collected_at"`
	CreatedAt   time.Time `json:"createdAt" db:"created_at"`
}
