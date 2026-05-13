package user

import "time"

type Role string

const (
	RoleAdmin Role = "admin"
	RoleUser  Role = "user"
)

type StartTab string

const (
	StartTabDashboard StartTab = "dashboard"
	StartTabStatus    StartTab = "status"
	StartTabDevices   StartTab = "devices"
	StartTabMetrics   StartTab = "metrics"
	StartTabLogs      StartTab = "logs"
	StartTabSettings  StartTab = "settings"
)

type PreferredLanguage string

const (
	LanguageRU PreferredLanguage = "ru"
	LanguageEN PreferredLanguage = "en"
)

type User struct {
	ID                int64             `json:"id" db:"id"`
	Username          string            `json:"username" db:"username"`
	PasswordHash      string            `json:"-" db:"password_hash"`
	Role              Role              `json:"role" db:"role"`
	DisplayName       string            `json:"displayName" db:"display_name"`
	PreferredLanguage PreferredLanguage `json:"preferredLanguage" db:"preferred_language"`
	StartTab          StartTab          `json:"startTab" db:"start_tab"`
	CreatedAt         time.Time         `json:"createdAt" db:"created_at"`
	UpdatedAt         time.Time         `json:"updatedAt" db:"updated_at"`
}
