# Daily Story - AI Context Documentation

## Project Overview

**Daily Story** is a language learning web application that generates personalized daily reading content using Claude AI. Users select a target language and proficiency level, then receive appropriately-leveled stories with comprehension quizzes.

- **Languages Supported:** English, Spanish, French, German, Italian, Portuguese, Chinese, Japanese
- **Proficiency Levels:** A1, A2, B1, B2
- **Key Feature:** AI-generated content using Anthropic's Claude Sonnet 4.5 via Message Batches API

## Tech Stack

- **Runtime:** Node.js with TypeScript (ES2022)
- **Framework:** Express.js 5.1.0
- **Template Engine:** EJS 3.1.10
- **AI Provider:** Anthropic AI SDK 0.68.0 (Claude Sonnet 4.5)
- **Storage:**
  - Stories: file-based JSON (organized by date)
  - User accounts: PostgreSQL 18 (via `pg`)
- **Auth:** `express-session` (cookie sessions) + `bcrypt` (password hashing)
- **Build Tools:** TypeScript, tsx, nodemon, copyfiles
- **Containerization:** Docker + Docker Compose (app + Postgres)
- **Analytics:** PostHog

## Project Structure

```
src/
├── index.ts           # Main Express app (routes, middleware, session setup)
├── storyService.ts    # Story generation service (class-based)
├── themes.ts          # Theme arrays for each proficiency level
├── db.ts              # Shared Postgres connection pool (via DATABASE_URL)
├── models/
│   └── user.ts        # User model (CRUD, bcrypt password hashing)
├── routes/
│   ├── auth.ts        # Signup / login / logout routes + requireAuth middleware
│   ├── util.ts        # Utility/cron routes (/generate-stories)
│   └── story.ts       # Story display route (/:language/:level)
├── types/
│   └── session.d.ts   # express-session augmentation (session.userId)
├── views/             # EJS templates
│   ├── home.ejs       # Language/level selection page (+ login/logout link)
│   ├── story.ejs      # Story display with quiz
│   ├── login.ejs      # Login form
│   ├── signup.ejs     # Signup form
│   ├── no-story-today.ejs
│   └── error.ejs
└── public/css/        # Stylesheets (dark mode support)
    └── auth.css       # Login / signup form styles

database/              # Postgres container + schema
├── Dockerfile         # postgres:18 image, runs setup.sql on first init
└── setup.sql          # users table, indexes, updated_at trigger

stories/               # Generated stories (gitignored)
└── YYYY/MM/DD/{language}/{level}/story.json

Dockerfile             # Multi-stage build for the Node app
docker-compose.yml     # Spins up the app + Postgres together
```

## Key Concepts

### Story Formats by Level

**Early Levels (A1, A2):**

- Format: Conversational (text messages, informal emails)
- Structure: Array of message objects with `text` and `sender`
- Questions: In English (reduce cognitive load)
- Message count: 10+ messages
- Message length: 5-10 words per message

**Intermediate Levels (B1, B2):**

- Format: Conversational (discussions, professional emails, debates)
- Structure: Array of message objects with `text` and `sender`
- Questions: In target language (full immersion)
- Message count: B1 (10-15 exchanges), B2 (12-18 exchanges)
- Complexity: More abstract topics, nuanced language, varied sentence structures

### Story Schema

```typescript
type StoryContent = {
  title: string
  messages: { text: string; sender: string }[] // All levels use conversational format
  questions: {
    question: string
    options: string[] // Always 4 options
    correctAnswer: number // Index (0-3)
  }[] // Always 3 questions
}
```

### File-Based Storage

Stories are stored as JSON files organized by date:

```
stories/2025/11/04/spanish/a1/story.json
```

This architecture allows:

- Date-based "story of the day" concept
- Pre-generation for future dates
- Simple cleanup/archival

Note: story _content_ remains file-based. PostgreSQL is used only for user
accounts (see below), not for stories or quiz results.

### User Accounts (PostgreSQL)

User accounts are stored in PostgreSQL, accessed through a shared connection
pool in `src/db.ts` (configured via `DATABASE_URL`). The schema lives in
`database/setup.sql` and is applied automatically when the DB container is
first initialized.

