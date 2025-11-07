import Anthropic from '@anthropic-ai/sdk'
import { mkdir, writeFile, access } from 'fs/promises'
import path from 'path'

export type StoryContent = {
  title: string
  story?: string
  messages?: { text: string; sender: string }[]
  questions: {
    question: string
    options: string[]
    correctAnswer: number
  }[]
}

export const SUPPORTED_LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Chinese',
  'Japanese',
]
export const EARLY_LEVELS = ['A1', 'A2']
export const INTERMEDIATE_LEVELS = ['B1', 'B2']

// Theme lists for variety in story generation
export const CONVERSATIONAL_THEMES = [
  'planning a birthday party',
  'ordering food at a restaurant',
  'asking for directions in a new city',
  'discussing weekend plans',
  'shopping for clothes',
  'making a doctor appointment',
  'talking about the weather',
  'inviting someone to a movie',
  'discussing hobbies and interests',
  'arranging to meet a friend',
  'booking a hotel room',
  'asking about public transportation',
  'sharing vacation photos',
  'discussing favorite foods',
  'planning a picnic',
  'talking about pets',
  'asking for recipe recommendations',
  'discussing a recent concert or event',
  'making gym or exercise plans',
  'talking about family members',
  'discussing daily routines',
  'asking for book recommendations',
  'planning a study session',
  'talking about sports or games',
  'discussing morning coffee habits',
  'arranging a group dinner',
  'talking about a new job',
  'discussing apartment hunting',
  'planning a beach day',
  'talking about learning a new skill',
  'discussing favorite TV shows',
  'arranging a carpool',
  'talking about grocery shopping',
  'planning a hiking trip',
  'discussing phone or tech problems',
  'talking about the gym or fitness',
  'arranging a video call',
  'discussing a wedding or celebration',
  'planning a surprise party',
  'talking about buying furniture',
  'discussing home repairs',
  'arranging pet care while traveling',
  'talking about cooking dinner',
  'planning a road trip',
  'discussing concert tickets',
  'talking about starting a garden',
  'arranging a moving day',
  'discussing seasonal activities',
  'planning a museum visit',
  'talking about neighborhood news',
  'discussing car troubles',
  'arranging childcare',
  'talking about a new restaurant',
  'planning holiday decorations',
  'discussing gift ideas',
  'talking about recycling or sustainability',
  'arranging a study abroad program',
  'discussing favorite music',
  'planning a volunteer activity',
  'talking about a farmers market',
  'discussing online shopping',
  'arranging a photography session',
  'talking about board game night',
  'planning a potluck dinner',
  'discussing bike routes',
  'talking about a yoga or dance class',
  'arranging a book club meeting',
  'discussing a new coffee shop',
  'planning a karaoke night',
  'talking about home organization',
  'discussing local festivals',
  'arranging a dog park meetup',
  'talking about starting a business',
  'planning a craft project',
  'discussing apartment decorating',
  'talking about meal prep',
  'arranging a language exchange',
  'discussing climate and seasons',
  'planning a camping adventure',
  'talking about visiting relatives',
  'discussing New Year resolutions',
  'arranging a painting class',
  'talking about smart home devices',
  'planning a wine tasting',
  'discussing thrift store finds',
  'talking about running a marathon',
  'arranging a garage sale',
  'discussing a documentary',
  'planning a costume party',
  'talking about adopting a pet',
  'discussing budgeting and saving',
  'arranging a trivia night',
  'talking about trying new cuisines',
  'planning a spa day',
  'discussing home security',
  'talking about getting a haircut',
  'arranging a gaming tournament',
  'discussing subscription services',
  'planning a charity event',
]

