package dto

import "github.com/sakkada/network-monitoring-system/internal/domain/user"

type LoginRequest struct {
	Username string `json:"username" binding:"required,min=2,max=80"`
	Password string `json:"password" binding:"required,min=4,max=255"`
}

type AuthUserResponse struct {
	Username          string                 `json:"username"`
	Role              user.Role              `json:"role"`
	DisplayName       string                 `json:"displayName"`
	PreferredLanguage user.PreferredLanguage `json:"preferredLanguage"`
	StartTab          user.StartTab          `json:"startTab"`
}

type LoginResponse struct {
	Token string           `json:"token"`
	User  AuthUserResponse `json:"user"`
}

type CreateUserRequest struct {
	Username          string                 `json:"username" binding:"required,min=2,max=80"`
	Password          string                 `json:"password" binding:"required,min=4,max=255"`
	Role              user.Role              `json:"role" binding:"required,oneof=admin user"`
	DisplayName       string                 `json:"displayName" binding:"max=120"`
	PreferredLanguage user.PreferredLanguage `json:"preferredLanguage" binding:"omitempty,oneof=ru en"`
	StartTab          user.StartTab          `json:"startTab" binding:"omitempty,oneof=dashboard status devices metrics logs settings"`
}

type UpdateUserRequest struct {
	Role              user.Role              `json:"role" binding:"required,oneof=admin user"`
	DisplayName       string                 `json:"displayName" binding:"max=120"`
	PreferredLanguage user.PreferredLanguage `json:"preferredLanguage" binding:"omitempty,oneof=ru en"`
	StartTab          user.StartTab          `json:"startTab" binding:"omitempty,oneof=dashboard status devices metrics logs settings"`
}

type UpdateOwnProfileRequest struct {
	DisplayName       string                 `json:"displayName" binding:"max=120"`
	PreferredLanguage user.PreferredLanguage `json:"preferredLanguage" binding:"omitempty,oneof=ru en"`
	StartTab          user.StartTab          `json:"startTab" binding:"omitempty,oneof=dashboard status devices metrics logs settings"`
}

type UpdatePasswordRequest struct {
	NewPassword string `json:"newPassword" binding:"required,min=4,max=255"`
}
