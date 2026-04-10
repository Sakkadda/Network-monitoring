package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/sakkada/network-monitoring-system/internal/dto"
	devicesvc "github.com/sakkada/network-monitoring-system/internal/service/device"
)

type DeviceHandler struct {
	service *devicesvc.Service
}

func NewDeviceHandler(service *devicesvc.Service) DeviceHandler {
	return DeviceHandler{service: service}
}

func (h DeviceHandler) List(c *gin.Context) {
	items, err := h.service.List()
	if err != nil {
		handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h DeviceHandler) GetByID(c *gin.Context) {
	id, ok := parseIDParam(c)
	if !ok {
		return
	}

	item, err := h.service.GetByID(id)
	if err != nil {
		handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": item})
}

func (h DeviceHandler) Create(c *gin.Context) {
	var input dto.CreateDeviceRequest
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	item, err := h.service.Create(input)
	if err != nil {
		handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": item})
}

func (h DeviceHandler) Update(c *gin.Context) {
	id, ok := parseIDParam(c)
	if !ok {
		return
	}

	var input dto.UpdateDeviceRequest
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	item, err := h.service.Update(id, input)
	if err != nil {
		handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": item})
}

func (h DeviceHandler) Delete(c *gin.Context) {
	id, ok := parseIDParam(c)
	if !ok {
		return
	}

	if err := h.service.Delete(id); err != nil {
		handleServiceError(c, err)
		return
	}

	c.Status(http.StatusNoContent)
}