export const NARRATIVE_THEMES = [
  'a magical object with unexpected consequences',
  'overcoming a lifelong fear',
  'an unlikely friendship between opposites',
  'discovering a hidden family secret',
  'a journey to find something lost',
  'learning to forgive oneself',
  'a missed opportunity and second chances',
  'the wisdom found in nature',
  'a mysterious stranger who changes everything',
  'choosing between two paths',
  'the cost of ambition',
  'finding courage in a crisis',
  'a lesson about honesty',
  'the power of a single act of kindness',
  'breaking free from tradition',
  'a message that arrives too late',
  'the true meaning of home',
  'learning humility through failure',
  'an unexpected inheritance',
  'the consequences of greed',
  'finding beauty in imperfection',
  'a promise that must be kept',
  'the weight of a secret',
  'discovering inner strength',
  'a choice between love and duty',
  'the value of patience',
  'an old rivalry renewed',
  'learning to let go',
  'a chance encounter that changes fate',
  'the price of perfection',
  'finding hope in darkness',
  'a journey of self-discovery',
  'the danger of assumptions',
  'learning from elders',
  'a talent hidden for too long',
  'the healing power of time',
  'a competition with unexpected results',
  'discovering what truly matters',
  'the consequences of jealousy',
  'a voice that must be heard',
  'learning acceptance',
  'a sacrifice for the greater good',
  'the danger of pride',
  'finding peace after conflict',
  'a gift that comes with responsibility',
  'learning empathy through experience',
  'a plan that goes wrong',
  'the importance of trust',
  'a memory that resurfaces',
  'choosing principles over convenience',
  'the value of simplicity',
  'an adventure that teaches wisdom',
  'learning gratitude',
  'a transformation through hardship',
  'the power of determination',
  'a reunion after years apart',
  'discovering hidden talents',
  'the folly of rushing',
  'learning cooperation',
  'a risk that pays off',
  'the importance of timing',
  'a misunderstanding with serious consequences',
  'finding joy in small things',
  'a debt that must be repaid',
  'learning from mistakes',
  'an unexpected mentor',
  'the cost of deception',
  "finding one's true calling",
  'a test of character',
  'the value of perseverance',
  'an old wound reopened',
  'learning compassion',
  'a tradition questioned',
  'the power of words',
  'finding strength in community',
  'a discovery that challenges beliefs',
  'learning resourcefulness',
  'a journey home',
  'the danger of complacency',
  'finding clarity through solitude',
  'a bargain with consequences',
  'learning balance',
  'an injustice confronted',
  'the value of authenticity',
  'a bridge between worlds',
  'finding redemption',
  'a cycle that must be broken',
  'learning mindfulness',
  'an echo from the past',
  'the importance of preparation',
  'finding connection in isolation',
  'a harvest after long labor',
  'learning responsibility',
  'a mask that falls away',
  'the power of vulnerability',
  'finding light in the ordinary',
  'a teacher who learns from the student',
  'the value of boundaries',
  'a storm weathered together',
]

