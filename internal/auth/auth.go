package auth

import (
	"context"
	"os"
	"time"

	"baas/internal/db"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

var SecretKey = []byte(os.Getenv("JWT_SECRET"))

// SignUpHandler registers a new platform user (admin)
func SignUpHandler(c *fiber.Ctx) error {
	type Request struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	var req Request
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.Email == "" || req.Password == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Email and Password required"})
	}

	// Hash Password
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not hash password"})
	}

	// Insert User
	query := `INSERT INTO baas_system.users (email, password_hash) VALUES ($1, $2) RETURNING id, email`
	var userID string
	var email string
	err = db.Pool.QueryRow(context.Background(), query, req.Email, string(hash)).Scan(&userID, &email)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not create user (email might be taken)"})
	}

	return c.JSON(fiber.Map{"id": userID, "email": email, "message": "User created successfully"})
}

// SignInHandler logs in a user and returns a JWT
func SignInHandler(c *fiber.Ctx) error {
	type Request struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	var req Request
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	// Fetch User
	var id, hash string
	query := `SELECT id, password_hash FROM baas_system.users WHERE email = $1`
	err := db.Pool.QueryRow(context.Background(), query, req.Email).Scan(&id, &hash)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid credentials"})
	}

	// Compare Password
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)); err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid credentials"})
	}

	// Generate JWT
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":  id,
		"role": "admin",
		"exp":  time.Now().Add(time.Hour * 24).Unix(), // 1 day
	})

	t, err := token.SignedString(SecretKey)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not login"})
	}

	return c.JSON(fiber.Map{"token": t})
}

// TenantProtected Middleware: Ensures token belongs to the specific Project
func TenantProtected() fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
		}

		tokenString := ""
		if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
			tokenString = authHeader[7:]
		} else {
			return c.Status(401).JSON(fiber.Map{"error": "Malformed token"})
		}

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			return SecretKey, nil
		})

		if err != nil || !token.Valid {
			return c.Status(401).JSON(fiber.Map{"error": "Invalid or expired token"})
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			return c.Status(401).JSON(fiber.Map{"error": "Invalid token claims"})
		}

		// 1. Check if Platform Admin
		if role, ok := claims["role"].(string); ok && role == "admin" {
			c.Locals("user_id", claims["sub"])
			c.Locals("project_id", c.Params("project"))
			return c.Next()
		}

		// 2. If not admin, check Tenant Audience
		// CRITICAL: Check 'aud' (Audience) claim
		// The audience must match the Project ID requested in the URL
		requestedProject := c.Params("project")
		tokenProject, ok := claims["aud"].(string)

		if !ok || requestedProject != tokenProject {
			return c.Status(403).JSON(fiber.Map{"error": "Access denied: Token not valid for this project"})
		}

		c.Locals("user_id", claims["sub"])
		c.Locals("project_id", tokenProject)

		return c.Next()
	}
}

// Protected Middleware (Platform Admin) - Kept for admin operations
func Protected() fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
		}

		tokenString := ""
		if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
			tokenString = authHeader[7:]
		} else {
			return c.Status(401).JSON(fiber.Map{"error": "Malformed token"})
		}

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			return SecretKey, nil
		})

		if err != nil || !token.Valid {
			return c.Status(401).JSON(fiber.Map{"error": "Invalid or expired token"})
		}

		claims := token.Claims.(jwt.MapClaims)
		c.Locals("user_id", claims["sub"])

		return c.Next()
	}
}
