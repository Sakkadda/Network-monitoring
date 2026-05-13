package dto

import (
	"time"

	"github.com/sakkada/network-monitoring-system/internal/domain/device"
)

type CreateDeviceRequest struct {
	Name          string        `json:"name" binding:"required,min=2,max=120"`
	IPAddress     string        `json:"ipAddress" binding:"required,ip"`
	DeviceType    string        `json:"deviceType" binding:"required,min=2,max=50"`
	Vendor        string        `json:"vendor" binding:"max=80"`
	Model         string        `json:"model" binding:"max=80"`
	Location      string        `json:"location" binding:"max=150"`
	Description   string        `json:"description"`
	Status        device.Status `json:"status" binding:"omitempty,oneof=online warning offline unknown"`
	DataSource    device.Source `json:"dataSource" binding:"omitempty,oneof=manual simulated agent"`
	IsActive      *bool         `json:"isActive"`
	LastCheckedAt *time.Time    `json:"lastCheckedAt"`
}

type UpdateDeviceRequest struct {
	Name          string        `json:"name" binding:"required,min=2,max=120"`
	IPAddress     string        `json:"ipAddress" binding:"required,ip"`
	DeviceType    string        `json:"deviceType" binding:"required,min=2,max=50"`
	Vendor        string        `json:"vendor" binding:"max=80"`
	Model         string        `json:"model" binding:"max=80"`
	Location      string        `json:"location" binding:"max=150"`
	Description   string        `json:"description"`
	Status        device.Status `json:"status" binding:"omitempty,oneof=online warning offline unknown"`
	DataSource    device.Source `json:"dataSource" binding:"omitempty,oneof=manual simulated agent"`
	IsActive      *bool         `json:"isActive"`
	LastCheckedAt *time.Time    `json:"lastCheckedAt"`
}
