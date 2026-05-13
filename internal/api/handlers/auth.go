package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/sakkada/network-monitoring-system/internal/api/middleware"
	"github.com/sakkada/network-monitoring-system/internal/dto"
	authsvc "github.com/sakkada/network-monitoring-system/internal/service/auth"
)

type AuthHandler struct {
	service *authsvc.Service
}

func NewAuthHandler(service *authsvc.Service) AuthHandler {
	return AuthHandler{service: service}
}

func (h AuthHandler) Login(c *gin.Context) {
	var input dto.LoginRequest
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	response, err := h.service.Authenticate(input)
	if err != nil {
		handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": response})
}

func (h AuthHandler) Me(c *gin.Context) {
	principal, ok := middleware.GetPrincipal(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	item, err := h.service.GetCurrentUser(authsvc.TokenClaims{
		Username: principal.Username,
		Role:     principal.Role,
	})
	if err != nil {
		handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": item})
}

func (h AuthHandler) UpdateOwnProfile(c *gin.Context) {
	principal, ok := middleware.GetPrincipal(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var input dto.UpdateOwnProfileRequest
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	item, err := h.service.UpdateOwnProfile(principal.Username, input, principal.Role)
	if err != nil {
		handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": item})
}

func (h AuthHandler) UpdateOwnPassword(c *gin.Context) {
	principal, ok := middleware.GetPrincipal(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var input dto.UpdatePasswordRequest
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.UpdatePassword(principal.Username, input.NewPassword); err != nil {
		handleServiceError(c, err)
		return
	}

	c.Status(http.StatusNoContent)
}
