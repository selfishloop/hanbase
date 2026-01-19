package realtime

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"

	"baas/internal/db"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
)

// Hub manages clients and broadcasts messages
type Hub struct {
	// Registered clients map[ProjectID]map[*Client]bool
	clients    map[string]map[*Client]bool
	register   chan *Client
	unregister chan *Client
	broadcast  chan Message
	mu         sync.RWMutex
}

type Client struct {
	Hub       *Hub
	Conn      *websocket.Conn
	ProjectID string
	Send      chan []byte
}

type Message struct {
	ProjectID string
	Payload   []byte
}

var MainHub = &Hub{
	clients:    make(map[string]map[*Client]bool),
	register:   make(chan *Client),
	unregister: make(chan *Client),
	broadcast:  make(chan Message),
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			if _, ok := h.clients[client.ProjectID]; !ok {
				h.clients[client.ProjectID] = make(map[*Client]bool)
			}
			h.clients[client.ProjectID][client] = true
			h.mu.Unlock()

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client.ProjectID]; ok {
				if _, ok := h.clients[client.ProjectID][client]; ok {
					delete(h.clients[client.ProjectID], client)
					close(client.Send)
				}
			}
			h.mu.Unlock()

		case message := <-h.broadcast:
			h.mu.RLock()
			if clients, ok := h.clients[message.ProjectID]; ok {
				for client := range clients {
					select {
					case client.Send <- message.Payload:
					default:
						close(client.Send)
						delete(clients, client)
					}
				}
			}
			h.mu.RUnlock()
		}
	}
}

// ListenToPostgres listens for NOTIFY events from the database
func ListenToPostgres() {
	conn, err := db.Pool.Acquire(context.Background())
	if err != nil {
		log.Fatalf("Error acquiring connection for listener: %v\n", err)
	}
	defer conn.Release()

	// Listen to a global channel or per-project channels
	// For MVP, we listen to a global 'db_events' channel
	_, err = conn.Conn().Exec(context.Background(), "LISTEN db_events")
	if err != nil {
		log.Fatalf("Error listening to postgres channel: %v\n", err)
	}

	fmt.Println("Realtime: Listening for Postgres events...")

	for {
		notification, err := conn.Conn().WaitForNotification(context.Background())
		if err != nil {
			log.Println("Error waiting for notification:", err)
			continue
		}

		// Parse notification to get ProjectID (schema)
		// Assuming payload format: {"schema": "project_xyz", "table": "users", "data": {...}}
		var payload map[string]interface{}
		if err := json.Unmarshal([]byte(notification.Payload), &payload); err != nil {
			log.Println("Error parsing notification payload:", err)
			continue
		}

		projectID, ok := payload["schema"].(string)
		if !ok {
			// fallback or ignore
			continue
		}

		MainHub.broadcast <- Message{
			ProjectID: projectID,
			Payload:   []byte(notification.Payload),
		}
	}
}

// WebSocketHandler upgrades the connection
func WebSocketHandler(c *fiber.Ctx) error {
	if websocket.IsWebSocketUpgrade(c) {
		c.Locals("allowed", true)
		return c.Next()
	}
	return fiber.ErrUpgradeRequired
}

// RealtimeEndpoint handles the websocket connection
func RealtimeEndpoint(c *websocket.Conn) {
	projectID := c.Params("project") // /ws/:project

	client := &Client{
		Hub:       MainHub,
		Conn:      c,
		ProjectID: projectID,
		Send:      make(chan []byte, 256),
	}

	client.Hub.register <- client

	// Write Pump
	go func() {
		defer func() {
			client.Hub.unregister <- client
			client.Conn.Close()
		}()
		for {
			message, ok := <-client.Send
			if !ok {
				return
			}
			if err := client.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}
		}
	}()

	// Read Pump (Keep alive)
	for {
		_, _, err := c.ReadMessage()
		if err != nil {
			client.Hub.unregister <- client
			client.Conn.Close()
			break
		}
	}
}
