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
- **Storage:** File-based JSON (no database)
- **Build Tools:** TypeScript, tsx, nodemon, copyfiles

## Project Structure

```
src/
├── index.ts           # Main Express app (routes, middleware)
├── storyService.ts    # Story generation service (class-based)
├── views/             # EJS templates
│   ├── home.ejs       # Language/level selection page
│   ├── story.ejs      # Story display with quiz
│   ├── no-story-today.ejs
│   └── error.ejs
└── public/css/        # Stylesheets (dark mode support)

stories/               # Generated stories (gitignored)
└── YYYY/MM/DD/{language}/{level}/story.json
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
- No database required

## Important Files

### src/index.ts (274 lines)

Main Express application containing:

- Route handlers: `/`, `/generate-stories`, `/:language/:level`
- Story file loading logic
- Template rendering
- Error handling middleware
- StoryGenerationService initialization

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
- `EARLY_LEVEL_THEMES` - 130 conversation topics for A1/A2 levels
- `INTERMEDIATE_LEVEL_THEMES` - 128 conversation topics for B1/B2 levels

**Theme System:**

- `selectThemesForDate(date: Date)` - Deterministically selects themes based on date
- Uses seeded random number generator for consistency (same date = same theme)
- Returns both conversational and intermediate conversational themes
- All levels now use conversational format with different complexity and themes

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
- Same date always produces same themes across all instances
- Ensures consistency for all users on a given day
- 130 conversational themes (A1/A2) and 128 intermediate conversational themes (B1/B2)

### Error Handling

- Story not found → renders `no-story-today.ejs`
- Route not found → 404 error page
- Server errors → 500 error page with sanitized messages
- Batch errors logged but don't stop other stories in batch

## Environment Variables

Required:

- `ANTHROPIC_API_KEY` - API key for Claude (do NOT access .env file)
- `PORT` - Server port (optional, defaults to 3000)

## Development Commands

```bash
npm run dev      # Development with auto-reload (tsx + nodemon)
npm run build    # Compile TypeScript + copy assets to dist/
npm start        # Run compiled production build
```

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
- Same story shown to all users on a given day
- Themes selected deterministically per date (130 conversational for A1/A2, 128 intermediate conversational for B1/B2)
- All 8 languages at same level use the same theme on a given day
- No user accounts or progress tracking
- Quiz results are client-side only (not persisted)

## Common Tasks

### Adding a New Language

1. Add language to `SUPPORTED_LANGUAGES` in `src/storyService.ts`
2. AI prompts automatically support the new language (no changes needed)
3. Rebuild and restart

### Adding New Themes

1. Add themes to `EARLY_LEVEL_THEMES` (A1/A2) or `INTERMEDIATE_LEVEL_THEMES` (B1/B2) in `src/storyService.ts`
2. Themes are automatically selected using deterministic random selection
3. No other changes needed

### Adjusting Story Generation

- Modify prompts in `getPrompt()` method in `src/storyService.ts`
- Update tool schema in `getStoryTool()` method if changing story structure
- Update word counts, content requirements, or question format in prompts
- Consider impact on TypeScript `StoryContent` type

### Changing Quiz Behavior

- Edit embedded `<script>` in `src/views/story.ejs`
- JavaScript handles all quiz interactivity
- No backend changes needed for quiz logic

## Architecture Decisions

**File-Based Storage vs Database:**

- Chosen for simplicity and zero infrastructure requirements
- Trade-off: No user accounts, analytics, or progress tracking
- Suitable for small-to-medium scale deployment

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
6. **Theme Consistency:** All languages use the same theme on a given date (by design)
7. **Batch ID Format:** Custom IDs use format `YYYYMMDD-language-level` to identify date and content

## Security Notes

- API keys stored in environment variables (never committed)
- No user authentication or session management
- Error messages sanitized in production
- No SQL injection risk (no database)
- No XSS risk (EJS auto-escapes by default)

## Future Enhancement Opportunities

- User accounts and progress tracking
- Audio pronunciation support
- Vocabulary highlighting and definitions
- Adjustable difficulty based on user feedback
- Additional CEFR levels (C1, C2)
- Story favoriting/bookmarking
- Analytics and learning metrics
