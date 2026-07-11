DB_SERVICE := daily-story-db

.PHONY: db-up db-down

# Start the Postgres database container (uses the db-data volume).
db-up:
	docker compose up -d $(DB_SERVICE) --build

# Stop and remove the database container (keeps the db-data volume).
db-down:
	docker compose rm -sf $(DB_SERVICE)
