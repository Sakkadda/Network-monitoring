package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sakkada/network-monitoring-system/internal/domain/metric"
)

type MetricRepository struct {
	pool *pgxpool.Pool
}

func NewMetricRepository(pool *pgxpool.Pool) *MetricRepository {
	return &MetricRepository{pool: pool}
}

func (r *MetricRepository) List(ctx context.Context) ([]metric.Metric, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, device_id, metric_type, value, unit, status, data_source, collected_at, created_at
		FROM metrics
		ORDER BY id
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]metric.Metric, 0)
	for rows.Next() {
		item, err := scanMetric(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}

	return items, rows.Err()
}

func (r *MetricRepository) GetByID(ctx context.Context, id int64) (metric.Metric, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT id, device_id, metric_type, value, unit, status, data_source, collected_at, created_at
		FROM metrics
		WHERE id = $1
	`, id)

	item, err := scanMetric(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return metric.Metric{}, ErrNotFound
		}
		return metric.Metric{}, err
	}

	return item, nil
}

func (r *MetricRepository) Create(ctx context.Context, item metric.Metric) (metric.Metric, error) {
	row := r.pool.QueryRow(ctx, `
		INSERT INTO metrics (device_id, metric_type, value, unit, status, data_source, collected_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, device_id, metric_type, value, unit, status, data_source, collected_at, created_at
	`,
		item.DeviceID, item.MetricType, item.Value, item.Unit, item.Status, item.DataSource, item.CollectedAt,
	)

	created, err := scanMetric(row)
	if err != nil {
		return metric.Metric{}, err
	}

	return created, nil
}

func (r *MetricRepository) Update(ctx context.Context, item metric.Metric) (metric.Metric, error) {
	row := r.pool.QueryRow(ctx, `
		UPDATE metrics
		SET device_id = $2,
		    metric_type = $3,
		    value = $4,
		    unit = $5,
		    status = $6,
		    data_source = $7,
		    collected_at = $8
		WHERE id = $1
		RETURNING id, device_id, metric_type, value, unit, status, data_source, collected_at, created_at
	`,
		item.ID, item.DeviceID, item.MetricType, item.Value, item.Unit, item.Status, item.DataSource, item.CollectedAt,
	)

	updated, err := scanMetric(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return metric.Metric{}, ErrNotFound
		}
		return metric.Metric{}, err
	}

	return updated, nil
}

func (r *MetricRepository) Delete(ctx context.Context, id int64) error {
	commandTag, err := r.pool.Exec(ctx, `DELETE FROM metrics WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if commandTag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

type metricScanner interface {
	Scan(dest ...any) error
}

func scanMetric(scanner metricScanner) (metric.Metric, error) {
	var item metric.Metric
	err := scanner.Scan(
		&item.ID,
		&item.DeviceID,
		&item.MetricType,
		&item.Value,
		&item.Unit,
		&item.Status,
		&item.DataSource,
		&item.CollectedAt,
		&item.CreatedAt,
	)
	if err != nil {
		return metric.Metric{}, err
	}

	return item, nil
}
