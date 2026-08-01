import { Question } from './types.js'

// Onboarding's "what's pulling you toward this language?" step. Multi-select;
// recorded to user_responses as an array of the selected labels.
export const LEARNING_REASONS: Question = {
  key: 'learning_reasons',
  question: "What's pulling you toward this language?",
  options: [
    { id: 'travel', label: 'Travel', description: 'Order, ask, wander — without the phrasebook.' },
    { id: 'family', label: 'Family & heritage', description: "It's the language of people I love." },
    { id: 'work', label: 'Work & career', description: 'Meetings, emails, and sounding sharp.' },
    { id: 'culture', label: 'Books, film & music', description: 'Enjoy the originals, not the subtitles.' },
    { id: 'brain', label: 'A daily brain workout', description: 'Five focused minutes that feel good.' },
    { id: 'move', label: 'Living abroad', description: "I'm moving — or dreaming about it." },
    { id: 'partner', label: 'A partner or in-laws', description: 'I want to speak to them in their language.' },
    { id: 'study', label: 'School or an exam', description: "There's a class or test I'm working toward." },
    { id: 'community', label: 'Community & friends', description: 'Group chats, forums, people I want to understand.' },
    { id: 'confidence', label: 'Just for me', description: 'Proving to myself that I can.' },
  ],
}
