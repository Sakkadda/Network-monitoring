package device

import "time"

type Status string

const (
	StatusOnline  Status = "online"
	StatusWarning Status = "warning"
	StatusOffline Status = "offline"
	StatusUnknown Status = "unknown"
)

type Source string

const (
	SourceManual    Source = "manual"
	SourceSimulated Source = "simulated"
	SourceAgent     Source = "agent"
)

type Device struct {
	ID            int64     `json:"id" db:"id"`
	Name          string    `json:"name" db:"name"`
	IPAddress     string    `json:"ipAddress" db:"ip_address"`
	DeviceType    string    `json:"deviceType" db:"device_type"`
	Vendor        string    `json:"vendor" db:"vendor"`
	Model         string    `json:"model" db:"model"`
	Location      string    `json:"location" db:"location"`
	Description   string    `json:"description" db:"description"`
	Status        Status    `json:"status" db:"status"`
	DataSource    Source    `json:"dataSource" db:"data_source"`
	IsActive      bool      `json:"isActive" db:"is_active"`
	LastCheckedAt time.Time `json:"lastCheckedAt" db:"last_checked_at"`
	CreatedAt     time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt     time.Time `json:"updatedAt" db:"updated_at"`
}
