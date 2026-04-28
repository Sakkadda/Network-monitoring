package logs

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/sakkada/network-monitoring-system/internal/domain/logentry"
	"github.com/sakkada/network-monitoring-system/internal/dto"
	postgresrepo "github.com/sakkada/network-monitoring-system/internal/repository/postgres"
)

var ErrLogEntryNotFound = errors.New("log entry not found")

type Repository interface {
	List(ctx context.Context) ([]logentry.LogEntry, error)
	GetByID(ctx context.Context, id int64) (logentry.LogEntry, error)
	Create(ctx context.Context, item logentry.LogEntry) (logentry.LogEntry, error)
	Update(ctx context.Context, item logentry.LogEntry) (logentry.LogEntry, error)
	Delete(ctx context.Context, id int64) error
}

type Service struct {
	repository Repository
}

func NewService(repository Repository) *Service {
	return &Service{repository: repository}
}

func (s *Service) List() ([]logentry.LogEntry, error) {
	return s.repository.List(context.Background())
}

func (s *Service) GetByID(id int64) (logentry.LogEntry, error) {
	item, err := s.repository.GetByID(context.Background(), id)
	if err != nil {
		return logentry.LogEntry{}, mapRepositoryError(err)
	}

	return item, nil
}

func (s *Service) Create(input dto.CreateLogEntryRequest) (logentry.LogEntry, error) {
	level := input.Level
	if level == "" {
		level = logentry.LevelInfo
	}

	actorRole := input.ActorRole
	if actorRole == "" {
		actorRole = logentry.ActorRoleSystem
	}

	source := input.Source
	if source == "" {
		source = "system"
	}

	metadata, err := marshalMetadata(input.Metadata)
	if err != nil {
		return logentry.LogEntry{}, err
	}

	item := logentry.LogEntry{
		DeviceID:  input.DeviceID,
		Level:     level,
		Action:    input.Action,
		Message:   input.Message,
		ActorRole: actorRole,
		ActorName: input.ActorName,
		Source:    source,
		Metadata:  metadata,
	}

	created, err := s.repository.Create(context.Background(), item)
	if err != nil {
		return logentry.LogEntry{}, err
	}

	return created, nil
}

func (s *Service) Update(id int64, input dto.UpdateLogEntryRequest) (logentry.LogEntry, error) {
	metadata, err := marshalMetadata(input.Metadata)
	if err != nil {
		return logentry.LogEntry{}, err
	}

	item := logentry.LogEntry{
		ID:        id,
		DeviceID:  input.DeviceID,
		Level:     input.Level,
		Action:    input.Action,
		Message:   input.Message,
		ActorRole: input.ActorRole,
		ActorName: input.ActorName,
		Source:    input.Source,
		Metadata:  metadata,
	}

	updated, err := s.repository.Update(context.Background(), item)
	if err != nil {
		return logentry.LogEntry{}, mapRepositoryError(err)
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

func marshalMetadata(value map[string]any) ([]byte, error) {
	if value == nil {
		value = map[string]any{}
	}

	return json.Marshal(value)
}

func mapRepositoryError(err error) error {
	if errors.Is(err, postgresrepo.ErrNotFound) {
		return ErrLogEntryNotFound
	}
	return err
}
