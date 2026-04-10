package seed

import (
	"time"

	"github.com/sakkada/network-monitoring-system/internal/domain/device"
	"github.com/sakkada/network-monitoring-system/internal/domain/logentry"
	"github.com/sakkada/network-monitoring-system/internal/domain/metric"
	"github.com/sakkada/network-monitoring-system/internal/dto"
	devicesvc "github.com/sakkada/network-monitoring-system/internal/service/device"
	logssvc "github.com/sakkada/network-monitoring-system/internal/service/logs"
	monitoringsvc "github.com/sakkada/network-monitoring-system/internal/service/monitoring"
)

func SeedMockData(
	deviceService *devicesvc.Service,
	metricService *monitoringsvc.Service,
	logService *logssvc.Service,
) error {
	existingDevices, err := deviceService.List()
	if err != nil {
		return err
	}

	existingNames := make(map[string]struct{}, len(existingDevices))
	for _, item := range existingDevices {
		existingNames[item.Name] = struct{}{}
	}

	now := time.Now().UTC()

	devicesToCreate := []dto.CreateDeviceRequest{
		{
			Name:          "Core Router R1",
			IPAddress:     "192.168.0.1",
			DeviceType:    "router",
			Vendor:        "Cisco",
			Model:         "ISR 4331",
			Location:      "Серверная A",
			Description:   "Main core router for the internal network",
			Status:        device.StatusOnline,
			DataSource:    device.SourceManual,
			LastCheckedAt: timePtr(now.Add(-2 * time.Minute)),
		},
		{
			Name:          "Access Switch SW-01",
			IPAddress:     "192.168.0.10",
			DeviceType:    "switch",
			Vendor:        "MikroTik",
			Model:         "CRS326",
			Location:      "2 этаж",
			Description:   "Distribution switch for office segment",
			Status:        device.StatusWarning,
			DataSource:    device.SourceManual,
			LastCheckedAt: timePtr(now.Add(-4 * time.Minute)),
		},
		{
			Name:          "DB Server SRV-DB-01",
			IPAddress:     "192.168.0.25",
			DeviceType:    "server",
			Vendor:        "Dell",
			Model:         "PowerEdge R540",
			Location:      "Серверная B",
			Description:   "Database server for internal services",
			Status:        device.StatusOnline,
			DataSource:    device.SourceSimulated,
			LastCheckedAt: timePtr(now.Add(-1 * time.Minute)),
		},
		{
			Name:          "Camera Gateway CAM-GW-01",
			IPAddress:     "192.168.0.40",
			DeviceType:    "gateway",
			Vendor:        "Ubiquiti",
			Model:         "EdgeRouter X",
			Location:      "Пост охраны",
			Description:   "Gateway for CCTV segment",
			Status:        device.StatusOffline,
			DataSource:    device.SourceManual,
			LastCheckedAt: timePtr(now.Add(-15 * time.Minute)),
		},
		{
			Name:          "Core Switch SW-CORE-02",
			IPAddress:     "192.168.0.11",
			DeviceType:    "switch",
			Vendor:        "Cisco",
			Model:         "Catalyst 9500",
			Location:      "Серверная A",
			Description:   "Core aggregation switch for backbone uplinks",
			Status:        device.StatusOnline,
			DataSource:    device.SourceSimulated,
			LastCheckedAt: timePtr(now.Add(-3 * time.Minute)),
		},
		{
			Name:          "Edge Router R2",
			IPAddress:     "192.168.0.2",
			DeviceType:    "router",
			Vendor:        "Juniper",
			Model:         "SRX300",
			Location:      "Канал филиала",
			Description:   "Reserve edge router for branch connectivity",
			Status:        device.StatusWarning,
			DataSource:    device.SourceSimulated,
			LastCheckedAt: timePtr(now.Add(-5 * time.Minute)),
		},
		{
			Name:          "Application Server APP-01",
			IPAddress:     "192.168.0.31",
			DeviceType:    "server",
			Vendor:        "HP",
			Model:         "ProLiant DL360",
			Location:      "Серверная B",
			Description:   "Application server for internal web services",
			Status:        device.StatusOnline,
			DataSource:    device.SourceSimulated,
			LastCheckedAt: timePtr(now.Add(-2 * time.Minute)),
		},
		{
			Name:          "Backup Server BKP-01",
			IPAddress:     "192.168.0.32",
			DeviceType:    "server",
			Vendor:        "Lenovo",
			Model:         "ThinkSystem SR650",
			Location:      "Резервная стойка",
			Description:   "Nightly backup storage and archive processing",
			Status:        device.StatusOnline,
			DataSource:    device.SourceManual,
			LastCheckedAt: timePtr(now.Add(-6 * time.Minute)),
		},
		{
			Name:          "Wireless Controller WLC-01",
			IPAddress:     "192.168.0.60",
			DeviceType:    "controller",
			Vendor:        "Cisco",
			Model:         "9800-L",
			Location:      "3 этаж",
			Description:   "Wireless controller for office access points",
			Status:        device.StatusWarning,
			DataSource:    device.SourceSimulated,
			LastCheckedAt: timePtr(now.Add(-4 * time.Minute)),
		},
		{
			Name:          "Firewall FW-01",
			IPAddress:     "192.168.0.254",
			DeviceType:    "firewall",
			Vendor:        "Fortinet",
			Model:         "FortiGate 100F",
			Location:      "Периметральная стойка",
			Description:   "Primary perimeter firewall",
			Status:        device.StatusOnline,
			DataSource:    device.SourceSimulated,
			LastCheckedAt: timePtr(now.Add(-1 * time.Minute)),
		},
		{
			Name:          "Firewall FW-02",
			IPAddress:     "192.168.0.253",
			DeviceType:    "firewall",
			Vendor:        "Fortinet",
			Model:         "FortiGate 100F",
			Location:      "Периметральная стойка",
			Description:   "Standby perimeter firewall",
			Status:        device.StatusOffline,
			DataSource:    device.SourceSimulated,
			LastCheckedAt: timePtr(now.Add(-11 * time.Minute)),
		},
		{
			Name:          "VoIP Gateway VG-01",
			IPAddress:     "192.168.0.70",
			DeviceType:    "gateway",
			Vendor:        "AudioCodes",
			Model:         "Mediant 800",
			Location:      "Узел телефонии",
			Description:   "Voice gateway for SIP trunk and PBX traffic",
			Status:        device.StatusOnline,
			DataSource:    device.SourceManual,
			LastCheckedAt: timePtr(now.Add(-8 * time.Minute)),
		},
		{
			Name:          "Access Point AP-14",
			IPAddress:     "192.168.0.114",
			DeviceType:    "access-point",
			Vendor:        "Ubiquiti",
			Model:         "U6-Pro",
			Location:      "Конференц-зал",
			Description:   "Wireless access point for conference area",
			Status:        device.StatusWarning,
			DataSource:    device.SourceSimulated,
			LastCheckedAt: timePtr(now.Add(-7 * time.Minute)),
		},
		{
			Name:          "NAS Storage NAS-01",
			IPAddress:     "192.168.0.80",
			DeviceType:    "storage",
			Vendor:        "Synology",
			Model:         "RS1221+",
			Location:      "Стойка хранения",
			Description:   "Shared file storage for engineering department",
			Status:        device.StatusOnline,
			DataSource:    device.SourceManual,
			LastCheckedAt: timePtr(now.Add(-5 * time.Minute)),
		},
	}

	createdDevices := make(map[string]int64)
	for _, item := range existingDevices {
		createdDevices[item.Name] = item.ID
	}

	for _, item := range devicesToCreate {
		if _, exists := existingNames[item.Name]; exists {
			continue
		}

		created, createErr := deviceService.Create(item)
		if createErr != nil {
			return createErr
		}

		createdDevices[created.Name] = created.ID
	}

	if len(existingDevices) > 0 {
		return nil
	}

	routerID, ok := createdDevices["Core Router R1"]
	if !ok {
		return nil
	}

	switchAID, ok := createdDevices["Access Switch SW-01"]
	if !ok {
		return nil
	}

	dbServerID, ok := createdDevices["DB Server SRV-DB-01"]
	if !ok {
		return nil
	}

	cameraGatewayID, ok := createdDevices["Camera Gateway CAM-GW-01"]
	if !ok {
		return nil
	}

	if _, err := metricService.Create(dto.CreateMetricRequest{
		DeviceID:    routerID,
		MetricType:  metric.TypePingLatency,
		Value:       8.4,
		Unit:        "ms",
		Status:      metric.StatusNormal,
		DataSource:  metric.SourceManual,
		CollectedAt: timePtr(now.Add(-2 * time.Minute)),
	}); err != nil {
		return err
	}

	if _, err := metricService.Create(dto.CreateMetricRequest{
		DeviceID:    switchAID,
		MetricType:  metric.TypePacketLoss,
		Value:       3.0,
		Unit:        "%",
		Status:      metric.StatusWarning,
		DataSource:  metric.SourceManual,
		CollectedAt: timePtr(now.Add(-4 * time.Minute)),
	}); err != nil {
		return err
	}

	if _, err := metricService.Create(dto.CreateMetricRequest{
		DeviceID:    dbServerID,
		MetricType:  metric.TypeCPUUsage,
		Value:       57.0,
		Unit:        "%",
		Status:      metric.StatusNormal,
		DataSource:  metric.SourceSimulated,
		CollectedAt: timePtr(now.Add(-1 * time.Minute)),
	}); err != nil {
		return err
	}

	if _, err := metricService.Create(dto.CreateMetricRequest{
		DeviceID:    dbServerID,
		MetricType:  metric.TypeMemoryUsage,
		Value:       72.5,
		Unit:        "%",
		Status:      metric.StatusWarning,
		DataSource:  metric.SourceSimulated,
		CollectedAt: timePtr(now.Add(-1 * time.Minute)),
	}); err != nil {
		return err
	}

	if _, err := metricService.Create(dto.CreateMetricRequest{
		DeviceID:    cameraGatewayID,
		MetricType:  metric.TypePingLatency,
		Value:       0,
		Unit:        "ms",
		Status:      metric.StatusCritical,
		DataSource:  metric.SourceManual,
		CollectedAt: timePtr(now.Add(-15 * time.Minute)),
	}); err != nil {
		return err
	}

	if _, err := logService.Create(dto.CreateLogEntryRequest{
		DeviceID:  &routerID,
		Level:     logentry.LevelInfo,
		Action:    "device_check",
		Message:   "Core router responded successfully to the latest availability check.",
		ActorRole: logentry.ActorRoleSystem,
		ActorName: "monitoring-service",
		Source:    "system",
		Metadata: map[string]any{
			"status":  "online",
			"latency": 8.4,
		},
	}); err != nil {
		return err
	}

	if _, err := logService.Create(dto.CreateLogEntryRequest{
		DeviceID:  &switchAID,
		Level:     logentry.LevelWarning,
		Action:    "packet_loss_detected",
		Message:   "Packet loss exceeded the warning threshold on access switch SW-01.",
		ActorRole: logentry.ActorRoleSystem,
		ActorName: "monitoring-service",
		Source:    "system",
		Metadata: map[string]any{
			"packetLoss": 3.0,
			"threshold":  2.0,
		},
	}); err != nil {
		return err
	}

	if _, err := logService.Create(dto.CreateLogEntryRequest{
		DeviceID:  &cameraGatewayID,
		Level:     logentry.LevelError,
		Action:    "device_unreachable",
		Message:   "Camera gateway did not respond to repeated checks and is marked offline.",
		ActorRole: logentry.ActorRoleSystem,
		ActorName: "monitoring-service",
		Source:    "system",
		Metadata: map[string]any{
			"status":        "offline",
			"retryAttempts": 3,
		},
	}); err != nil {
		return err
	}

	if _, err := logService.Create(dto.CreateLogEntryRequest{
		DeviceID:  &dbServerID,
		Level:     logentry.LevelAudit,
		Action:    "device_created",
		Message:   "Administrator added a database server entry using manual data input.",
		ActorRole: logentry.ActorRoleAdmin,
		ActorName: "admin",
		Source:    "admin-panel",
		Metadata: map[string]any{
			"method": "manual",
		},
	}); err != nil {
		return err
	}

	return nil
}

func timePtr(value time.Time) *time.Time {
	return &value
}
