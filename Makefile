DB_SERVICE := daily-story-db

.PHONY: db-up db-down up down

# Start the Postgres database container (uses the db-data volume).
db-up:
	docker compose up -d $(DB_SERVICE) --build

# Stop and remove the database container (keeps the db-data volume).
db-down:
	docker compose rm -sf $(DB_SERVICE)

# Start the whole stack (app + Postgres) via Docker Compose.
up:
	docker compose up --build

# Stop and remove the whole stack (keeps the db-data/stories volumes).
down:
	docker compose down
