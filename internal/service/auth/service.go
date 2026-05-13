package auth

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/sakkada/network-monitoring-system/internal/domain/user"
	"github.com/sakkada/network-monitoring-system/internal/dto"
	postgresrepo "github.com/sakkada/network-monitoring-system/internal/repository/postgres"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrUnauthorized       = errors.New("unauthorized")
	ErrForbidden          = errors.New("forbidden")
	ErrUserNotFound       = errors.New("user not found")
	ErrUserAlreadyExists  = errors.New("user already exists")
	ErrCannotDeleteSelf   = errors.New("cannot delete the currently authenticated user")
)

type Repository interface {
	List(ctx context.Context) ([]user.User, error)
	GetByUsername(ctx context.Context, username string) (user.User, error)
	Create(ctx context.Context, item user.User) (user.User, error)
	Update(ctx context.Context, item user.User) (user.User, error)
	UpdateProfile(ctx context.Context, item user.User) (user.User, error)
	UpdatePassword(ctx context.Context, username string, passwordHash string) error
	Delete(ctx context.Context, username string) error
}

type TokenClaims struct {
	Username string    `json:"username"`
	Role     user.Role `json:"role"`
	Expires  int64     `json:"exp"`
}

type SeedUser struct {
	Username          string
	Password          string
	Role              user.Role
	DisplayName       string
	PreferredLanguage user.PreferredLanguage
	StartTab          user.StartTab
}

type Service struct {
	repository Repository
	secret     []byte
	tokenTTL   time.Duration
}

func NewService(repository Repository, secret string, tokenTTL time.Duration) *Service {
	if tokenTTL <= 0 {
		tokenTTL = 24 * time.Hour
	}

	return &Service{
		repository: repository,
		secret:     []byte(secret),
		tokenTTL:   tokenTTL,
	}
}

func (s *Service) EnsureDefaultUsers(users []SeedUser) error {
	for _, item := range users {
		_, err := s.repository.GetByUsername(context.Background(), item.Username)
		if err == nil {
			continue
		}
		if !errors.Is(err, postgresrepo.ErrNotFound) {
			return err
		}

		passwordHash, hashErr := hashPassword(item.Password)
		if hashErr != nil {
			return hashErr
		}

		_, createErr := s.repository.Create(context.Background(), user.User{
			Username:          strings.TrimSpace(item.Username),
			PasswordHash:      passwordHash,
			Role:              normalizeRole(item.Role),
			DisplayName:       item.DisplayName,
			PreferredLanguage: normalizeLanguage(item.PreferredLanguage),
			StartTab:          normalizeStartTab(item.StartTab, normalizeRole(item.Role)),
		})
		if createErr != nil {
			return createErr
		}
	}

	return nil
}

func (s *Service) Authenticate(input dto.LoginRequest) (dto.LoginResponse, error) {
	item, err := s.repository.GetByUsername(context.Background(), strings.TrimSpace(input.Username))
	if err != nil {
		if errors.Is(err, postgresrepo.ErrNotFound) {
			return dto.LoginResponse{}, ErrInvalidCredentials
		}
		return dto.LoginResponse{}, err
	}

	if bcrypt.CompareHashAndPassword([]byte(item.PasswordHash), []byte(input.Password)) != nil {
		return dto.LoginResponse{}, ErrInvalidCredentials
	}

	token, err := s.issueToken(item)
	if err != nil {
		return dto.LoginResponse{}, err
	}

	return dto.LoginResponse{
		Token: token,
		User:  toAuthUserResponse(item),
	}, nil
}

func (s *Service) VerifyToken(token string) (TokenClaims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return TokenClaims{}, ErrUnauthorized
	}

	payloadPart := parts[0]
	signaturePart := parts[1]

	expectedSignature := signTokenPayload(payloadPart, s.secret)
	if !hmac.Equal([]byte(signaturePart), []byte(expectedSignature)) {
		return TokenClaims{}, ErrUnauthorized
	}

	payloadBytes, err := base64.RawURLEncoding.DecodeString(payloadPart)
	if err != nil {
		return TokenClaims{}, ErrUnauthorized
	}

	var claims TokenClaims
	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		return TokenClaims{}, ErrUnauthorized
	}

	if claims.Username == "" || claims.Expires <= time.Now().UTC().Unix() {
		return TokenClaims{}, ErrUnauthorized
	}

	return claims, nil
}