// Simple seeded random number generator for deterministic theme selection
const seededRandom = (seed: number): number => {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

// Select themes for a given date (deterministic based on date)
export const selectThemesForDate = (
  date: Date
): { conversational: string; narrative: string } => {
  // Create a seed from the date (YYYYMMDD format)
  const seed =
    date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate()

  // Use seed to select indices
  const conversationalIndex = Math.floor(
    seededRandom(seed) * CONVERSATIONAL_THEMES.length
  )
  const narrativeIndex = Math.floor(
    seededRandom(seed + 1) * NARRATIVE_THEMES.length
  )

  return {
    conversational: CONVERSATIONAL_THEMES[conversationalIndex] || '',
    narrative: NARRATIVE_THEMES[narrativeIndex] || '',
  }
}

export class StoryGenerationService {
  private readonly client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey })
  }

  /**
   * List the most recent message batches from the API (limit: 2)
   */
  async listBatches(): Promise<Anthropic.Messages.MessageBatch[]> {
    try {
      const page = await this.client.messages.batches.list({ limit: 2 })
      return page.data
    } catch (error) {
      console.error(
        'Error listing batches:',
        error instanceof Error ? error.message : 'Unknown error'
      )
      return []
    }
  }

  /**
   * Check if stories for a specific date already exist on disk
   */
  async checkStoriesExistForDate(date: Date): Promise<boolean> {
    const year = date.getFullYear().toString()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')

    const firstLanguage = SUPPORTED_LANGUAGES[0]?.toLowerCase() || 'spanish'
    const firstLevel = EARLY_LEVELS[0]?.toLowerCase() || 'a1'

    const sampleFilePath = path.join(
      process.cwd(),
      'stories',
      year,
      month,
      day,
      firstLanguage,
      firstLevel,
      'story.json'
    )

    try {
      await access(sampleFilePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Check if there's already an in-progress batch
   * Returns the batch ID if found, null otherwise
   */
  async checkInProgressBatch(): Promise<string | null> {
    try {
      const batches = await this.listBatches()

      // Find any batch that is in progress
      const inProgressBatch = batches.find(
        (batch) => batch.processing_status === 'in_progress'
      )

      return inProgressBatch ? inProgressBatch.id : null
    } catch (error) {
      console.error(
        'Error checking for in-progress batches:',
        error instanceof Error ? error.message : 'Unknown error'
      )
      return null
    }
  }

  /**
   * Process the results of a single completed batch
   */
  private async processBatchResults(batchId: string): Promise<void> {
    console.log(`Processing results for batch ${batchId}...`)

    try {
      const results = await this.client.messages.batches.results(batchId)

      for await (const result of results) {
        if (result.result.type === 'succeeded') {
          // Parse custom_id format: YYYYMMDD-language-level
          const parts = result.custom_id.split('-')
          const dateStr = parts[0]
          const language = parts[1]
          const level = parts[2]

          if (!dateStr || !language || !level || dateStr.length !== 8) {
            console.error(`Invalid custom_id format: ${result.custom_id}`)
            continue
          }

          // Extract date components from custom_id
          const resultYear = dateStr.substring(0, 4)
          const resultMonth = dateStr.substring(4, 6)
          const resultDay = dateStr.substring(6, 8)

          try {
            const responseText: string =
              (result.result.message.content?.[0] as any)?.text ?? '{}'
            const cleanedResponse =
              StoryGenerationService.cleanJsonString(responseText)
            const story = JSON.parse(cleanedResponse) as StoryContent

            console.log(
              `Processed story for ${language} at ${level} (${dateStr})`
            )

            // Save story to file using date from custom_id
            const dirPath = path.join(
              process.cwd(),
              'stories',
              resultYear,
              resultMonth,
              resultDay,
              language,
              level
            )
            await mkdir(dirPath, { recursive: true })

            const filePath = path.join(dirPath, 'story.json')
            await writeFile(filePath, JSON.stringify(story, null, 2), 'utf-8')
            console.log(`Saved story to ${filePath}`)
          } catch (error) {
            console.error(
              `Error processing story for ${language} at ${level}:`,
              error instanceof Error ? error.message : 'Unknown error'
            )
          }
        } else if (result.result.type === 'errored') {
          const errorMsg =
            typeof result.result.error === 'object'
              ? JSON.stringify(result.result.error)
              : String(result.result.error)
          console.error(
            `Failed to generate story for ${result.custom_id}: ${errorMsg}`
          )
        } else {
          console.error(
            `Failed to generate story for ${result.custom_id}: ${result.result.type}`
          )
        }
      }
    } catch (error) {
      console.error(
        `Error processing batch ${batchId}:`,
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  /**
   * Find and process any completed batches that haven't been processed yet
   */
  async processCompletedBatches(): Promise<{
    processed: number
    errors: number
  }> {
    console.log('Checking for completed batches to process...')

    try {
      const batches = await this.listBatches()
      let processed = 0
      let errors = 0

      // Filter for batches that are completed (ended) but might not have been processed
      const completedBatches = batches.filter(
        (batch) => batch.processing_status === 'ended'
      )

      console.log(`Found ${completedBatches.length} completed batches`)

      for (const batch of completedBatches) {
        // To determine if this batch has been processed, we need to:
        // 1. Get a sample result to extract the date
        // 2. Check if stories exist for that date

        try {
          // Get the first result to extract the date
          const results = await this.client.messages.batches.results(batch.id)
          let sampleCustomId: string | null = null

          for await (const result of results) {
            sampleCustomId = result.custom_id
            break // Just get the first one
          }

          if (!sampleCustomId) {
            console.log(`Batch ${batch.id} has no results, skipping`)
            continue
          }

          // Extract date from custom_id (format: YYYYMMDD-language-level)
          const dateStr = sampleCustomId.split('-')[0]
          if (!dateStr || dateStr.length !== 8) {
            console.error(
              `Invalid custom_id format in batch ${batch.id}: ${sampleCustomId}`
            )
            errors++
            continue
          }

          const year = parseInt(dateStr.substring(0, 4))
          const month = parseInt(dateStr.substring(4, 6)) - 1 // JS months are 0-indexed
          const day = parseInt(dateStr.substring(6, 8))
          const batchDate = new Date(year, month, day)

          // Check if stories already exist for this date
          const storiesExist = await this.checkStoriesExistForDate(batchDate)

          if (storiesExist) {
            console.log(
              `Stories for ${dateStr} already exist, skipping batch ${batch.id}`
            )
            continue
          }

          // Process this batch
          console.log(`Processing batch ${batch.id} for date ${dateStr}`)
          await this.processBatchResults(batch.id)
          processed++
        } catch (error) {
          console.error(
            `Error checking/processing batch ${batch.id}:`,
            error instanceof Error ? error.message : 'Unknown error'
          )
          errors++
        }
      }

      return { processed, errors }
    } catch (error) {
      console.error(
        'Error in processCompletedBatches:',
        error instanceof Error ? error.message : 'Unknown error'
      )
      return { processed: 0, errors: 1 }
    }
  }

  async generateStory(
    language: string,
    level: string,
    theme?: string
  ): Promise<StoryContent> {
    console.log(`Generating story for ${language} at the ${level} level...`)

    // If no theme provided, select one for today
    const selectedTheme =
      theme ||
      (EARLY_LEVELS.includes(level)
        ? selectThemesForDate(new Date()).conversational
        : selectThemesForDate(new Date()).narrative)

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-5',
      messages: [
        {
          role: 'user',
          content: this.getPrompt(language, level, selectedTheme),
        },
      ],
      max_tokens: 4096,
    })

    const responseText: string = (response.content?.[0] as any)?.text ?? '{}'
    const cleanedResponse = StoryGenerationService.cleanJsonString(responseText)

    return JSON.parse(cleanedResponse) as StoryContent
  }

  async generateDailyStories(
    languages: string[],
    levels: string[],
    targetDate?: Date
  ): Promise<string> {
    console.log('Generating daily stories using Message Batches API...')

    const date = targetDate || new Date()
    const year = date.getFullYear().toString()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')

    // Check if there's already an in-progress batch
    const existingBatchId = await this.checkInProgressBatch()
    if (existingBatchId) {
      console.log(
        `Batch ${existingBatchId} is already in progress. Skipping new batch creation.`
      )
      return existingBatchId
    }

    // Select themes for this date
    const themes = selectThemesForDate(date)
    console.log(`Selected themes for ${year}-${month}-${day}:`)
    console.log(`  Conversational (A1/A2): ${themes.conversational}`)
    console.log(`  Narrative (B1/B2): ${themes.narrative}`)

    // Create batch requests
    const batchRequests = []
    for (const language of languages) {
      for (const level of levels) {
        // Select appropriate theme based on level
        const theme = EARLY_LEVELS.includes(level)
          ? themes.conversational
          : themes.narrative

        batchRequests.push({
          custom_id: `${year}${month}${day}-${language.toLowerCase()}-${level.toLowerCase()}`,
          params: {
            model: 'claude-sonnet-4-5',
            messages: [
              {
                role: 'user' as const,
                content: this.getPrompt(language, level, theme),
              },
            ],
            max_tokens: 4096,
          },
        })
      }
    }

    console.log(`Creating batch with ${batchRequests.length} requests...`)

    // Create the batch
    const batch = await this.client.messages.batches.create({
      requests: batchRequests,
    })

    console.log(`Batch created with ID: ${batch.id}`)
    console.log(
      'Batch created successfully. Processing will happen asynchronously.'
    )

    return batch.id
  }

  private getResponseFormat(
    language: string,
    level: string,
    questionLanguage: string
  ): string {
    const isEarlyLevel = EARLY_LEVELS.includes(level)

    if (isEarlyLevel) {
      return `
    You must respond with valid JSON in exactly this format:
    {
      "title": "The conversation title in ${language}",
      "messages": [
        { "text": "Message text in ${language}", "sender": "Person 1" },
        { "text": "Message text in ${language}", "sender": "Person 2" },
        { "text": "Message text in ${language}", "sender": "Person 1" }
      ],
      "questions": [
        {
          "question": "Question text in ${questionLanguage}",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correctAnswer": 0
        },
        {
          "question": "Question text in ${questionLanguage}",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correctAnswer": 1
        },
        {
          "question": "Question text in ${questionLanguage}",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correctAnswer": 2
        }
      ]
    }

    The messages array should contain at least 10 message objects with "text" and "sender" properties.
    The correctAnswer field should be the index (0-3) of the correct option.
    IMPORTANT: Respond ONLY with the raw JSON object. Do NOT wrap it in markdown code blocks or backticks.
    `
    } else {
      return `
    You must respond with valid JSON in exactly this format:
    {
      "title": "The story title in ${language}",
      "story": "The complete story text in ${language}",
      "questions": [
        {
          "question": "Question text in ${questionLanguage}",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correctAnswer": 0
        },
        {
          "question": "Question text in ${questionLanguage}",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correctAnswer": 1
        },
        {
          "question": "Question text in ${questionLanguage}",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correctAnswer": 2
        }
      ]
    }

    The correctAnswer field should be the index (0-3) of the correct option.
    IMPORTANT: Respond ONLY with the raw JSON object. Do NOT wrap it in markdown code blocks or backticks.
    `
    }
  }

  private getPrompt(language: string, level: string, theme: string): string {
    let promptString = ''
    const questionLanguage = EARLY_LEVELS.includes(level) ? 'English' : language

    switch (level) {
      case 'A1':
        promptString += `
        Create a casual text message conversation in ${language} at a ${level} language level between two people about: ${theme}.
        Write at least 10 alternating messages with natural back-and-forth exchanges.
        Use only simple, common vocabulary and short sentences (5-10 words per message) appropriate for absolute beginners.
        Include greetings, questions, and responses that feel natural and conversational.
        `
        break
      case 'A2':
        promptString += `
        Create an informal email exchange in ${language} at a ${level} language level between two people (friends, classmates, or casual acquaintances) about: ${theme}.
        Write at least 10 emails total, alternating between the two people. Don't include a greeting or closing in any of the emails; only write the body text.
        Use simple vocabulary with some basic connectors and complete sentences suitable for elementary learners.
        Maintain a friendly, informal tone throughout.
        `
        break
      case 'B1':
        promptString += `
        Write an engaging fable or moral tale in ${language} at a ${level} language level with the theme: ${theme}.
        The story should be 300-500 words and include animal or human characters with a clear narrative arc.
        Use a mix of common and moderately advanced vocabulary with varied sentence structures including some compound and complex sentences.
        The story should be accessible to intermediate learners while providing some challenge.
        `
        break
      case 'B2':
        promptString += `
        Write a compelling flash-fiction story in ${language} at a ${level} language level with the theme: ${theme}.
        The story should be 400-600 words with a complete narrative featuring developed characters and an interesting plot twist or insight.
        Use diverse vocabulary including idiomatic expressions, varied sentence structures with complex grammar, and descriptive language.
        The story should be engaging and sophisticated enough to challenge upper-intermediate learners.
        `
        break

      default:
        break
    }

    promptString += `
    Then create a title and three multiple-choice questions to quiz the reader's comprehension.
    ${this.getResponseFormat(language, level, questionLanguage)}
  `

    return promptString
  }

  private static cleanJsonString(string: string): string {
    let cleaned = string.trim()

    // Remove markdown code fences - look for ```json or ``` at start
    // and ``` at end, capturing everything in between
    const markdownMatch = cleaned.match(
      /^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/m
    )
    if (markdownMatch && markdownMatch[1]) {
      cleaned = markdownMatch[1]
    }

    // If there's still a leading ``` without the ending captured, remove it
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/gim, '')
    cleaned = cleaned.replace(/\n?```\s*$/gim, '')

    // Replace smart quotes with straight ones
    // Include: " " (U+201C, U+201D), „ (U+201E - German low quote), ‟ (U+201F)
    cleaned = cleaned.replace(/[""„‟]/g, '"')
    cleaned = cleaned.replace(/[''‚‛]/g, "'")

    // Fix unescaped quotes within JSON string values
    // Process line by line to handle dialogue quotes in stories
    const lines = cleaned.split('\n')
    cleaned = lines
      .map((line) => {
        // Skip empty lines or structural JSON
        if (/^\s*[{}\[\],]?\s*$/.test(line)) {
          return line
        }

        // Check if this line contains a string property with value
        // Pattern: "property": "value..."
        const match = line.match(/^(\s*"[^"]+"\s*:\s*")(.*?)(",?\s*)$/)
        if (!match || !match[1] || !match[2] || !match[3]) {
          return line // Not a simple property: value line
        }

        const prefix = match[1] // e.g., '  "story": "'
        const content = match[2] // the actual value content
        const suffix = match[3] // '",\n' or '"\n'

        // In the content, escape any unescaped quotes
        let escaped = ''
        for (let i = 0; i < content.length; i++) {
          const char = content[i]
          if (char === '\\' && i + 1 < content.length) {
            // Already escaped, keep both characters
            const nextChar = content[i + 1]
            escaped += char + nextChar
            i++ // skip next char
          } else if (char === '"') {
            // Unescaped quote - escape it
            escaped += '\\"'
          } else {
            escaped += char
          }
        }

        return prefix + escaped + suffix
      })
      .join('\n')

    // Remove trailing commas before } or ]
    cleaned = cleaned.replace(/,\s*([}\]])/g, '$1')

    return cleaned.trim()
  }
}
