import Anthropic from '@anthropic-ai/sdk'
import { mkdir, writeFile, access } from 'fs/promises'
import path from 'path'
import { A1_THEMES, A2_THEMES, B1_THEMES, B2_THEMES } from './themes.js'

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

// Simple seeded random number generator for deterministic theme selection
const seededRandom = (seed: number): number => {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

// Select themes for a given date (deterministic based on date)
export const selectThemesForDate = (
  date: Date
): { A1: string; A2: string; B1: string; B2: string } => {
  // Create a seed from the date (YYYYMMDD format)
  const seed =
    date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate()

  // Use seed to select indices for each level
  const a1Index = Math.floor(seededRandom(seed) * A1_THEMES.length)
  const a2Index = Math.floor(seededRandom(seed + 1) * A2_THEMES.length)
  const b1Index = Math.floor(seededRandom(seed + 2) * B1_THEMES.length)
  const b2Index = Math.floor(seededRandom(seed + 3) * B2_THEMES.length)

  return {
    A1: A1_THEMES[a1Index] || '',
    A2: A2_THEMES[a2Index] || '',
    B1: B1_THEMES[b1Index] || '',
    B2: B2_THEMES[b2Index] || '',
  }
}

export class StoryGenerationService {
  private readonly client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey })
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
   * Find and process any completed batches that haven't been processed yet
   */
  async processBatches(): Promise<{
    processedBatchIDs: string[]
    errorBatchIDs: string[]
    inProgressBatchIDs: string[]
  }> {
    console.log('Checking for completed batches to process...')

    try {
      const page = await this.client.messages.batches.list({ limit: 2 })

      if (!page.data) {
        throw new Error('API returned invalid response: page.data is undefined')
      }

      const batches = page.data

      let processedBatchIDs: string[] = []
      let errorBatchIDs: string[] = []
      let inProgressBatchIDs: string[] = []

      // Filter for batches that are completed (ended) but might not have been processed
      const completedBatches = batches.filter(
        (batch) => batch.processing_status === 'ended'
      )

      // Find any batch that is in progress
      inProgressBatchIDs = batches
        .filter((batch) => batch.processing_status === 'in_progress')
        .map((batch) => batch.id)

      console.log(`Found ${completedBatches.length} completed batches`)

      for (const batch of completedBatches) {
        try {
          // Fetch results once and collect them into an array
          const results = await this.client.messages.batches.results(batch.id)
          const allResults = []

          for await (const result of results) {
            allResults.push(result)
          }

          if (allResults.length === 0) {
            console.log(`Batch ${batch.id} has no results, skipping`)
            continue
          }

          // Extract date from first result's custom_id (format: YYYYMMDD-language-level)
          const sampleCustomId = allResults[0]!.custom_id
          const dateStr = sampleCustomId.split('-')[0]
          if (!dateStr || dateStr.length !== 8) {
            console.error(
              `Invalid custom_id format in batch ${batch.id}: ${sampleCustomId}`
            )
            errorBatchIDs.push(batch.id)
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

          // Process all results in this batch
          console.log(`Processing batch ${batch.id} for date ${dateStr}`)

          for (const result of allResults) {
            if (result.result.type === 'succeeded') {
              // Parse custom_id format: YYYYMMDD-language-level
              const parts = result.custom_id.split('-')
              const resultDateStr = parts[0]
              const language = parts[1]
              const level = parts[2]

              if (
                !resultDateStr ||
                !language ||
                !level ||
                resultDateStr.length !== 8
              ) {
                console.error(`Invalid custom_id format: ${result.custom_id}`)
                continue
              }

              // Extract date components from custom_id
              const resultYear = resultDateStr.substring(0, 4)
              const resultMonth = resultDateStr.substring(4, 6)
              const resultDay = resultDateStr.substring(6, 8)

              try {
                // Extract the tool use from the response
                const toolUse = result.result.message.content?.find(
                  (block) => block.type === 'tool_use'
                )

                if (!toolUse || toolUse.type !== 'tool_use') {
                  throw new Error('No tool use found in batch response')
                }

                const story = toolUse.input as StoryContent

                console.log(
                  `Processed story for ${language} at ${level} (${resultDateStr})`
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
                await writeFile(
                  filePath,
                  JSON.stringify(story, null, 2),
                  'utf-8'
                )
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

          processedBatchIDs.push(batch.id)
        } catch (error) {
          console.error(
            `Error checking/processing batch ${batch.id}:`,
            error instanceof Error ? error.message : 'Unknown error'
          )
          errorBatchIDs.push(batch.id)
        }
      }

      return { processedBatchIDs, errorBatchIDs, inProgressBatchIDs }
    } catch (error) {
      console.error(
        'Error in processBatches:',
        error instanceof Error ? error.message : 'Unknown error'
      )
      throw error
    }
  }

  async generateStory(
    language: string,
    level: string,
    theme?: string
  ): Promise<StoryContent> {
    console.log(`Generating story for ${language} at the ${level} level...`)

    // If no theme provided, select one for today
    let selectedTheme = theme
    if (!selectedTheme) {
      const themes = selectThemesForDate(new Date())
      selectedTheme = themes[level as 'A1' | 'A2' | 'B1' | 'B2']
    }

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-5',
      messages: [
        {
          role: 'user',
          content: this.getPrompt(language, level, selectedTheme),
        },
      ],
      max_tokens: 4096,
      tools: [this.getStoryTool(language, level)],
      tool_choice: { type: 'tool', name: 'create_story' },
    })

    // Extract the tool use from the response
    const toolUse = response.content.find((block) => block.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new Error('No tool use found in response')
    }

    return toolUse.input as StoryContent
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

    // Select themes for this date
    const themes = selectThemesForDate(date)
    console.log(`Selected themes for ${year}-${month}-${day}:`)
    console.log(`  A1: ${themes.A1}`)
    console.log(`  A2: ${themes.A2}`)
    console.log(`  B1: ${themes.B1}`)
    console.log(`  B2: ${themes.B2}`)

    // Create batch requests
    const batchRequests = []
    for (const language of languages) {
      for (const level of levels) {
        // Select appropriate theme based on level
        const theme = themes[level as 'A1' | 'A2' | 'B1' | 'B2']

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
            tools: [this.getStoryTool(language, level)],
            tool_choice: { type: 'tool' as const, name: 'create_story' },
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

  private getStoryTool(language: string, level: string): Anthropic.Tool {
    const isEarlyLevel = EARLY_LEVELS.includes(level)
    const questionLanguage = isEarlyLevel ? 'English' : language

    // Determine minimum number of messages based on level
    let minMessages = 10
    if (level === 'B1') {
      minMessages = 10 // 10-15 exchanges as specified in prompt
    } else if (level === 'B2') {
      minMessages = 12 // 12-18 exchanges as specified in prompt
    }

    return {
      name: 'create_story',
      description: `Create a ${level} level conversational story in ${language}`,
      input_schema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: `The conversation title in ${language}`,
          },
          messages: {
            type: 'array',
            description: `Array of at least ${minMessages} message objects in the conversation`,
            items: {
              type: 'object',
              properties: {
                text: {
                  type: 'string',
                  description: `The message text in ${language}`,
                },
                sender: {
                  type: 'string',
                  description: 'The name of the person sending the message',
                },
              },
              required: ['text', 'sender'],
            },
            minItems: minMessages,
          },
          questions: {
            type: 'array',
            description: `Array of exactly 3 comprehension questions in ${questionLanguage}`,
            items: {
              type: 'object',
              properties: {
                question: {
                  type: 'string',
                  description: `The question text in ${questionLanguage}`,
                },
                options: {
                  type: 'array',
                  description: 'Array of exactly 4 answer options',
                  items: { type: 'string' },
                  minItems: 4,
                  maxItems: 4,
                },
                correctAnswer: {
                  type: 'number',
                  description:
                    'The index (0-3) of the correct answer in the options array',
                  minimum: 0,
                  maximum: 3,
                },
              },
              required: ['question', 'options', 'correctAnswer'],
            },
            minItems: 3,
            maxItems: 3,
          },
        },
        required: ['title', 'messages', 'questions'],
      },
    }
  }

  private getPrompt(language: string, level: string, theme: string): string {
    let promptString = ''
    const questionLanguage = EARLY_LEVELS.includes(level) ? 'English' : language

    switch (level) {
      case 'A1':
        promptString = `Create a natural spoken conversation in ${language} at a ${level} language level between two people talking in person about: ${theme}.

Write at least 10 alternating dialogue exchanges with natural back-and-forth as if two people are speaking face-to-face.
Use only simple, common vocabulary and short sentences (5-10 words per turn) appropriate for absolute beginners.
Include natural spoken elements like greetings, questions, short responses, and simple reactions that people use in everyday conversations.
The dialogue should sound like two people actually talking to each other, not writing messages.

Then create a title and three multiple-choice questions in ${questionLanguage} to quiz the reader's comprehension.`
        break

      case 'A2':
        promptString = `Create a casual spoken conversation in ${language} at a ${level} language level between two people (friends, classmates, or casual acquaintances) talking in person about: ${theme}.

Write at least 10 dialogue turns, alternating between the two people as they speak naturally to each other.
Use simple vocabulary with some basic connectors and complete sentences suitable for elementary learners.
Maintain a friendly, informal tone throughout and include natural spoken elements like fillers, confirmations, and reactions that people use when talking.
The conversation should sound like real people speaking to each other face-to-face, not written communication.

Then create a title and three multiple-choice questions in ${questionLanguage} to quiz the reader's comprehension.`
        break

      case 'B1':
        promptString = `Create a natural spoken conversation in ${language} at a ${level} language level between two or more people talking in person about: ${theme}.

Write at least 10-15 dialogue exchanges that explore the topic with some depth. The conversation should feel like real people discussing something face-to-face, allowing for expression of opinions, explanations, and personal experiences.
Use a mix of common and moderately advanced vocabulary with varied sentence structures including compound and complex sentences.
Include transitional phrases, connectors, and natural spoken expressions that intermediate learners need to practice.
Incorporate natural conversation elements like agreements, disagreements, clarifications, and follow-up questions that occur in real discussions.
The language should be accessible to lower-intermediate learners while providing appropriate challenge.

Then create a title and three multiple-choice questions in ${questionLanguage} to quiz the reader's comprehension.`
        break

      case 'B2':
        promptString = `Create a substantive in-person conversation or discussion in ${language} at a ${level} language level where two or more people talk about: ${theme}.

Write at least 12-18 dialogue exchanges that explore the topic in depth, including nuanced viewpoints, detailed explanations, or thoughtful analysis.
Use diverse vocabulary including idiomatic expressions, phrasal verbs, and topic-specific terminology. Employ varied sentence structures with complex grammar and sophisticated linking expressions.
The conversation should sound like educated native speakers having a thoughtful discussion, with natural fluency, abstract reasoning, hypothetical situations, or persuasive elements appropriate for upper-intermediate learners.
Include realistic spoken conversation features like hedging, emphasis, interruptions (polite), elaborations, and natural turn-taking patterns.

Then create a title and three multiple-choice questions in ${questionLanguage} to quiz the reader's comprehension.`
        break

      default:
        promptString = 'Invalid level'
        break
    }

    return promptString
  }
}