**`users` table:**

- `id` (BIGINT identity, PK)
- `email` (TEXT, unique; case-insensitive lookups via a `lower(email)` index)
- `hashed_password` (TEXT, bcrypt with cost factor 12)
- `created_at`, `updated_at` (TIMESTAMPTZ; `updated_at` maintained by a trigger)
- `last_logged_in` (TIMESTAMPTZ, nullable)

**`User` model (`src/models/user.ts`):**

- `User.register({ email, password })` — hash password, validate/normalize email, persist
- `User.create({ email, hashedPassword })` — persist a pre-hashed account
- `User.findById(id)` / `User.findByEmail(email)` — load (null if missing)
- `user.verifyPassword(password)` — bcrypt compare
- `user.recordLogin()` — stamp `last_logged_in`
- `user.save()` / `user.delete()` — update / remove

Emails are normalized (trimmed + lowercased) and format-validated before any
write, pairing with the `lower(email)` unique index.

### Authentication & Sessions

- Cookie-based sessions via `express-session` (configured in `src/index.ts`).
  - Currently the default **in-memory** store (drops sessions on restart; swap
    for a persistent store like `connect-pg-simple` before production).
  - Cookie: `httpOnly`, `sameSite: 'lax'`, 30-day `maxAge`.
- `src/types/session.d.ts` augments `SessionData` with `userId?: number`.
- Auth routes in `src/routes/auth.ts`:
  - `GET/POST /signup`, `GET/POST /login`, `POST /logout`
  - Login uses a generic "Invalid email or password" message (no user enumeration)
  - `requireAuth` middleware redirects unauthenticated requests to `/login`
- The home page (`home.ejs`) shows a **Log in** link when logged out and a
  **Sign out** button (POSTs to `/logout`) when logged in, driven by the
  `isLoggedIn` flag passed from the `/` route.

## Important Files

### src/index.ts

Thin entry point that wires the app together:

- Body parsing (`urlencoded` + `json`) and `express-session` setup
- Mounts routers: auth (`routes/auth.ts`), util (`routes/util.ts`), story (`routes/story.ts`)
- Inline page routes: `/` (home, passes `isLoggedIn`) and `/about`
- 404 and 500 error-handling middleware

Route handlers themselves live in `src/routes/`:

- `routes/util.ts` — `/generate-stories` (owns its `StoryGenerationService` instance)
- `routes/story.ts` — `/:language/:level` story display + file loading

**Key Routes:**

- `GET /` - Home page with language/level selection
- `GET /generate-stories` - Async batch creation and completed batch processing
  - Processes any completed batches first
  - Checks for in-progress batches (prevents duplicates)
  - Creates new batches for today and tomorrow if needed
  - Returns immediately without waiting for completion
- `GET /:language/:level` - Display today's story

**Route Logic:**
The `/generate-stories` endpoint follows a three-step process:

1. Process any completed batches that haven't been written to disk yet
2. Check for in-progress batches (if found, inform user and return)
3. Create new batches for missing dates (today/tomorrow)

### src/storyService.ts (771 lines)

Core story generation service using class-based architecture:

**StoryGenerationService Class:**

- `constructor(apiKey: string)` - Initializes Anthropic client
- `checkStoriesExistForDate(date: Date)` - Checks if stories already exist on disk
- `processBatches()` - Finds and processes completed batches
- `generateStory(language, level, theme?)` - Generates single story (for testing)
- `generateDailyStories(languages, levels, targetDate?)` - Creates batch request (returns batch ID)
- `getStoryTool(language, level)` - Builds Anthropic tool schema for structured output
- `getPrompt(language, level, theme)` - Generates level-specific prompts

**Important Constants:**

- `SUPPORTED_LANGUAGES` - Array of 8 language names
- `EARLY_LEVELS = ['A1', 'A2']`
- `INTERMEDIATE_LEVELS = ['B1', 'B2']`
- Theme arrays imported from `src/themes.ts` (each level has unique themes)

**Theme System:**

