import Anthropic from '@anthropic-ai/sdk'
import { mkdir, writeFile } from 'fs/promises'
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

const getResponseFormat = (
  language: string,
  level: string,
  questionLanguage: string
) => {
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

const getPrompt = (language: string, level: string) => {
  let promptString = ''
  const questionLanguage = EARLY_LEVELS.includes(level) ? 'English' : language

  if (EARLY_LEVELS.includes(level)) {
    promptString += `
      Write text message thread in ${language} at a ${level} language level. There should be at least ten messages exchanged between two people.
      Use simple vocabulary and short sentences suitable for early language learners.
      `
  } else if (INTERMEDIATE_LEVELS.includes(level)) {
    promptString += `
      Write a fable-like story in ${language} at a ${level} language level. The story should be between 300 and 500 words long.
      Incorporate a mix of common and slightly advanced vocabulary with varied sentence structures.
      `
  }

  promptString += `
    Then create a title and three multiple-choice questions to quiz the reader's comprehension.
    ${getResponseFormat(language, level, questionLanguage)}
  `

  return promptString
}

// Clean and fix JSON formatting issues from different languages
const cleanJsonString = (string: string) => {
  let cleaned = string.trim()

  // Remove markdown code fences - look for ```json or ``` at start
  // and ``` at end, capturing everything in between
  const markdownMatch = cleaned.match(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/m)
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

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

export const generateStory = async (
  language: string,
  level: string
): Promise<StoryContent> => {
  console.log(`Generating story for ${language} at the ${level} level...`)

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    messages: [{ role: 'user', content: getPrompt(language, level) }],
    max_tokens: 4096,
  })

  const responseText: string = (response.content?.[0] as any)?.text ?? '{}'
  const cleanedResponse = cleanJsonString(responseText)

  return JSON.parse(cleanedResponse) as StoryContent
}

export const generateDailyStories = async (
  languages: string[],
  levels: string[],
  targetDate?: Date
) => {
  console.log('Generating daily stories using Message Batches API...')

  const date = targetDate || new Date()
  const year = date.getFullYear().toString()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')

  // Create batch requests
  const batchRequests = []
  for (const language of languages) {
    for (const level of levels) {
      batchRequests.push({
        custom_id: `${language.toLowerCase()}-${level.toLowerCase()}`,
        params: {
          model: 'claude-sonnet-4-5',
          messages: [
            { role: 'user' as const, content: getPrompt(language, level) },
          ],
          max_tokens: 4096,
        },
      })
    }
  }

  console.log(`Creating batch with ${batchRequests.length} requests...`)

  // Create the batch
  const batch = await client.messages.batches.create({
    requests: batchRequests,
  })

  console.log(`Batch created with ID: ${batch.id}`)
  console.log('Polling for completion...')

  // Poll for completion
  let completedBatch = await client.messages.batches.retrieve(batch.id)
  while (completedBatch.processing_status === 'in_progress') {
    await new Promise((resolve) => setTimeout(resolve, 5000)) // Wait 5 seconds
    completedBatch = await client.messages.batches.retrieve(batch.id)
    console.log(`Batch status: ${completedBatch.processing_status}`)
  }

  if (completedBatch.processing_status === 'canceling') {
    throw new Error('Batch was canceled')
  }

  console.log('Batch completed! Processing results...')

  // Retrieve and process results
  const results = await client.messages.batches.results(batch.id)

  for await (const result of results) {
    if (result.result.type === 'succeeded') {
      const parts = result.custom_id.split('-')
      const language = parts[0]
      const level = parts[1]

      if (!language || !level) {
        console.error(`Invalid custom_id format: ${result.custom_id}`)
        continue
      }

      try {
        const responseText: string =
          (result.result.message.content?.[0] as any)?.text ?? '{}'
        const cleanedResponse = cleanJsonString(responseText)
        const story = JSON.parse(cleanedResponse) as StoryContent

        console.log(`Processed story for ${language} at ${level}`)

        // Save story to file
        const dirPath = path.join(
          process.cwd(),
          'stories',
          year,
          month,
          day,
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
          error
        )
      }
    } else if (result.result.type === 'errored') {
      console.error(
        `Failed to generate story for ${result.custom_id}:`,
        result.result.error
      )
    } else {
      console.error(
        `Failed to generate story for ${result.custom_id}: ${result.result.type}`
      )
    }
  }

  console.log('All stories generated and saved!')
}
