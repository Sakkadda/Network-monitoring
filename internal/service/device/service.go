package device

import (
	"context"
	"errors"

	"github.com/sakkada/network-monitoring-system/internal/domain/device"
	"github.com/sakkada/network-monitoring-system/internal/dto"
	postgresrepo "github.com/sakkada/network-monitoring-system/internal/repository/postgres"
)

var ErrDeviceNotFound = errors.New("device not found")

type Repository interface {
	List(ctx context.Context) ([]device.Device, error)
	GetByID(ctx context.Context, id int64) (device.Device, error)
	Create(ctx context.Context, item device.Device) (device.Device, error)
	Update(ctx context.Context, item device.Device) (device.Device, error)
	Delete(ctx context.Context, id int64) error
	Count(ctx context.Context) (int64, error)
}

type Service struct {
	repository Repository
}

func NewService(repository Repository) *Service {
	return &Service{repository: repository}
}

func (s *Service) List() ([]device.Device, error) {
	return s.repository.List(context.Background())
}

func (s *Service) GetByID(id int64) (device.Device, error) {
	item, err := s.repository.GetByID(context.Background(), id)
	if err != nil {
		return device.Device{}, mapRepositoryError(err)
	}

	return item, nil
}

func (s *Service) Count() (int64, error) {
	return s.repository.Count(context.Background())
}

func (s *Service) Create(input dto.CreateDeviceRequest) (device.Device, error) {
	status := input.Status
	if status == "" {
		status = device.StatusUnknown
	}

	source := input.DataSource
	if source == "" {
		source = device.SourceManual
	}

	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	item := device.Device{
		Name:        input.Name,
		IPAddress:   input.IPAddress,
		DeviceType:  input.DeviceType,
		Vendor:      input.Vendor,
		Model:       input.Model,
		Location:    input.Location,
		Description: input.Description,
		Status:      status,
		DataSource:  source,
		IsActive:    isActive,
	}

	if input.LastCheckedAt != nil {
		item.LastCheckedAt = input.LastCheckedAt.UTC()
	}

	created, err := s.repository.Create(context.Background(), item)
	if err != nil {
		return device.Device{}, err
	}

	return created, nil
}

func (s *Service) Update(id int64, input dto.UpdateDeviceRequest) (device.Device, error) {
	current, err := s.repository.GetByID(context.Background(), id)
	if err != nil {
		return device.Device{}, mapRepositoryError(err)
	}

	status := input.Status
	if status == "" {
		status = current.Status
	}

	dataSource := input.DataSource
	if dataSource == "" {
		dataSource = current.DataSource
	}

	isActive := current.IsActive
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	item := device.Device{
		ID:          id,
		Name:        input.Name,
		IPAddress:   input.IPAddress,
		DeviceType:  input.DeviceType,
		Vendor:      input.Vendor,
		Model:       input.Model,
		Location:    input.Location,
		Description: input.Description,
		Status:      status,
		DataSource:  dataSource,
		IsActive:    isActive,
	}

	if input.LastCheckedAt != nil {
		item.LastCheckedAt = input.LastCheckedAt.UTC()
	} else {
		item.LastCheckedAt = current.LastCheckedAt
	}

	updated, err := s.repository.Update(context.Background(), item)
	if err != nil {
		return device.Device{}, mapRepositoryError(err)
	}

	return updated, nil
}

func (s *Service) Delete(id int64) error {
	err := s.repository.Delete(context.Background(), id)
	if err != nil {
		return mapRepositoryError(err)
	}
	return nil
}

func mapRepositoryError(err error) error {
	if errors.Is(err, postgresrepo.ErrNotFound) {
		return ErrDeviceNotFound
	}
	return err
}
