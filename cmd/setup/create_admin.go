package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/jackc/pgx/v5"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	_ = godotenv.Load()
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		// Fallback for docker setup if not in .env yet
		dbURL = "postgres://postgres:bn19ka3a@localhost:5432/baas_db"
	}

	conn, err := pgx.Connect(context.Background(), dbURL)
	if err != nil {
		log.Fatalf("Unable to connect to DB: %v", err)
	}
	defer conn.Close(context.Background())

	email := "admin@hunkar.com"
	password := "admin123"

	// Hash password
	hash, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)

	// Upsert Admin User
	_, err = conn.Exec(context.Background(), `
		INSERT INTO baas_system.users (email, password_hash) 
		VALUES ($1, $2)
		ON CONFLICT (email) DO UPDATE 
		SET password_hash = EXCLUDED.password_hash;
	`, email, string(hash))

	if err != nil {
		log.Fatalf("Failed to create admin: %v", err)
	}

	fmt.Printf("✅ Admin User Ready!\nEmail: %s\nPassword: %s\n", email, password)
}