- `selectThemesForDate(date: Date)` - Deterministically selects themes based on date
- Uses seeded random number generator for consistency (same date = same theme per level)
- Returns 4 themes (one for each level: A1, A2, B1, B2)
- Each level has unique themes tailored to its proficiency:
  - **A1 (135 themes):** Survival language, basic transactions, simple everyday situations
  - **A2 (130 themes):** Familiar topics with preferences, planning, basic opinions
  - **B1 (130 themes):** Expressing opinions, discussing experiences, abstract familiar topics
  - **B2 (126 themes):** Nuanced debates, complex analysis, philosophical discussions
- All levels use conversational format with progressively increasing complexity

**AI Generation Flow:**

1. Select deterministic theme based on date (using seeded random)
2. Create batch request with 32 messages (8 languages × 4 levels)
3. Submit batch and return batch ID immediately (async processing)
4. Batch processes in background (Anthropic's infrastructure)
5. Later, `processCompletedBatches()` retrieves results via batch API
6. Extracts structured output from tool use responses
7. Writes story files to date-appropriate directories

**Key Architecture Change:**
Now uses Anthropic's tool/function calling feature instead of parsing JSON from text responses. This eliminates the need for JSON cleaning and provides structured, validated output.

### src/themes.ts (530 lines)

Contains theme arrays for each proficiency level, organized from simple to complex:

**Theme Arrays:**

- `A1_THEMES` (135 themes) - Absolute beginner survival topics
  - Simple greetings, ordering food, asking directions
  - Basic transactions and everyday situations
  - Concrete, practical language use
  - Example: 'ordering coffee or tea', 'asking where the bathroom is'

- `A2_THEMES` (130 themes) - Elementary familiar topics
  - Planning activities, expressing preferences
  - Simple past experiences and basic opinions
  - More social interactions and arrangements
  - Example: 'planning a weekend trip with friends', 'discussing your favorite restaurant'

- `B1_THEMES` (130 themes) - Intermediate opinions and experiences
  - Expressing and justifying viewpoints
  - Comparing options, discussing pros and cons
  - Abstract familiar topics about life, work, culture
  - Example: 'discussing the advantages and disadvantages of working from home'

- `B2_THEMES` (126 themes) - Upper-intermediate nuanced debates
  - Complex ethical and philosophical discussions
  - Societal issues, global topics, critical analysis
  - Hypothetical scenarios and persuasive arguments
  - Example: 'debating whether artificial intelligence poses more opportunities or threats to society'

**Design Philosophy:**
Each level has progressively more complex themes that match learner capabilities. Themes within each array are diverse to maintain engagement throughout the year.

### views/story.ejs

Displays story content with interactive quiz. Includes embedded JavaScript for:

- Single-click answer selection
- Immediate visual feedback (green/red)
- Preventing multiple attempts
- Revealing correct answer on wrong selection

## Development Patterns

### Async Batch Processing Pattern

The system uses asynchronous batch processing to avoid timeouts and improve reliability:

- `generateDailyStories()` creates batch and returns batch ID immediately
- Batch processing happens on Anthropic's infrastructure
- `processCompletedBatches()` is called separately to retrieve and save results
- `checkInProgressBatch()` prevents duplicate batch creation
- `checkStoriesExistForDate()` prevents overwriting existing stories

This pattern allows the `/generate-stories` endpoint to respond quickly while batches process in the background.

### Tool-Based Generation

Uses Anthropic's tool/function calling feature for structured output:

- `getStoryTool()` defines strict JSON schema for story format
- `tool_choice: { type: 'tool', name: 'create_story' }` forces tool use
- Eliminates JSON parsing errors and formatting issues
- Structured output is type-safe and validated

### Deterministic Theme Selection

Themes are selected deterministically based on date:

- Seeded random number generator using date (YYYYMMDD format)
- Same date always produces same theme per level across all instances
- Ensures consistency for all users on a given day and level
- Each level (A1, A2, B1, B2) gets a unique theme appropriate for its proficiency
- Different seed offsets ensure each level gets a different theme on the same date

### Error Handling

- Story not found → renders `no-story-today.ejs`
- Route not found → 404 error page
- Server errors → 500 error page with sanitized messages
- Batch errors logged but don't stop other stories in batch

## Environment Variables

Required:

- `ANTHROPIC_API_KEY` - API key for Claude (do NOT access .env file)
- `DATABASE_URL` - Postgres connection string for user accounts (e.g. `postgres://user:pass@host:5432/daily_story`)
- `PORT` - Server port (optional, defaults to 3000)
- `SESSION_SECRET` - Secret used to sign session cookies (falls back to an insecure dev value; set a strong value in production)

Used by Docker Compose (Postgres container; must match the credentials encoded
in `DATABASE_URL`):

- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`

All of the above are read from `.env` (gitignored, also excluded via
`.dockerignore` so it isn't baked into images). Compose loads `.env` for both
variable substitution and the container environment.

## Development Commands

```bash
npm run dev      # Development with auto-reload (tsx + nodemon)
npm run build    # Compile TypeScript + copy assets to dist/
npm start        # Run compiled production build
```

### Docker

```bash
docker compose up --build   # Build + run the app and Postgres together
docker compose down         # Stop and remove containers
docker compose down -v      # Also remove volumes (wipes DB + stories data)
```

- `app` service builds from the root `Dockerfile` (multi-stage) and waits for
  the DB to pass its healthcheck (`depends_on … condition: service_healthy`).
- `daily-story-db` service builds from `database/Dockerfile` (postgres:18) and
  runs `setup.sql` on first init. The app reaches it at host `daily-story-db`
  (the service name), which is what `DATABASE_URL` points to.
- Named volumes persist data: `db-data` (Postgres) and `stories` (generated
  stories). Postgres 18 mounts `db-data` at `/var/lib/postgresql` (not
  `/var/lib/postgresql/data`).

## Important Notes

### TypeScript Configuration

- Strict mode enabled
- Additional safety: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- Output: CommonJS modules to dist/

### Batch API Usage

- Uses Anthropic's Message Batches API for efficiency
- Generates all 32 stories (8 languages × 4 levels) in parallel
- Async pattern: creates batch, returns immediately, processes later
- `processCompletedBatches()` retrieves results when batch finishes
- Individual failures don't stop entire batch
- System generates stories for both today and tomorrow (if needed)

### Responsive Design

- Mobile-first approach
- Dark mode support via `prefers-color-scheme: dark`
- Breakpoints at 768px and 480px

### Content Strategy

- Stories reset daily (based on date)
- Same story shown to all users on a given day and level
- Themes selected deterministically per date, with each level getting a unique theme:
  - A1: 135 beginner survival topics
  - A2: 130 elementary familiar topics
  - B1: 130 intermediate opinion topics
  - B2: 126 advanced debate topics
- All 8 languages at same level use the same theme on a given day
- User accounts exist (email/password) but are not yet tied to story content or progress
- Quiz results are client-side only (not persisted)

## Common Tasks

### Adding a New Language

1. Add language to `SUPPORTED_LANGUAGES` in `src/storyService.ts`
2. AI prompts automatically support the new language (no changes needed)
3. Rebuild and restart

### Adding New Themes

1. Edit the appropriate theme array in `src/themes.ts`:
   - `A1_THEMES` for absolute beginner topics
   - `A2_THEMES` for elementary topics
   - `B1_THEMES` for intermediate topics
   - `B2_THEMES` for upper-intermediate topics
2. Themes are automatically selected using deterministic random selection
3. Ensure themes match the complexity appropriate for each level
4. No other changes needed (themes are imported automatically)

### Adjusting Story Generation

- Modify prompts in `getPrompt()` method in `src/storyService.ts`
- Update tool schema in `getStoryTool()` method if changing story structure
- Update word counts, content requirements, or question format in prompts
- Consider impact on TypeScript `StoryContent` type

### Changing Quiz Behavior

- Edit embedded `<script>` in `src/views/story.ejs`
- JavaScript handles all quiz interactivity
- No backend changes needed for quiz logic

### Changing the Database Schema

1. Edit `database/setup.sql` (idempotent — uses `IF NOT EXISTS`)
2. `setup.sql` only runs on first DB init; to re-apply locally either:
   - `docker compose down -v` then `up` (wipes data), or
   - `psql "$DATABASE_URL" -f database/setup.sql` against the running DB
3. Update the `User` model (`src/models/user.ts`) and `UserRow` type to match

### Protecting a Route (require login)

- Import `requireAuth` from `src/routes/auth.ts` and add it as middleware:
  `app.get('/some-page', requireAuth, handler)`
- Unauthenticated requests are redirected to `/login`
- The logged-in user id is available as `req.session.userId`

## Architecture Decisions

**File-Based Storage for Stories:**

- Story content stays in date-organized JSON files (simple, no DB needed for the core read experience)
- Suitable for small-to-medium scale deployment

**PostgreSQL for User Accounts:**

- Added to support authentication (email/password) which file storage can't safely handle
- Accessed via a single shared connection pool (`src/db.ts`)
- Story content intentionally stays file-based; the DB is scoped to accounts

**Async Batch Generation:**

- More efficient than generating on-demand per user request
- Allows pre-generation for next day (generates both today and tomorrow)
- Reduces latency for end users
- Async pattern prevents API timeout issues
- Batch processing handled by Anthropic's infrastructure

**Tool-Based Generation:**

- Structured output eliminates JSON parsing errors
- Type-safe and validated responses
- Simpler error handling than text parsing
- More reliable than prompt-based JSON generation

**Client-Side Quiz:**

- No server-side validation needed
- Immediate feedback for better UX
- Reduces server load

## Gotchas

1. **Stories Directory:** The `stories/` directory is gitignored and must be created on first run
2. **Async Batch Processing:** Batches are created asynchronously and processed later
   - First call to `/generate-stories` creates batch
   - Subsequent calls check for and process completed batches
   - Must call endpoint again after batch completes to write files to disk
3. **In-Progress Detection:** System prevents creating new batches while one is in progress
4. **Case Sensitivity:** Language and level parameters in URLs are case-insensitive (converted to lowercase)
5. **Date-Based Keys:** Stories are keyed by date, so timezone differences could cause confusion
6. **Theme Consistency:** All languages at the same level use the same theme on a given date, but each level (A1, A2, B1, B2) gets a different theme (by design)
7. **Batch ID Format:** Custom IDs use format `YYYYMMDD-language-level` to identify date and content
8. **DB Init Runs Once:** `database/setup.sql` only executes when the Postgres data volume is empty. Schema changes won't apply to an existing volume unless you re-run the SQL or recreate the volume (`docker compose down -v`)
9. **In-Memory Sessions:** The session store is in-memory, so restarting the app logs everyone out. Use a persistent store before production
10. **DATABASE_URL Host:** Inside Compose the DB host is the service name `daily-story-db`, not `localhost`. Running the app outside Compose against the containerized DB needs `localhost:5432` instead
11. **Postgres 18 Volume Path:** Data is mounted at `/var/lib/postgresql` (version-specific subdir), not the older `/var/lib/postgresql/data`

## Security Notes

- Secrets (`ANTHROPIC_API_KEY`, `DATABASE_URL`, `SESSION_SECRET`) stored in environment variables (`.env` is gitignored and dockerignored, never committed)
- Authentication via email/password with bcrypt-hashed passwords (cost 12); plaintext passwords are never stored
- Sessions are cookie-based (`httpOnly`, `sameSite: 'lax'`); set a strong `SESSION_SECRET` in production
- Login uses a generic error message to avoid user enumeration
- SQL uses parameterized queries (`pg`) — no string interpolation, so no SQL injection risk
- Error messages sanitized in production
- No XSS risk (EJS auto-escapes by default)
- **Production TODO:** the session store is in-memory (see `src/index.ts`); switch to a persistent store (e.g. `connect-pg-simple`) before deploying

## Future Enhancement Opportunities

- Progress tracking tied to user accounts (accounts exist; content is not yet linked)
- Persistent session store (`connect-pg-simple`)
- Audio pronunciation support
- Vocabulary highlighting and definitions
- Adjustable difficulty based on user feedback
- Additional CEFR levels (C1, C2)
- Story favoriting/bookmarking
- Analytics and learning metrics
