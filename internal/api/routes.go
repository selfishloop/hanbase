package api

import (
	"fmt"
	"strings"

	"baas/internal/db"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
)

// DynamicHandler handles generic CRUD operations for any table
func DynamicHandler(c *fiber.Ctx) error {
	projectID := c.Params("project") // This will be the schema name usually
	tableName := c.Params("table")
	method := c.Method()

	// Security: Validating schema/table names
	if !isValidIdentifier(projectID) || !isValidIdentifier(tableName) {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid project or table name"})
	}

	fullTableName := fmt.Sprintf("%s.%s", projectID, tableName)

	switch method {
	case "GET":
		return handleList(c, fullTableName)
	case "POST":
		return handleCreate(c, fullTableName)
	case "PUT":
		return handleUpdate(c, fullTableName)
	case "DELETE":
		return handleDelete(c, fullTableName)
	default:
		return c.Status(405).JSON(fiber.Map{"error": "Method not allowed"})
	}
}

func handleList(c *fiber.Ctx, fullTableName string) error {
	// Query params for simple filtering: ?id=eq.1 or ?name=eq.John
	// For MVP, we pass everything as SELECT * for now.
	query := fmt.Sprintf("SELECT json_agg(t) FROM (SELECT * FROM %s LIMIT 100) t", fullTableName)

	var result []byte
	err := db.Pool.QueryRow(c.Context(), query).Scan(&result)

	if err != nil {
		if err == pgx.ErrNoRows {
			return c.JSON([]interface{}{})
		}
		// If table doesn't exist, Postgres returns specific error code, but for now 500
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	c.Set("Content-Type", "application/json")
	return c.Send(result)
}

func handleCreate(c *fiber.Ctx, fullTableName string) error {
	var body map[string]interface{}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid JSON"})
	}

	if len(body) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Empty body"})
	}

	columns := []string{}
	values := []interface{}{}
	placeholders := []string{}
	i := 1

	for k, v := range body {
		if !isValidIdentifier(k) {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid column name"})
		}
		columns = append(columns, k)
		values = append(values, v)
		placeholders = append(placeholders, fmt.Sprintf("$%d", i))
		i++
	}

	query := fmt.Sprintf(
		"INSERT INTO %s (%s) VALUES (%s) RETURNING to_jsonb(%s.*)",
		fullTableName,
		strings.Join(columns, ", "),
		strings.Join(placeholders, ", "),
		fullTableName,
	)

	var result []byte
	err := db.Pool.QueryRow(c.Context(), query, values...).Scan(&result)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	c.Set("Content-Type", "application/json")
	return c.Send(result)
}

func handleUpdate(c *fiber.Ctx, fullTableName string) error {
	// Ideally we need an ID to update.
	// Convention: Query params MUST specify the ID like ?id=1.
	// For simplicity, let's assume body contains "id" or user passes ?id=...
	// AND assumes there is an 'id' column.

	id := c.Query("id")
	if id == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Missing 'id' query parameter for update"})
	}

	var body map[string]interface{}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid JSON"})
	}

	updates := []string{}
	values := []interface{}{}
	i := 1

	for k, v := range body {
		if !isValidIdentifier(k) {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid column name"})
		}
		updates = append(updates, fmt.Sprintf("%s = $%d", k, i))
		values = append(values, v)
		i++
	}

	// Append ID as last value
	values = append(values, id)

	query := fmt.Sprintf(
		"UPDATE %s SET %s WHERE id = $%d RETURNING to_jsonb(%s.*)",
		fullTableName,
		strings.Join(updates, ", "),
		i, // The ID placeholder index
		fullTableName,
	)

	var result []byte
	err := db.Pool.QueryRow(c.Context(), query, values...).Scan(&result)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	c.Set("Content-Type", "application/json")
	return c.Send(result)
}

func handleDelete(c *fiber.Ctx, fullTableName string) error {
	id := c.Query("id")
	if id == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Missing 'id' query parameter for delete"})
	}

	// Warning: This assumes 'id' column is integer or text that matches parameter
	query := fmt.Sprintf("DELETE FROM %s WHERE id = $1 RETURNING to_jsonb(%s.*)", fullTableName, fullTableName)

	var result []byte
	err := db.Pool.QueryRow(c.Context(), query, id).Scan(&result)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	c.Set("Content-Type", "application/json")
	return c.Send(result)
}

func isValidIdentifier(s string) bool {
	for _, r := range s {
		if (r < 'a' || r > 'z') && (r < 'A' || r > 'Z') && (r < '0' || r > '9') && r != '_' {
			return false
		}
	}
	return true
}
