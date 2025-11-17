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
export const EARLY_LEVEL_THEMES = [
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

export const INTERMEDIATE_LEVEL_THEMES = [
  'debating remote work versus office work',
  'discussing career change considerations',
  'explaining work-life balance strategies',
  'negotiating a raise or promotion',
  'handling conflict with a coworker',
  'comparing freelancing to traditional employment',
  'planning professional development goals',
  'discussing effective team collaboration',
  'giving constructive feedback to a colleague',
  'exploring networking strategies',
  'debating social media impact on relationships',
  'discussing online privacy concerns',
  'sharing digital detox experiences',
  'exploring AI and automation in daily life',
  'comparing online versus in-store shopping',
  'discussing streaming services and content',
  'debating digital learning versus traditional education',
  'explaining cryptocurrency and digital payments',
  'discussing smart home technology pros and cons',
  'exploring screen time and health effects',
  'discussing different music genres and their history',
  'debating the benefits of routine versus spontaneity',
  'sharing favorite childhood memories',
  'comparing handwriting versus typing',
  'discussing city parks and recreational spaces',
  'exploring different photography styles',
  'discussing home gardening techniques',
  'debating morning versus evening routines',
  'comparing different types of exercise',
  'discussing memory improvement techniques',
  'exploring mental health awareness',
  'debating alternative medicine versus traditional',
  'discussing nutrition myths and facts',
  'comparing fitness trends and effectiveness',
  'explaining sleep hygiene and productivity',
  'sharing stress management techniques',
  'discussing preventive healthcare approaches',
  'exploring work-related health issues',
  'debating mindfulness and meditation benefits',
  'comparing healthcare experiences',
  'discussing generational differences in technology use',
  'exploring family traditions and customs',
  'debating urban versus rural living',
  'discussing the value of different hobbies',
  'exploring effective communication skills',
  'discussing time management for busy schedules',
  'debating the importance of work-life boundaries',
  'exploring strategies for maintaining motivation',
  'discussing volunteer work and community service',
  'sharing community involvement experiences',
  'comparing book versus movie adaptations',
  'discussing media consumption habits',
  'debating the appeal of nostalgia',
  'exploring reality TV influence on society',
  'discussing museum and art accessibility',
  'exploring language preservation efforts',
  'debating music streaming versus physical media',
  'discussing celebrity culture impact',
  'exploring different film genres',
  'discussing podcast popularity reasons',
  'sharing adult learning experiences',
  'discussing overcoming perfectionism',
  'comparing time management philosophies',
  'exploring habit-building strategies',
  'discussing public speaking anxiety',
  'debating financial literacy importance',
  'sharing creative hobbies and their benefits',
  'discussing mentorship relationships',
  'exploring the self-improvement industry',
  'comparing goal-setting strategies',
  'discussing maintaining long-distance friendships',
  'exploring family expectations versus personal choices',
  'debating dating in the digital age',
  'discussing multi-generational households',
  'exploring the choice to have children',
  'debating work friendships boundaries',
  'comparing cultural differences in parenting',
  'discussing solo living versus roommates',
  'exploring community building in neighborhoods',
  'discussing neighborly disputes resolution',
  'debating minimalism versus collecting',
  'exploring subscription service value',
  'discussing smart shopping strategies',
  'comparing gig economy pros and cons',
  'discussing housing market challenges',
  'debating saving versus investing strategies',
  'exploring secondhand shopping benefits',
  'discussing brand loyalty in modern times',
  'exploring consumer rights awareness',
  'debating sharing economy services',
  'discussing online degrees credibility',
  'exploring lifelong learning importance',
  'debating student loan management',
  'discussing gap year benefits and drawbacks',
  'exploring different education paths',
  'comparing vocational training to university',
  'discussing different learning styles',
  'sharing study abroad experiences',
  'debating technology use in classrooms',
  'exploring critical thinking skills development',
  'discussing respectful tourism practices',
  'exploring cultural sensitivity while traveling',
  'debating digital nomad lifestyle',
  'discussing language learning while traveling',
  'exploring travel budgeting strategies',
  'comparing travel planning approaches',
  'debating adventure travel versus relaxation',
  'sharing solo travel experiences',
  'discussing cultural shock adjustment',
  'exploring wildlife watching and nature tourism',
  'debating plant-based diet considerations',
  'discussing food allergies and dining out',
  'exploring meal planning strategies',
  'discussing restaurant tipping culture',
  'debating cooking skills importance',
  'exploring ethnic cuisine authenticity',
  'discussing seasonal cooking and local ingredients',
  'debating intermittent fasting trends',
  'exploring farmers markets and local food',
  'comparing cooking from scratch to convenience foods',
  'discussing side hustles and passive income',
  'exploring imposter syndrome in professional life',
  'debating college major selection factors',
  'discussing burnout prevention strategies',
  'exploring personal finance apps and budgeting',
  'debating rent versus buy decisions',
  'discussing creative problem-solving approaches',
  'exploring the four-day work week concept',
]

// Simple seeded random number generator for deterministic theme selection
const seededRandom = (seed: number): number => {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

// Select themes for a given date (deterministic based on date)
export const selectThemesForDate = (
  date: Date
): { early: string; intermediate: string } => {
  // Create a seed from the date (YYYYMMDD format)
  const seed =
    date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate()

  // Use seed to select indices
  const earlyConversationIndex = Math.floor(
    seededRandom(seed) * EARLY_LEVEL_THEMES.length
  )
  const intermediateConversationIndex = Math.floor(
    seededRandom(seed + 1) * INTERMEDIATE_LEVEL_THEMES.length
  )

  return {
    early: EARLY_LEVEL_THEMES[earlyConversationIndex] || '',
    intermediate:
      INTERMEDIATE_LEVEL_THEMES[intermediateConversationIndex] || '',
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
    const selectedTheme =
      theme ||
      (EARLY_LEVELS.includes(level)
        ? selectThemesForDate(new Date()).early
        : selectThemesForDate(new Date()).intermediate)

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
    console.log(`  Early (A1/A2): ${themes.early}`)
    console.log(`  Intermediate (B1/B2): ${themes.intermediate}`)

    // Create batch requests
    const batchRequests = []
    for (const language of languages) {
      for (const level of levels) {
        // Select appropriate theme based on level
        const theme = EARLY_LEVELS.includes(level)
          ? themes.early
          : themes.intermediate

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