func (s *Service) GetByUsername(username string) (user.User, error) {
	item, err := s.repository.GetByUsername(context.Background(), username)
	if err != nil {
		if errors.Is(err, postgresrepo.ErrNotFound) {
			return user.User{}, ErrUserNotFound
		}
		return user.User{}, err
	}

	return item, nil
}

func (s *Service) GetCurrentUser(claims TokenClaims) (dto.AuthUserResponse, error) {
	item, err := s.GetByUsername(claims.Username)
	if err != nil {
		return dto.AuthUserResponse{}, err
	}

	return toAuthUserResponse(item), nil
}

func (s *Service) GetUser(username string) (dto.AuthUserResponse, error) {
	item, err := s.GetByUsername(strings.TrimSpace(username))
	if err != nil {
		return dto.AuthUserResponse{}, err
	}

	return toAuthUserResponse(item), nil
}

func (s *Service) ListUsers() ([]dto.AuthUserResponse, error) {
	items, err := s.repository.List(context.Background())
	if err != nil {
		return nil, err
	}

	result := make([]dto.AuthUserResponse, 0, len(items))
	for _, item := range items {
		result = append(result, toAuthUserResponse(item))
	}

	return result, nil
}

func (s *Service) CreateUser(input dto.CreateUserRequest) (dto.AuthUserResponse, error) {
	username := strings.TrimSpace(input.Username)

	if _, err := s.repository.GetByUsername(context.Background(), username); err == nil {
		return dto.AuthUserResponse{}, ErrUserAlreadyExists
	} else if !errors.Is(err, postgresrepo.ErrNotFound) {
		return dto.AuthUserResponse{}, err
	}

	passwordHash, err := hashPassword(input.Password)
	if err != nil {
		return dto.AuthUserResponse{}, err
	}

	displayName := strings.TrimSpace(input.DisplayName)
	if displayName == "" {
		displayName = username
	}

	created, err := s.repository.Create(context.Background(), user.User{
		Username:          username,
		PasswordHash:      passwordHash,
		Role:              normalizeRole(input.Role),
		DisplayName:       displayName,
		PreferredLanguage: normalizeLanguage(input.PreferredLanguage),
		StartTab:          normalizeStartTab(input.StartTab, normalizeRole(input.Role)),
	})
	if err != nil {
		return dto.AuthUserResponse{}, err
	}

	return toAuthUserResponse(created), nil
}

func (s *Service) UpdateUser(username string, input dto.UpdateUserRequest) (dto.AuthUserResponse, error) {
	current, err := s.GetByUsername(strings.TrimSpace(username))
	if err != nil {
		return dto.AuthUserResponse{}, err
	}

	role := normalizeRole(input.Role)
	displayName := strings.TrimSpace(input.DisplayName)
	if displayName == "" {
		displayName = current.Username
	}

	updated, err := s.repository.Update(context.Background(), user.User{
		Username:          current.Username,
		Role:              role,
		DisplayName:       displayName,
		PreferredLanguage: normalizeLanguageOrFallback(input.PreferredLanguage, current.PreferredLanguage),
		StartTab:          normalizeStartTabOrFallback(input.StartTab, role, current.StartTab),
	})
	if err != nil {
		if errors.Is(err, postgresrepo.ErrNotFound) {
			return dto.AuthUserResponse{}, ErrUserNotFound
		}
		return dto.AuthUserResponse{}, err
	}

	return toAuthUserResponse(updated), nil
}

