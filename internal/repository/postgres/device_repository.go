package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sakkada/network-monitoring-system/internal/domain/device"
)

type DeviceRepository struct {
	pool *pgxpool.Pool
}

func NewDeviceRepository(pool *pgxpool.Pool) *DeviceRepository {
	return &DeviceRepository{pool: pool}
}

func (r *DeviceRepository) List(ctx context.Context) ([]device.Device, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, name, ip_address::text, device_type, vendor, model, location, description,
		       status, data_source, is_active, last_checked_at, created_at, updated_at
		FROM devices
		ORDER BY id
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]device.Device, 0)
	for rows.Next() {
		item, err := scanDevice(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}

	return items, rows.Err()
}

func (r *DeviceRepository) GetByID(ctx context.Context, id int64) (device.Device, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT id, name, ip_address::text, device_type, vendor, model, location, description,
		       status, data_source, is_active, last_checked_at, created_at, updated_at
		FROM devices
		WHERE id = $1
	`, id)

	item, err := scanDevice(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return device.Device{}, ErrNotFound
		}
		return device.Device{}, err
	}

	return item, nil
}

func (r *DeviceRepository) Count(ctx context.Context) (int64, error) {
	var count int64
	if err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM devices`).Scan(&count); err != nil {
		return 0, err
	}
	return count, nil
}

func (r *DeviceRepository) Create(ctx context.Context, item device.Device) (device.Device, error) {
	var lastCheckedAt *time.Time
	if !item.LastCheckedAt.IsZero() {
		lastCheckedAt = &item.LastCheckedAt
	}

	row := r.pool.QueryRow(ctx, `
		INSERT INTO devices (
			name, ip_address, device_type, vendor, model, location, description,
			status, data_source, is_active, last_checked_at
		)
		VALUES ($1, $2::inet, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id, name, ip_address::text, device_type, vendor, model, location, description,
		          status, data_source, is_active, last_checked_at, created_at, updated_at
	`,
		item.Name, item.IPAddress, item.DeviceType, item.Vendor, item.Model, item.Location, item.Description,
		item.Status, item.DataSource, item.IsActive, lastCheckedAt,
	)

	created, err := scanDevice(row)
	if err != nil {
		return device.Device{}, err
	}

	return created, nil
}

func (r *DeviceRepository) Update(ctx context.Context, item device.Device) (device.Device, error) {
	var lastCheckedAt *time.Time
	if !item.LastCheckedAt.IsZero() {
		lastCheckedAt = &item.LastCheckedAt
	}

	row := r.pool.QueryRow(ctx, `
		UPDATE devices
		SET name = $2,
		    ip_address = $3::inet,
		    device_type = $4,
		    vendor = $5,
		    model = $6,
		    location = $7,
		    description = $8,
		    status = $9,
		    data_source = $10,
		    is_active = $11,
		    last_checked_at = $12,
		    updated_at = NOW()
		WHERE id = $1
		RETURNING id, name, ip_address::text, device_type, vendor, model, location, description,
		          status, data_source, is_active, last_checked_at, created_at, updated_at
	`,
		item.ID, item.Name, item.IPAddress, item.DeviceType, item.Vendor, item.Model, item.Location,
		item.Description, item.Status, item.DataSource, item.IsActive, lastCheckedAt,
	)

	updated, err := scanDevice(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return device.Device{}, ErrNotFound
		}
		return device.Device{}, err
	}

	return updated, nil
}

func (r *DeviceRepository) Delete(ctx context.Context, id int64) error {
	commandTag, err := r.pool.Exec(ctx, `DELETE FROM devices WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if commandTag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

type deviceScanner interface {
	Scan(dest ...any) error
}

func scanDevice(scanner deviceScanner) (device.Device, error) {
	var item device.Device
	var lastCheckedAt *time.Time

	err := scanner.Scan(
		&item.ID,
		&item.Name,
		&item.IPAddress,
		&item.DeviceType,
		&item.Vendor,
		&item.Model,
		&item.Location,
		&item.Description,
		&item.Status,
		&item.DataSource,
		&item.IsActive,
		&lastCheckedAt,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		return device.Device{}, err
	}

	if lastCheckedAt != nil {
		item.LastCheckedAt = *lastCheckedAt
	}

	return item, nil
}
