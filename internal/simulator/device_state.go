package simulator

import (
	"context"
	"log"
	"math/rand"
	"time"

	"github.com/sakkada/network-monitoring-system/internal/domain/device"
	"github.com/sakkada/network-monitoring-system/internal/domain/logentry"
	"github.com/sakkada/network-monitoring-system/internal/domain/metric"
	"github.com/sakkada/network-monitoring-system/internal/dto"
	devicesvc "github.com/sakkada/network-monitoring-system/internal/service/device"
	logssvc "github.com/sakkada/network-monitoring-system/internal/service/logs"
	monitoringsvc "github.com/sakkada/network-monitoring-system/internal/service/monitoring"
)

type DeviceStateSimulator struct {
	deviceService *devicesvc.Service
	metricService *monitoringsvc.Service
	logService    *logssvc.Service
	interval      time.Duration
	random        *rand.Rand
}

func NewDeviceStateSimulator(
	deviceService *devicesvc.Service,
	metricService *monitoringsvc.Service,
	logService *logssvc.Service,
	interval time.Duration,
) *DeviceStateSimulator {
	if interval <= 0 {
		interval = time.Minute
	}

	return &DeviceStateSimulator{
		deviceService: deviceService,
		metricService: metricService,
		logService:    logService,
		interval:      interval,
		random:        rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

func (s *DeviceStateSimulator) Start(ctx context.Context) {
	if err := s.runCycle(); err != nil {
		log.Printf("device simulator initial cycle failed: %v", err)
	}

	ticker := time.NewTicker(s.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := s.runCycle(); err != nil {
				log.Printf("device simulator cycle failed: %v", err)
			}
		}
	}
}

func (s *DeviceStateSimulator) runCycle() error {
	devices, err := s.deviceService.List()
	if err != nil {
		return err
	}

	onlineCount := 0
	warningCount := 0
	offlineCount := 0
	changedCount := 0

	for _, current := range devices {
		nextStatus := s.pickNextStatus(current.Status)
		checkedAt := time.Now().UTC()

		updated, err := s.deviceService.Update(current.ID, dto.UpdateDeviceRequest{
			Name:          current.Name,
			IPAddress:     current.IPAddress,
			DeviceType:    current.DeviceType,
			Vendor:        current.Vendor,
			Model:         current.Model,
			Location:      current.Location,
			Description:   current.Description,
			Status:        nextStatus,
			DataSource:    current.DataSource,
			IsActive:      current.IsActive,
			LastCheckedAt: &checkedAt,
		})
		if err != nil {
			return err
		}

		if err := s.createMetrics(updated, checkedAt); err != nil {
			return err
		}

		if updated.Status != current.Status {
			changedCount++
			if err := s.createStateChangeLog(updated, current.Status); err != nil {
				return err
			}
		}

		switch updated.Status {
		case device.StatusOnline:
			onlineCount++
		case device.StatusWarning:
			warningCount++
		case device.StatusOffline:
			offlineCount++
		}
	}

	if err := s.createCycleSummaryLog(len(devices), onlineCount, warningCount, offlineCount, changedCount); err != nil {
		return err
	}

	return nil
}

func (s *DeviceStateSimulator) pickNextStatus(current device.Status) device.Status {
	roll := s.random.Intn(100)

	switch current {
	case device.StatusOnline:
		if roll < 68 {
			return device.StatusOnline
		}
		if roll < 90 {
			return device.StatusWarning
		}
		return device.StatusOffline
	case device.StatusWarning:
		if roll < 35 {
			return device.StatusOnline
		}
		if roll < 75 {
			return device.StatusWarning
		}
		return device.StatusOffline
	case device.StatusOffline:
		if roll < 30 {
			return device.StatusOnline
		}
		if roll < 55 {
			return device.StatusWarning
		}
		return device.StatusOffline
	default:
		if roll < 50 {
			return device.StatusOnline
		}
		if roll < 80 {
			return device.StatusWarning
		}
		return device.StatusOffline
	}
}

func (s *DeviceStateSimulator) createMetrics(item device.Device, collectedAt time.Time) error {
	for _, snapshot := range s.metricSnapshots(item) {
		_, err := s.metricService.Create(dto.CreateMetricRequest{
			DeviceID:    item.ID,
			MetricType:  snapshot.metricType,
			Value:       snapshot.value,
			Unit:        snapshot.unit,
			Status:      snapshot.status,
			DataSource:  metric.SourceSimulated,
			CollectedAt: &collectedAt,
		})
		if err != nil {
			return err
		}
	}

	return nil
}

func (s *DeviceStateSimulator) createStateChangeLog(item device.Device, previousStatus device.Status) error {
	level := logentry.LevelInfo
	action := "device_status_updated"

	switch item.Status {
	case device.StatusWarning:
		level = logentry.LevelWarning
		action = "device_warning_detected"
	case device.StatusOffline:
		level = logentry.LevelError
		action = "device_became_offline"
	}

	_, err := s.logService.Create(dto.CreateLogEntryRequest{
		DeviceID:  &item.ID,
		Level:     level,
		Action:    action,
		Message:   "Simulator updated device state after the latest monitoring cycle.",
		ActorRole: logentry.ActorRoleSystem,
		ActorName: "state-simulator",
		Source:    "simulator",
		Metadata: map[string]any{
			"previousStatus": previousStatus,
			"currentStatus":  item.Status,
			"deviceName":     item.Name,
		},
	})

	return err
}

func (s *DeviceStateSimulator) createCycleSummaryLog(totalDevices, onlineCount, warningCount, offlineCount, changedCount int) error {
	_, err := s.logService.Create(dto.CreateLogEntryRequest{
		Level:     logentry.LevelInfo,
		Action:    "simulator_cycle_completed",
		Message:   "Simulator completed the monitoring cycle and refreshed device states.",
		ActorRole: logentry.ActorRoleSystem,
		ActorName: "state-simulator",
		Source:    "simulator",
		Metadata: map[string]any{
			"totalDevices": totalDevices,
			"online":       onlineCount,
			"warning":      warningCount,
			"offline":      offlineCount,
			"changed":      changedCount,
		},
	})

	return err
}

type metricSnapshot struct {
	metricType metric.Type
	value      float64
	unit       string
	status     metric.Status
}

func (s *DeviceStateSimulator) metricSnapshots(item device.Device) []metricSnapshot {
	switch item.Status {
	case device.StatusOnline:
		return s.metricsForOnline()
	case device.StatusWarning:
		return s.metricsForWarning()
	default:
		return s.metricsForOffline()
	}
}

func (s *DeviceStateSimulator) metricsForOnline() []metricSnapshot {
	return []metricSnapshot{
		{metricType: metric.TypePingLatency, value: 4 + s.random.Float64()*14, unit: "ms", status: metric.StatusNormal},
		{metricType: metric.TypeMemoryUsage, value: 34 + s.random.Float64()*28, unit: "%", status: metric.StatusNormal},
		{metricType: metric.TypeCPUUsage, value: 18 + s.random.Float64()*26, unit: "%", status: metric.StatusNormal},
		{metricType: metric.TypePacketLoss, value: s.random.Float64() * 0.8, unit: "%", status: metric.StatusNormal},
	}
}

func (s *DeviceStateSimulator) metricsForWarning() []metricSnapshot {
	return []metricSnapshot{
		{metricType: metric.TypePingLatency, value: 45 + s.random.Float64()*55, unit: "ms", status: metric.StatusWarning},
		{metricType: metric.TypeMemoryUsage, value: 68 + s.random.Float64()*18, unit: "%", status: metric.StatusWarning},
		{metricType: metric.TypeCPUUsage, value: 58 + s.random.Float64()*18, unit: "%", status: metric.StatusWarning},
		{metricType: metric.TypePacketLoss, value: 1.5 + s.random.Float64()*4.5, unit: "%", status: metric.StatusWarning},
	}
}

func (s *DeviceStateSimulator) metricsForOffline() []metricSnapshot {
	return []metricSnapshot{
		{metricType: metric.TypePingLatency, value: 0, unit: "ms", status: metric.StatusCritical},
		{metricType: metric.TypeMemoryUsage, value: 0, unit: "%", status: metric.StatusCritical},
		{metricType: metric.TypeCPUUsage, value: 0, unit: "%", status: metric.StatusCritical},
		{metricType: metric.TypePacketLoss, value: 100, unit: "%", status: metric.StatusCritical},
	}
}