func (s *Service) UpdateOwnProfile(username string, input dto.UpdateOwnProfileRequest, role user.Role) (dto.AuthUserResponse, error) {
	current, err := s.GetByUsername(username)
	if err != nil {
		return dto.AuthUserResponse{}, err
	}

	displayName := strings.TrimSpace(input.DisplayName)
	if displayName == "" {
		displayName = current.DisplayName
	}

	updated, err := s.repository.UpdateProfile(context.Background(), user.User{
		Username:          current.Username,
		DisplayName:       displayName,
		PreferredLanguage: normalizeLanguageOrFallback(input.PreferredLanguage, current.PreferredLanguage),
		StartTab:          normalizeStartTabOrFallback(input.StartTab, role, current.StartTab),
	})
	if err != nil {
		if errors.Is(err, postgresrepo.ErrNotFound) {
			return dto.AuthUserResponse{}, ErrUserNotFound
		}
		return dto.AuthUserResponse{}, err
	}

	return toAuthUserResponse(updated), nil
}

func (s *Service) UpdatePassword(username string, newPassword string) error {
	passwordHash, err := hashPassword(newPassword)
	if err != nil {
		return err
	}

	err = s.repository.UpdatePassword(context.Background(), username, passwordHash)
	if err != nil {
		if errors.Is(err, postgresrepo.ErrNotFound) {
			return ErrUserNotFound
		}
		return err
	}

	return nil
}

func (s *Service) DeleteUser(username string, actorUsername string) error {
	if strings.EqualFold(strings.TrimSpace(username), strings.TrimSpace(actorUsername)) {
		return ErrCannotDeleteSelf
	}

	err := s.repository.Delete(context.Background(), username)
	if err != nil {
		if errors.Is(err, postgresrepo.ErrNotFound) {
			return ErrUserNotFound
		}
		return err
	}

	return nil
}

func (s *Service) issueToken(item user.User) (string, error) {
	claims := TokenClaims{
		Username: item.Username,
		Role:     item.Role,
		Expires:  time.Now().UTC().Add(s.tokenTTL).Unix(),
	}

	payloadBytes, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}

	payloadPart := base64.RawURLEncoding.EncodeToString(payloadBytes)
	signaturePart := signTokenPayload(payloadPart, s.secret)

	return fmt.Sprintf("%s.%s", payloadPart, signaturePart), nil
}

func signTokenPayload(payload string, secret []byte) string {
	mac := hmac.New(sha256.New, secret)
	_, _ = mac.Write([]byte(payload))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func hashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}

	return string(hash), nil
}

func toAuthUserResponse(item user.User) dto.AuthUserResponse {
	displayName := strings.TrimSpace(item.DisplayName)
	if displayName == "" {
		displayName = item.Username
	}

	return dto.AuthUserResponse{
		Username:          item.Username,
		Role:              item.Role,
		DisplayName:       displayName,
		PreferredLanguage: normalizeLanguageOrFallback(item.PreferredLanguage, user.LanguageRU),
		StartTab:          normalizeStartTabOrFallback(item.StartTab, item.Role, user.StartTabDashboard),
	}
}

func normalizeRole(value user.Role) user.Role {
	if value == user.RoleAdmin {
		return user.RoleAdmin
	}
	return user.RoleUser
}

func normalizeLanguage(value user.PreferredLanguage) user.PreferredLanguage {
	if value == user.LanguageEN {
		return user.LanguageEN
	}
	return user.LanguageRU
}

func normalizeLanguageOrFallback(value user.PreferredLanguage, fallback user.PreferredLanguage) user.PreferredLanguage {
	if value == "" {
		return normalizeLanguage(fallback)
	}
	return normalizeLanguage(value)
}

func normalizeStartTab(value user.StartTab, role user.Role) user.StartTab {
	switch value {
	case user.StartTabDashboard, user.StartTabStatus, user.StartTabDevices, user.StartTabMetrics, user.StartTabSettings:
		return value
	case user.StartTabLogs:
		if role == user.RoleAdmin {
			return value
		}
	}
	return user.StartTabDashboard
}

func normalizeStartTabOrFallback(value user.StartTab, role user.Role, fallback user.StartTab) user.StartTab {
	if value == "" {
		return normalizeStartTab(fallback, role)
	}
	return normalizeStartTab(value, role)
}
