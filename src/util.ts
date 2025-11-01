import OpenAI from 'openai'
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
    Respond only with the JSON, no additional text.
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
    Respond only with the JSON, no additional text.
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

// Configure OpenAI client to use local Ollama
const client = new OpenAI({
  baseURL: 'http://localhost:11434/v1',
  apiKey: 'ollama', // Ollama doesn't require a real API key
})

export const generateStory = async (
  language: string,
  level: string
): Promise<StoryContent> => {
  console.log(`Generating story for ${language} at the ${level} level...`)
  const response = await client.chat.completions.create({
    model: 'llama3.1:8b',
    messages: [
      {
        role: 'user',
        content: getPrompt(language, level),
      },
    ],
    response_format: { type: 'json_object' },
  })
  const content: string = response.choices[0]?.message?.content || '{}'
  return JSON.parse(content) as StoryContent
}

export const generateDailyStories = async (
  languages: string[],
  levels: string[]
) => {
  console.log('Generating daily stories...')
  const now = new Date()
  const year = now.getFullYear().toString()
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const day = now.getDate().toString().padStart(2, '0')

  for await (const language of languages) {
    for (const level of levels) {
      try {
        const story = await generateStory(language, level)
        console.log(`Generated story for ${language} at the ${level}:`)

        // Save story to file
        const dirPath = path.join(
          process.cwd(),
          'stories',
          year,
          month,
          day,
          language.toLowerCase(),
          level.toLowerCase()
        )
        await mkdir(dirPath, { recursive: true })

        const filePath = path.join(dirPath, 'story.json')
        await writeFile(filePath, JSON.stringify(story, null, 2), 'utf-8')
        console.log(`Saved story to ${filePath}`)
      } catch (error) {
        console.error(
          `Error generating story for ${language} at ${level}:`,
          error
        )
      }
    }
  }
}
