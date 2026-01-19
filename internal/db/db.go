package db

import (
	"context"
	"fmt"
	"os"
	"sync"

	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	Pool *pgxpool.Pool
	once sync.Once
)

// Connect initializes the database connection pool
func Connect() error {
	var err error
	once.Do(func() {
		dbUrl := os.Getenv("DATABASE_URL")
		if dbUrl == "" {
			err = fmt.Errorf("DATABASE_URL is not set")
			return
		}

		config, parseErr := pgxpool.ParseConfig(dbUrl)
		if parseErr != nil {
			err = fmt.Errorf("unable to parse database config: %v", parseErr)
			return
		}

		Pool, err = pgxpool.NewWithConfig(context.Background(), config)
		if err != nil {
			err = fmt.Errorf("unable to create connection pool: %v", err)
			return
		}

		// Verify connection
		if pingErr := Pool.Ping(context.Background()); pingErr != nil {
			err = fmt.Errorf("unable to ping database: %v", pingErr)
			return
		}
		
		fmt.Println("Successfully connected to the database!")
	})

	return err
}

// Close closes the database connection pool
func Close() {
	if Pool != nil {
		Pool.Close()
	}
}
