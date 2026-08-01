# Daily Story

![Daily Story with Quiz](/assets/screenshot.png)

Visit this page every day to practice reading a story in the language you're learning. The story you'll see will fit your skill level, so you can confidently get practice without being overwhelmed. Three practice questions will also be available to test whether or not you understand the story.

## How It Works

Every day at midnight, a new set of stories will be generated for supported languages and stored in a `stories` folder. When accessing the page `/:language/:level`, the story for the day is fetch and rendered. The stories and questions are generated with a LLM.

Supported languages right now include English, Spanish, French, German, Italian, Portuguese, Chinese, and Japanese. Stories are generated for the A1, A2, B1, and B2 levels.

## Running On Your Machine

You must have an active API Key from Anthropic for this to work. Node.js is required to run the app. A Postgres database is also required. Both the app and the database can be spun up with Docker for convenience. Any Postgres instance works, including one installed directly on your machine, as long as `DATABASE_URL` points to it and `database/setup.sql` has been applied.

### Environment Variables

Set these in a `.env` file at the project root (gitignored).

| Name              |                     Description                      |                                           Example |
| :---------------- | :--------------------------------------------------: | ------------------------------------------------: |
| ANTHROPIC_API_KEY |                 API key for Claude.                  |                                 anthropic-api-key |
| DATABASE_URL      |    Postgres connection string for user accounts.     | postgres://db:password@localhost:5432/daily_story |
| POSTGRES_USER     |    Postgres username (must match `DATABASE_URL`).    |                                                db |
| POSTGRES_PASSWORD |    Postgres password (must match `DATABASE_URL`).    |                                          password |
| POSTGRES_DB       | Postgres database name (must match `DATABASE_URL`).  |                                       daily_story |
| SESSION_SECRET    |         Secret used to sign session cookies.         |                               a-long-random-value |
| PORT              | Port the app listens on. Optional, defaults to 3000. |                                              3000 |

`POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` are only read by Docker Compose, to configure the `daily-story-db` container — they're not needed if you're pointing `DATABASE_URL` at a Postgres instance you're running yourself.

### Option 1: Full stack with Docker Compose

The simplest way to run everything — the app and Postgres — together:

```
make up
```

This builds and starts both containers (equivalent to `docker compose up --build`), applying `database/setup.sql` automatically on the database's first init. The app is available at `http://localhost:3000` (or whichever `PORT` you set). Stop everything with:

```
make down
```

### Option 2: Local Node process + separate database

Better for active development, since `npm run dev` hot-reloads on file changes. The app just needs a reachable Postgres database — how you run one is up to you.

To run Postgres in a container, start just the database:

```
make db-up
```

(Or, if you'd rather not use Docker at all, install Postgres yourself and apply the schema with `psql "$DATABASE_URL" -f database/setup.sql`.)

Then install dependencies and run the app locally:

```
npm install
npm run dev
```

If you used `make db-up`, stop the database when you're done:

```
make db-down
```

### Production Build

To run as a production app, build the project and run from the compiled `dist` folder:

```
npm install
npm run build
npm start
```
