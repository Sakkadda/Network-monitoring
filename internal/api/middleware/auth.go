package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/sakkada/network-monitoring-system/internal/domain/user"
	authsvc "github.com/sakkada/network-monitoring-system/internal/service/auth"
)

const principalContextKey = "authPrincipal"

type Principal struct {
	Username string
	Role     user.Role
}

func Authenticate(authService *authsvc.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := strings.TrimSpace(c.GetHeader("Authorization"))
		if !strings.HasPrefix(strings.ToLower(header), "bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authorization token is required"})
			return
		}

		token := strings.TrimSpace(header[len("Bearer "):])
		claims, err := authService.VerifyToken(token)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization token"})
			return
		}

		c.Set(principalContextKey, Principal{
			Username: claims.Username,
			Role:     claims.Role,
		})
		c.Next()
	}
}

func RequireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		principal, ok := GetPrincipal(c)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		if principal.Role != user.RoleAdmin {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "admin access is required"})
			return
		}
		c.Next()
	}
}

func GetPrincipal(c *gin.Context) (Principal, bool) {
	value, ok := c.Get(principalContextKey)
	if !ok {
		return Principal{}, false
	}

	principal, ok := value.(Principal)
	return principal, ok
}
