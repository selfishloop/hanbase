package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env
	_ = godotenv.Load()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://postgres:password@localhost:5432/baas_db"
	}

	fmt.Println("Target DB URL:", dbURL)

	// Parse URL to get base connection (to 'postgres' db) to create our custom db
	// Assumption: URL format is postgres://user:pass@host:port/dbname
	parts := strings.Split(dbURL, "/")
	dbName := parts[len(parts)-1]
	baseURL := strings.Join(parts[:len(parts)-1], "/") + "/postgres"

	fmt.Println("Connecting to maintenance DB:", baseURL)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 1. Connect to 'postgres' database to check/create 'baas_db'
	conn, err := pgx.Connect(ctx, baseURL)
	if err != nil {
		log.Fatalf("Unable to connect to Postgres system DB: %v\nHint: Check if Docker container is running and port 5432 is exposed.", err)
	}
	defer conn.Close(context.Background())

	// Check if DB exists
	var exists bool
	err = conn.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1)", dbName).Scan(&exists)
	if err != nil {
		log.Fatalf("Failed to check if DB exists: %v", err)
	}

	if !exists {
		fmt.Printf("Database '%s' does not exist. Creating...\n", dbName)
		_, err = conn.Exec(ctx, fmt.Sprintf("CREATE DATABASE %s", dbName))
		if err != nil {
			log.Fatalf("Failed to create database: %v", err)
		}
		fmt.Println("Database created successfully!")
	} else {
		fmt.Printf("Database '%s' already exists.\n", dbName)
	}

	// 2. Connect to the actual 'baas_db'
	fmt.Println("Connecting to application DB:", dbURL)
	appConn, err := pgx.Connect(ctx, dbURL)
	if err != nil {
		log.Fatalf("Unable to connect to Application DB: %v", err)
	}
	defer appConn.Close(context.Background())

	// 3. Read and Apply Schema
	schemaBytes, err := os.ReadFile("system_schema.sql")
	if err != nil {
		log.Fatalf("Could not read system_schema.sql: %v", err)
	}

	fmt.Println("Applying schema...")
	_, err = appConn.Exec(ctx, string(schemaBytes))
	if err != nil {
		log.Fatalf("Failed to apply schema: %v", err)
	}

	fmt.Println("✅ Setup Completed Successfully!")
}
