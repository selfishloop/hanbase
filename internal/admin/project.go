package admin

import (
	"baas/internal/db"
	"context"
	"fmt"

	"github.com/gofiber/fiber/v2"
)

// CreateProjectHandler creates a new tenant (project)
func CreateProjectHandler(c *fiber.Ctx) error {
	type Request struct {
		Name string `json:"name"`
		Slug string `json:"slug"`
	}
	var req Request
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	// 1. Insert into system table
	tx, err := db.Pool.Begin(context.Background())
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "DB error"})
	}
	defer tx.Rollback(context.Background())

	// Validate Slug strictly implies it will be used as a Schema Name
	if !isValidSlug(req.Slug) {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid slug. Only alphanumeric characters and underscores allowed."})
	}

	// Usually you would generate a unique schema name like 'p_<uuid>', but for simplicity we use the slug
	// Ensure slug is safe!
	schemaName := req.Slug

	_, err = tx.Exec(context.Background(),
		"INSERT INTO baas_system.projects (name, slug, db_schema) VALUES ($1, $2, $3)",
		req.Name, req.Slug, schemaName)

	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not create project record: " + err.Error()})
	}

	// 2. Create the Schema in Postgres
	// WARNING: In production, sanitize schemaName strictly!
	_, err = tx.Exec(context.Background(), fmt.Sprintf("CREATE SCHEMA IF NOT EXISTS %s", schemaName))
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not create database schema: " + err.Error()})
	}

	// 3. Initialize Auth Logic for this Tenant (Create users table)
	authTableSQL := fmt.Sprintf(`
		CREATE TABLE IF NOT EXISTS %s.users (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			email TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);
	`, schemaName)

	_, err = tx.Exec(context.Background(), authTableSQL)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not create auth tables: " + err.Error()})
	}

	// Commit
	if err := tx.Commit(context.Background()); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Commit failed"})
	}

	return c.JSON(fiber.Map{"message": "Project created successfully!", "schema": schemaName})
}

// GetProjectsHandler lists all projects
func GetProjectsHandler(c *fiber.Ctx) error {
	rows, err := db.Pool.Query(context.Background(), "SELECT name, slug FROM baas_system.projects ORDER BY created_at DESC")
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "DB error"})
	}
	defer rows.Close()

	type Project struct {
		Name string `json:"name"`
		Slug string `json:"slug"`
	}

	var projects []Project
	for rows.Next() {
		var p Project
		if err := rows.Scan(&p.Name, &p.Slug); err == nil {
			projects = append(projects, p)
		}
	}

	return c.JSON(projects)
}

// DeleteProjectHandler deletes a project and its schema
func DeleteProjectHandler(c *fiber.Ctx) error {
	slug := c.Params("slug")
	if !isValidSlug(slug) {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid slug"})
	}

	tx, err := db.Pool.Begin(context.Background())
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "DB error"})
	}
	defer tx.Rollback(context.Background())

	// 1. Delete from system table
	_, err = tx.Exec(context.Background(), "DELETE FROM baas_system.projects WHERE slug = $1", slug)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete project record"})
	}

	// 2. Drop Schema (CASCADE to delete all tables)
	_, err = tx.Exec(context.Background(), fmt.Sprintf("DROP SCHEMA IF EXISTS %s CASCADE", slug))
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to drop schema"})
	}

	if err := tx.Commit(context.Background()); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Commit failed"})
	}

	return c.JSON(fiber.Map{"message": "Project deleted successfully"})
}

func isValidSlug(s string) bool {
	if len(s) == 0 || len(s) > 63 { // Postgres identifier limit
		return false
	}
	for _, r := range s {
		if (r < 'a' || r > 'z') && (r < 'A' || r > 'Z') && (r < '0' || r > '9') && r != '_' {
			return false
		}
	}
	return true
}
