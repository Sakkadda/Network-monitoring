package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sakkada/network-monitoring-system/internal/domain/user"
)

type UserRepository struct {
	pool *pgxpool.Pool
}

func NewUserRepository(pool *pgxpool.Pool) *UserRepository {
	return &UserRepository{pool: pool}
}

func (r *UserRepository) List(ctx context.Context) ([]user.User, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, username, password_hash, role, display_name, preferred_language, start_tab, created_at, updated_at
		FROM users
		ORDER BY username
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]user.User, 0)
	for rows.Next() {
		item, err := scanUser(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}

	return items, rows.Err()
}

func (r *UserRepository) GetByUsername(ctx context.Context, username string) (user.User, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT id, username, password_hash, role, display_name, preferred_language, start_tab, created_at, updated_at
		FROM users
		WHERE username = $1
	`, username)

	item, err := scanUser(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return user.User{}, ErrNotFound
		}
		return user.User{}, err
	}

	return item, nil
}

func (r *UserRepository) Create(ctx context.Context, item user.User) (user.User, error) {
	row := r.pool.QueryRow(ctx, `
		INSERT INTO users (username, password_hash, role, display_name, preferred_language, start_tab)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, username, password_hash, role, display_name, preferred_language, start_tab, created_at, updated_at
	`, item.Username, item.PasswordHash, item.Role, item.DisplayName, item.PreferredLanguage, item.StartTab)

	created, err := scanUser(row)
	if err != nil {
		return user.User{}, err
	}

	return created, nil
}

func (r *UserRepository) Update(ctx context.Context, item user.User) (user.User, error) {
	row := r.pool.QueryRow(ctx, `
		UPDATE users
		SET role = $2,
		    display_name = $3,
		    preferred_language = $4,
		    start_tab = $5,
		    updated_at = NOW()
		WHERE username = $1
		RETURNING id, username, password_hash, role, display_name, preferred_language, start_tab, created_at, updated_at
	`, item.Username, item.Role, item.DisplayName, item.PreferredLanguage, item.StartTab)

	updated, err := scanUser(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return user.User{}, ErrNotFound
		}
		return user.User{}, err
	}

	return updated, nil
}

func (r *UserRepository) UpdateProfile(ctx context.Context, item user.User) (user.User, error) {
	row := r.pool.QueryRow(ctx, `
		UPDATE users
		SET display_name = $2,
		    preferred_language = $3,
		    start_tab = $4,
		    updated_at = NOW()
		WHERE username = $1
		RETURNING id, username, password_hash, role, display_name, preferred_language, start_tab, created_at, updated_at
	`, item.Username, item.DisplayName, item.PreferredLanguage, item.StartTab)

	updated, err := scanUser(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return user.User{}, ErrNotFound
		}
		return user.User{}, err
	}

	return updated, nil
}

func (r *UserRepository) UpdatePassword(ctx context.Context, username string, passwordHash string) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE users
		SET password_hash = $2,
		    updated_at = NOW()
		WHERE username = $1
	`, username, passwordHash)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *UserRepository) Delete(ctx context.Context, username string) error {
	tag, err := r.pool.Exec(ctx, `DELETE FROM users WHERE username = $1`, username)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

type userScanner interface {
	Scan(dest ...any) error
}

func scanUser(scanner userScanner) (user.User, error) {
	var item user.User

	err := scanner.Scan(
		&item.ID,
		&item.Username,
		&item.PasswordHash,
		&item.Role,
		&item.DisplayName,
		&item.PreferredLanguage,
		&item.StartTab,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		return user.User{}, err
	}

	return item, nil
}
