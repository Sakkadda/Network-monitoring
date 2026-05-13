package simulator

import (
	"context"
	"errors"
	"fmt"
	"log"
	"math/rand"
	"sync"
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
	mu            sync.RWMutex
	interval      time.Duration
	intervalCh    chan struct{}
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
		intervalCh:    make(chan struct{}, 1),
		random:        rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

func (s *DeviceStateSimulator) Start(ctx context.Context) {
	if err := s.runCycle(); err != nil {
		log.Printf("device simulator initial cycle failed: %v", err)
	}

	for {
		timer := time.NewTimer(s.currentInterval())

		select {
		case <-ctx.Done():
			if !timer.Stop() {
				select {
				case <-timer.C:
				default:
				}
			}
			return
		case <-s.intervalCh:
			if !timer.Stop() {
				select {
				case <-timer.C:
				default:
				}
			}
			continue
		case <-timer.C:
			if err := s.runCycle(); err != nil {
				log.Printf("device simulator cycle failed: %v", err)
			}
		}
	}
}

func (s *DeviceStateSimulator) IntervalSeconds() int {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return int(s.interval / time.Second)
}

func (s *DeviceStateSimulator) SetIntervalSeconds(seconds int) error {
	if seconds < 5 {
		return errors.New("simulator interval must be at least 5 seconds")
	}

	s.mu.Lock()
	s.interval = time.Duration(seconds) * time.Second
	s.mu.Unlock()

	select {
	case s.intervalCh <- struct{}{}:
	default:
	}

	return nil
}

func (s *DeviceStateSimulator) currentInterval() time.Duration {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return s.interval
}

func (s *DeviceStateSimulator) runCycle() error {
	devices, err := s.deviceService.List()
	if err != nil {
		return err
	}

	nextStatuses := s.buildNextStatuses(len(devices))

	onlineCount := 0
	warningCount := 0
	offlineCount := 0
	changedCount := 0

	for index, current := range devices {
		nextStatus := nextStatuses[index]
		checkedAt := time.Now().UTC()
		isActive := current.IsActive

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
			IsActive:      &isActive,
			LastCheckedAt: &checkedAt,
		})
		if err != nil {
			return err
		}

		snapshots := s.metricSnapshots(updated)

		if err := s.createMetrics(updated, checkedAt, snapshots); err != nil {
			return err
		}

		if updated.Status != current.Status {
			changedCount++
			if err := s.createStateChangeLog(updated, current.Status, snapshots); err != nil {
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

func (s *DeviceStateSimulator) buildNextStatuses(total int) []device.Status {
	if total <= 0 {
		return nil
	}

	onlinePercent, warningPercent, _ := s.pickStatusDistribution()

	onlineTarget := int(float64(total) * float64(onlinePercent) / 100)
	warningTarget := int(float64(total) * float64(warningPercent) / 100)
	offlineTarget := total - onlineTarget - warningTarget

	statuses := make([]device.Status, 0, total)

	for i := 0; i < onlineTarget; i++ {
		statuses = append(statuses, device.StatusOnline)
	}

	for i := 0; i < warningTarget; i++ {
		statuses = append(statuses, device.StatusWarning)
	}

	for i := 0; i < offlineTarget; i++ {
		statuses = append(statuses, device.StatusOffline)
	}

	s.random.Shuffle(len(statuses), func(i, j int) {
		statuses[i], statuses[j] = statuses[j], statuses[i]
	})

	return statuses
}

func (s *DeviceStateSimulator) pickStatusDistribution() (online int, warning int, offline int) {
	for attempt := 0; attempt < 64; attempt++ {
		online = 50 + s.random.Intn(21)
		offline = s.random.Intn(21)
		warning = 100 - online - offline

		if warning >= 20 && warning <= 40 {
			return online, warning, offline
		}
	}

	return 60, 30, 10
}

func (s *DeviceStateSimulator) createMetrics(item device.Device, collectedAt time.Time, snapshots []metricSnapshot) error {
	for _, snapshot := range snapshots {
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

func (s *DeviceStateSimulator) createStateChangeLog(item device.Device, previousStatus device.Status, snapshots []metricSnapshot) error {
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

	reason, triggerMetric := s.statusChangeReason(item.Status, snapshots)

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
			"reason":         reason,
			"triggerMetric":  triggerMetric,
			"metrics":        s.metricsMetadata(snapshots),
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

func (s *DeviceStateSimulator) statusChangeReason(status device.Status, snapshots []metricSnapshot) (string, string) {
	values := s.metricsMetadata(snapshots)
	latency, _ := values["pingLatencyMs"].(float64)
	memory, _ := values["memoryUsagePercent"].(float64)
	cpu, _ := values["cpuUsagePercent"].(float64)
	packetLoss, _ := values["packetLossPercent"].(float64)

	switch status {
	case device.StatusOffline:
		return fmt.Sprintf("Device became unreachable: packet loss reached %.2f%% and latency dropped to %.2f ms.", packetLoss, latency), "packet_loss"
	case device.StatusWarning:
		if latency >= memory && latency >= cpu && latency >= packetLoss {
			return fmt.Sprintf("Warning state triggered by increased latency: %.2f ms.", latency), "ping_latency"
		}

		if memory >= cpu && memory >= packetLoss {
			return fmt.Sprintf("Warning state triggered by high memory usage: %.2f%%.", memory), "memory_usage"
		}

		if cpu >= packetLoss {
			return fmt.Sprintf("Warning state triggered by high CPU usage: %.2f%%.", cpu), "cpu_usage"
		}

		return fmt.Sprintf("Warning state triggered by packet loss: %.2f%%.", packetLoss), "packet_loss"
	default:
		return fmt.Sprintf("Device recovered: latency %.2f ms, CPU %.2f%%, memory %.2f%%, packet loss %.2f%%.", latency, cpu, memory, packetLoss), "recovery"
	}
}

func (s *DeviceStateSimulator) metricsMetadata(snapshots []metricSnapshot) map[string]any {
	result := map[string]any{}

	for _, snapshot := range snapshots {
		switch snapshot.metricType {
		case metric.TypePingLatency:
			result["pingLatencyMs"] = roundMetricValue(snapshot.value)
		case metric.TypeMemoryUsage:
			result["memoryUsagePercent"] = roundMetricValue(snapshot.value)
		case metric.TypeCPUUsage:
			result["cpuUsagePercent"] = roundMetricValue(snapshot.value)
		case metric.TypePacketLoss:
			result["packetLossPercent"] = roundMetricValue(snapshot.value)
		}
	}

	return result
}

func roundMetricValue(value float64) float64 {
	return float64(int(value*100+0.5)) / 100
}
