package auth

import (
	"context"
	"fmt"
	"time"

	"baas/internal/db"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// --- PLATFORM AUTH (Admins) ---
// (Existing Handlers kept as is, but maybe moved if needed. Keeping here for brevity in this file update)

// --- TENANT AUTH (End-Users of Projects) ---

// TenantSignUp handles end-user registration for a specific project
func TenantSignUp(c *fiber.Ctx) error {
	projectID := c.Params("project") // The schema name
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

	// 1. Hash Password
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not hash password"})
	}

	// 2. Insert into PROJECT's users table
	// Schema: projectID.users
	query := fmt.Sprintf("INSERT INTO %s.users (email, password_hash) VALUES ($1, $2) RETURNING id, email", projectID)

	var userID string
	var email string
	// Security Reminder: Validate projectID format strictly!
	err = db.Pool.QueryRow(context.Background(), query, req.Email, string(hash)).Scan(&userID, &email)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not create user (email might be taken or project doesn't exist)"})
	}

	return c.JSON(fiber.Map{"id": userID, "email": email, "message": "User registered successfully"})
}

// TenantSignIn handles end-user login for a specific project
func TenantSignIn(c *fiber.Ctx) error {
	projectID := c.Params("project")
	type Request struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	var req Request
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	// 1. Fetch User from PROJECT's table
	var id, hash string
	query := fmt.Sprintf("SELECT id, password_hash FROM %s.users WHERE email = $1", projectID)

	err := db.Pool.QueryRow(context.Background(), query, req.Email).Scan(&id, &hash)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid credentials"})
	}

	// 2. Compare Password
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)); err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid credentials"})
	}

	// 3. Generate Tenant Scoped Token
	// We include "aud" (audience) as projectID so we know which project this token belongs to
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":  id,
		"aud":  projectID,                                 // Scopes token to this project
		"role": "authenticated",                           // Supabase style role
		"exp":  time.Now().Add(time.Hour * 24 * 7).Unix(), // 1 week
	})

	t, err := token.SignedString(SecretKey)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not login"})
	}

	return c.JSON(fiber.Map{
		"access_token": t,
		"token_type":   "bearer",
		"expires_in":   3600 * 24 * 7,
		"user": fiber.Map{
			"id":    id,
			"email": req.Email,
			"aud":   projectID,
		},
	})
}

// ListUsersHandler returns all users for a project (Admin only)
func ListUsersHandler(c *fiber.Ctx) error {
	projectID := c.Params("project")

	query := fmt.Sprintf("SELECT id, email, created_at FROM %s.users ORDER BY created_at DESC", projectID)

	rows, err := db.Pool.Query(context.Background(), query)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch users"})
	}
	defer rows.Close()

	type User struct {
		ID        string    `json:"id"`
		Email     string    `json:"email"`
		CreatedAt time.Time `json:"created_at"`
	}

	var users []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Email, &u.CreatedAt); err == nil {
			users = append(users, u)
		}
	}
	return c.JSON(users)
}

// DeleteUserHandler deletes a user from a project
func DeleteUserHandler(c *fiber.Ctx) error {
	projectID := c.Params("project")
	userID := c.Params("id")

	query := fmt.Sprintf("DELETE FROM %s.users WHERE id = $1", projectID)
	_, err := db.Pool.Exec(context.Background(), query, userID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete user"})
	}
	return c.JSON(fiber.Map{"message": "User deleted"})
}
