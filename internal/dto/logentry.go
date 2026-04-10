package dto

import "github.com/sakkada/network-monitoring-system/internal/domain/logentry"

type CreateLogEntryRequest struct {
	DeviceID  *int64             `json:"deviceId"`
	Level     logentry.Level     `json:"level" binding:"omitempty,oneof=info warning error audit"`
	Action    string             `json:"action" binding:"required,min=2,max=100"`
	Message   string             `json:"message" binding:"required,min=2"`
	ActorRole logentry.ActorRole `json:"actorRole" binding:"omitempty,oneof=system admin"`
	ActorName string             `json:"actorName" binding:"max=120"`
	Source    string             `json:"source" binding:"max=50"`
	Metadata  map[string]any     `json:"metadata"`
}

type UpdateLogEntryRequest struct {
	DeviceID  *int64             `json:"deviceId"`
	Level     logentry.Level     `json:"level" binding:"required,oneof=info warning error audit"`
	Action    string             `json:"action" binding:"required,min=2,max=100"`
	Message   string             `json:"message" binding:"required,min=2"`
	ActorRole logentry.ActorRole `json:"actorRole" binding:"required,oneof=system admin"`
	ActorName string             `json:"actorName" binding:"max=120"`
	Source    string             `json:"source" binding:"required,max=50"`
	Metadata  map[string]any     `json:"metadata"`
}
