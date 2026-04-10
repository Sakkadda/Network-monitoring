package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/sakkada/network-monitoring-system/internal/dto"
	monitoringsvc "github.com/sakkada/network-monitoring-system/internal/service/monitoring"
)

type MetricHandler struct {
	service *monitoringsvc.Service
}

func NewMetricHandler(service *monitoringsvc.Service) MetricHandler {
	return MetricHandler{service: service}
}

func (h MetricHandler) List(c *gin.Context) {
	items, err := h.service.List()
	if err != nil {
		handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h MetricHandler) GetByID(c *gin.Context) {
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

func (h MetricHandler) Create(c *gin.Context) {
	var input dto.CreateMetricRequest
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

func (h MetricHandler) Update(c *gin.Context) {
	id, ok := parseIDParam(c)
	if !ok {
		return
	}

	var input dto.UpdateMetricRequest
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

func (h MetricHandler) Delete(c *gin.Context) {
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
