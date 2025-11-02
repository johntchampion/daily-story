# Daily Story

![Daily Story with Quiz](/assets/screenshot.png)

Visit this page every day to practice reading a story in the language you're learning. The story you'll see will fit your skill level, so you can confidently get practice without being overwhelmed. Three practice questions will also be available to test whether or not you understand the story.

## How It Works

Every day at midnight, a new set of stories will be generated for supported languages and stored in a `stories` folder. When accessing the page `/:language/:level`, the story for the day is fetch and rendered. The stories and questions are generated with a LLM.

Supported languages right now include English, Spanish, French, German, Italian, Portuguese, Chinese, and Japanese. Stories are generated for the A1, A2, B1, and B2 levels.

## Running On Your Machine

You must have an active API Key from Anthropic for this to work.

### Environment Variables

| Name              |        Description         |           Example |
| :---------------- | :------------------------: | ----------------: |
| ANTHROPIC_API_KEY | The API Key for Anthropic. | anthropic-api-key |

### Starting The App

Node.js must be installed on your machine. Install dependencies and then run the app.

```
npm install
npm run dev
```

In production, build the project and run from the dist folder.

```
npm install
npm run build
npm start
```
