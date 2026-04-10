package monitoring

import (
	"context"
	"errors"
	"time"

	"github.com/sakkada/network-monitoring-system/internal/domain/metric"
	"github.com/sakkada/network-monitoring-system/internal/dto"
	postgresrepo "github.com/sakkada/network-monitoring-system/internal/repository/postgres"
)

var ErrMetricNotFound = errors.New("metric not found")

type Repository interface {
	List(ctx context.Context) ([]metric.Metric, error)
	GetByID(ctx context.Context, id int64) (metric.Metric, error)
	Create(ctx context.Context, item metric.Metric) (metric.Metric, error)
	Update(ctx context.Context, item metric.Metric) (metric.Metric, error)
	Delete(ctx context.Context, id int64) error
}

type Service struct {
	repository Repository
}

func NewService(repository Repository) *Service {
	return &Service{repository: repository}
}

func (s *Service) List() ([]metric.Metric, error) {
	return s.repository.List(context.Background())
}

func (s *Service) GetByID(id int64) (metric.Metric, error) {
	item, err := s.repository.GetByID(context.Background(), id)
	if err != nil {
		return metric.Metric{}, mapRepositoryError(err)
	}

	return item, nil
}

func (s *Service) Create(input dto.CreateMetricRequest) (metric.Metric, error) {
	status := input.Status
	if status == "" {
		status = metric.StatusNormal
	}

	source := input.DataSource
	if source == "" {
		source = metric.SourceManual
	}

	collectedAt := time.Now().UTC()
	if input.CollectedAt != nil {
		collectedAt = input.CollectedAt.UTC()
	}

	item := metric.Metric{
		DeviceID:    input.DeviceID,
		MetricType:  input.MetricType,
		Value:       input.Value,
		Unit:        input.Unit,
		Status:      status,
		DataSource:  source,
		CollectedAt: collectedAt,
	}

	created, err := s.repository.Create(context.Background(), item)
	if err != nil {
		return metric.Metric{}, err
	}

	return created, nil
}

func (s *Service) Update(id int64, input dto.UpdateMetricRequest) (metric.Metric, error) {
	item := metric.Metric{
		ID:          id,
		DeviceID:    input.DeviceID,
		MetricType:  input.MetricType,
		Value:       input.Value,
		Unit:        input.Unit,
		Status:      input.Status,
		DataSource:  input.DataSource,
		CollectedAt: input.CollectedAt.UTC(),
	}

	updated, err := s.repository.Update(context.Background(), item)
	if err != nil {
		return metric.Metric{}, mapRepositoryError(err)
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
		return ErrMetricNotFound
	}
	return err
}
