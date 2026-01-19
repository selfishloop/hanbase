package api

import (
	"baas/internal/db"

	"github.com/gofiber/fiber/v2"
)

// RunSQLHandler executes raw SQL queries.
// Start with high privilege (Admin/Owner only).
func RunSQLHandler(c *fiber.Ctx) error {
	type Request struct {
		Query string `json:"query"`
	}
	var req Request
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.Query == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Query is required"})
	}

	// Execute with pgx
	// Using Query (not Exec) to return results if it's a SELECT
	rows, err := db.Pool.Query(c.Context(), req.Query)
	if err != nil {
		// Return the PG error directly (useful for SQL editor feedback)
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	// Parse results into generic map
	results := []map[string]interface{}{}

	// Get column descriptions
	fieldDescriptions := rows.FieldDescriptions()

	for rows.Next() {
		// pgx dynamic scanning is a bit tricky, we need to scan into generic values
		values, err := rows.Values()
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}

		rowMap := make(map[string]interface{})
		for i, field := range fieldDescriptions {
			rowMap[string(field.Name)] = values[i]
		}
		results = append(results, rowMap)
	}

	return c.JSON(results)
}
