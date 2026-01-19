package main

import (
	"log"
	"os"

	"baas/internal/admin"
	"baas/internal/api"
	"baas/internal/auth"
	"baas/internal/db"
	"baas/internal/realtime"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env file
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	// Connect to Database
	if err := db.Connect(); err != nil {
		log.Fatalf("Could not connect to database: %v", err)
	}
	defer db.Close()

	// Initialize Fiber App
	app := fiber.New(fiber.Config{
		AppName: "Hanbase",
	})

	// Middleware
	app.Use(logger.New())
	app.Use(cors.New())

	// Routes
	app.Get("/", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":  "success",
			"message": "Hanbase System is Runnning!",
		})
	})

	// Auth Routes (Platform)
	app.Post("/auth/signup", auth.SignUpHandler)
	app.Post("/auth/signin", auth.SignInHandler)

	// Protected Routes (require Bearer token)
	// Admin / Project Management
	app.Post("/projects", auth.Protected(), admin.CreateProjectHandler)
	app.Get("/projects", auth.Protected(), admin.GetProjectsHandler)
	app.Delete("/projects/:slug", auth.Protected(), admin.DeleteProjectHandler)

	// Admin / SQL Editor Route
	// This allows the Dashboard to run "CREATE TABLE", "ALTER TABLE" etc.
	// SECURED: Basic Protected (Platform Admin) for now.
	app.Post("/query", auth.Protected(), api.RunSQLHandler)

	// Metadata Routes (For Table Editor)
	// SECURED: Tenant Protected (Project Access)
	app.Get("/meta/:project/tables", auth.TenantProtected(), api.GetTablesHandler)
	app.Get("/meta/:project/tables/:table", auth.TenantProtected(), api.GetTableSchemaHandler)

	// Admin / User Management Routes (For Dashboard)
	// Note: Ideally these should be protected by Platform Admin token, but targeting a specific project
	// For simplicity, we use Protected() (Platform Admin) since Dashboard uses Platform Token.
	app.Get("/:project/auth/users", auth.Protected(), auth.ListUsersHandler)
	app.Delete("/:project/auth/users/:id", auth.Protected(), auth.DeleteUserHandler)

	// Tenant Auth Routes (For End-Users)
	app.Post("/:project/auth/signup", auth.TenantSignUp)
	app.Post("/:project/auth/signin", auth.TenantSignIn)

	// Dynamic Routes: /:project/:table
	// Note: Project should technically be mapped to a Schema name.
	// For MVP, we treat "project" param directly as Schema Name.
	// SECURED: Now requires a valid Token for the specific project!
	app.All("/:project/:table", auth.TenantProtected(), api.DynamicHandler)

	// Realtime Hub Start
	go realtime.MainHub.Run()
	go realtime.ListenToPostgres()

	// Realtime Routes
	app.Use("/ws", func(c *fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			c.Locals("allowed", true)
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})
	app.Get("/ws/:project", websocket.New(realtime.RealtimeEndpoint))

	// Start Server
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	log.Fatal(app.Listen(":" + port))
}
