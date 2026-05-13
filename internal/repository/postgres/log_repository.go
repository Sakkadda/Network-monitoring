package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sakkada/network-monitoring-system/internal/domain/logentry"
)

type LogRepository struct {
	pool *pgxpool.Pool
}

func NewLogRepository(pool *pgxpool.Pool) *LogRepository {
	return &LogRepository{pool: pool}
}

func (r *LogRepository) List(ctx context.Context) ([]logentry.LogEntry, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, device_id, level, action, message, actor_role, actor_name, source, metadata, created_at
		FROM logs
		ORDER BY created_at DESC, id DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]logentry.LogEntry, 0)
	for rows.Next() {
		item, err := scanLog(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}

	return items, rows.Err()
}

func (r *LogRepository) GetByID(ctx context.Context, id int64) (logentry.LogEntry, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT id, device_id, level, action, message, actor_role, actor_name, source, metadata, created_at
		FROM logs
		WHERE id = $1
	`, id)

	item, err := scanLog(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return logentry.LogEntry{}, ErrNotFound
		}
		return logentry.LogEntry{}, err
	}

	return item, nil
}

func (r *LogRepository) Create(ctx context.Context, item logentry.LogEntry) (logentry.LogEntry, error) {
	row := r.pool.QueryRow(ctx, `
		INSERT INTO logs (device_id, level, action, message, actor_role, actor_name, source, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
		RETURNING id, device_id, level, action, message, actor_role, actor_name, source, metadata, created_at
	`,
		item.DeviceID, item.Level, item.Action, item.Message, item.ActorRole, item.ActorName, item.Source, item.Metadata,
	)

	created, err := scanLog(row)
	if err != nil {
		return logentry.LogEntry{}, err
	}

	return created, nil
}

func (r *LogRepository) Update(ctx context.Context, item logentry.LogEntry) (logentry.LogEntry, error) {
	row := r.pool.QueryRow(ctx, `
		UPDATE logs
		SET device_id = $2,
		    level = $3,
		    action = $4,
		    message = $5,
		    actor_role = $6,
		    actor_name = $7,
		    source = $8,
		    metadata = $9::jsonb
		WHERE id = $1
		RETURNING id, device_id, level, action, message, actor_role, actor_name, source, metadata, created_at
	`,
		item.ID, item.DeviceID, item.Level, item.Action, item.Message, item.ActorRole, item.ActorName, item.Source, item.Metadata,
	)

	updated, err := scanLog(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return logentry.LogEntry{}, ErrNotFound
		}
		return logentry.LogEntry{}, err
	}

	return updated, nil
}

func (r *LogRepository) Delete(ctx context.Context, id int64) error {
	commandTag, err := r.pool.Exec(ctx, `DELETE FROM logs WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if commandTag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *LogRepository) Clear(ctx context.Context) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM logs`)
	return err
}

type logScanner interface {
	Scan(dest ...any) error
}

func scanLog(scanner logScanner) (logentry.LogEntry, error) {
	var item logentry.LogEntry
	err := scanner.Scan(
		&item.ID,
		&item.DeviceID,
		&item.Level,
		&item.Action,
		&item.Message,
		&item.ActorRole,
		&item.ActorName,
		&item.Source,
		&item.Metadata,
		&item.CreatedAt,
	)
	if err != nil {
		return logentry.LogEntry{}, err
	}

	return item, nil
}
