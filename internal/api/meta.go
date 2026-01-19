package api

import (
	"baas/internal/db"

	"github.com/gofiber/fiber/v2"
)

// GetTablesHandler lists all tables in a project schema
func GetTablesHandler(c *fiber.Ctx) error {
	project := c.Params("project")

	query := `
		SELECT table_name 
		FROM information_schema.tables 
		WHERE table_schema = $1 AND table_type = 'BASE TABLE'
	`

	rows, err := db.Pool.Query(c.Context(), query, project)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	var tables []string
	for rows.Next() {
		var t string
		if err := rows.Scan(&t); err == nil {
			tables = append(tables, t)
		}
	}
	return c.JSON(tables)
}

// GetTableSchemaHandler returns columns for a table
func GetTableSchemaHandler(c *fiber.Ctx) error {
	project := c.Params("project")
	table := c.Params("table")

	query := `
		SELECT column_name, data_type, is_nullable, column_default
		FROM information_schema.columns 
		WHERE table_schema = $1 AND table_name = $2
		ORDER BY ordinal_position
	`

	rows, err := db.Pool.Query(c.Context(), query, project, table)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	type Column struct {
		Name     string  `json:"name"`
		Type     string  `json:"type"`
		Nullable string  `json:"nullable"`
		Default  *string `json:"default"`
	}

	var columns []Column
	for rows.Next() {
		var c Column
		if err := rows.Scan(&c.Name, &c.Type, &c.Nullable, &c.Default); err == nil {
			columns = append(columns, c)
		}
	}
	return c.JSON(columns)
}
