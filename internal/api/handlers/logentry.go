package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/sakkada/network-monitoring-system/internal/dto"
	logssvc "github.com/sakkada/network-monitoring-system/internal/service/logs"
)

type LogEntryHandler struct {
	service *logssvc.Service
}

func NewLogEntryHandler(service *logssvc.Service) LogEntryHandler {
	return LogEntryHandler{service: service}
}

func (h LogEntryHandler) List(c *gin.Context) {
	items, err := h.service.List()
	if err != nil {
		handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h LogEntryHandler) GetByID(c *gin.Context) {
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

func (h LogEntryHandler) Create(c *gin.Context) {
	var input dto.CreateLogEntryRequest
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	item, err := h.service.Create(input)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": item})
}

func (h LogEntryHandler) Update(c *gin.Context) {
	id, ok := parseIDParam(c)
	if !ok {
		return
	}

	var input dto.UpdateLogEntryRequest
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

func (h LogEntryHandler) Delete(c *gin.Context) {
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
