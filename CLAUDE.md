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
├── util.ts            # AI generation, file operations, utilities
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
- Word count: 5-10 words per message, 10+ messages

**Intermediate Levels (B1, B2):**
- Format: Narrative (fables, flash fiction)
- Structure: Single story text field
- Questions: In target language (full immersion)
- Word count: B1 (300-500), B2 (400-600)

### Story Schema

```typescript
type StoryContent = {
  title: string
  story?: string                              // B1/B2 only
  messages?: { text: string; sender: string }[]  // A1/A2 only
  questions: {
    question: string
    options: string[]                         // Always 4 options
    correctAnswer: number                     // Index (0-3)
  }[]  // Always 3 questions
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

### src/index.ts (222 lines)
Main Express application containing:
- Route handlers: `/`, `/generate-stories`, `/:language/:level`
- Story file loading logic
- Template rendering
- Error handling middleware

**Key Routes:**
- `GET /` - Home page with language/level selection
- `GET /generate-stories` - Manually trigger story generation
- `GET /:language/:level` - Display today's story

### src/util.ts (349 lines)
Core AI and utility functions:

**Main Functions:**
- `generateDailyStories(date: Date)` - Generates stories for all 32 language/level combos using batch API
- `cleanJsonString(str: string)` - Robust JSON cleaning (handles markdown, smart quotes, escaping)

**Important Constants:**
- `SUPPORTED_LANGUAGES` - Array of language names
- `EARLY_LEVELS = ['A1', 'A2']`
- `INTERMEDIATE_LEVELS = ['B1', 'B2']`

**AI Generation Flow:**
1. Creates batch request with 32 messages (8 languages × 4 levels)
2. Polls batch status every 5 seconds until complete
3. Parses and cleans JSON responses
4. Writes story files to appropriate directories

### views/story.ejs
Displays story content with interactive quiz. Includes embedded JavaScript for:
- Single-click answer selection
- Immediate visual feedback (green/red)
- Preventing multiple attempts
- Revealing correct answer on wrong selection

## Development Patterns

### Singleton Generation Pattern
The `isGeneratingStories` flag prevents concurrent batch generation:
```typescript
let isGeneratingStories = false;
```
This protects against API rate limits and duplicate content.

### JSON Cleaning Strategy
The `cleanJsonString()` function handles various edge cases from AI responses:
- Removes markdown code fences
- Normalizes smart quotes from multiple languages
- Escapes unescaped quotes within JSON string values
- Removes trailing commas
- Line-by-line processing to preserve dialogue

### Error Handling
- Story not found → renders `no-story-today.ejs`
- Route not found → 404 error page
- Server errors → 500 error page with sanitized messages

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
- Polling pattern: checks batch status every 5 seconds
- Individual failures don't stop entire batch

### Responsive Design
- Mobile-first approach
- Dark mode support via `prefers-color-scheme: dark`
- Breakpoints at 768px and 480px

### Content Strategy
- Stories reset daily (based on date)
- Same story shown to all users on a given day
- No user accounts or progress tracking
- Quiz results are client-side only (not persisted)

## Common Tasks

### Adding a New Language
1. Add language to `SUPPORTED_LANGUAGES` in `src/util.ts`
2. Update AI prompts to support the language
3. Rebuild and restart

### Adjusting Story Generation
- Modify system prompts in `generateDailyStories()` function in `src/util.ts`
- Update word counts, content requirements, or question format
- Consider impact on JSON schema validation

### Changing Quiz Behavior
- Edit embedded `<script>` in `src/views/story.ejs`
- JavaScript handles all quiz interactivity
- No backend changes needed for quiz logic

## Architecture Decisions

**File-Based Storage vs Database:**
- Chosen for simplicity and zero infrastructure requirements
- Trade-off: No user accounts, analytics, or progress tracking
- Suitable for small-to-medium scale deployment

**Batch Generation:**
- More efficient than generating on-demand per user request
- Allows pre-generation for next day
- Reduces latency for end users

**Client-Side Quiz:**
- No server-side validation needed
- Immediate feedback for better UX
- Reduces server load

## Gotchas

1. **Stories Directory:** The `stories/` directory is gitignored and must be created on first run
2. **Concurrent Generation:** Only one batch generation can run at a time (by design)
3. **JSON Cleaning:** AI responses sometimes include markdown or improperly escaped quotes - `cleanJsonString()` handles this
4. **Case Sensitivity:** Language and level parameters in URLs are case-insensitive (converted to lowercase)
5. **Date-Based Keys:** Stories are keyed by date, so timezone differences could cause confusion

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
