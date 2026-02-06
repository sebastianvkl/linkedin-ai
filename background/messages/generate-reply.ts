import type { PlasmoMessaging } from '@plasmohq/messaging'
import { Storage } from '@plasmohq/storage'
import { buildSystemPrompt, buildUserPrompt, parseReplySuggestions, type ToneType } from '~lib/prompts'

export type QuickActionType =
  | 'reply'
  | 'follow_up'
  | 'schedule_meeting'
  | 'polite_decline'
  | 'ask_question'
  | 'express_interest'
  | 'outreach'
  | 'custom'

export interface UserProfile {
  name: string | null
  headline: string | null
  profileUrl: string | null
  company: string | null
  jobDescription?: string | null
}

export interface GenerateReplyRequest {
  conversationHistory: string
  conversationSummary: string
  currentUser: UserProfile
  recipient: UserProfile
  lastMessageSender: 'self' | 'other' | null
  lastMessageTime: string | null
  isActiveConversation: boolean
  actionType: QuickActionType
  customPrompt?: string
}

export interface GenerateReplyResponse {
  suggestions: string[]
  error?: string
}

// Simple rate limiter
const rateLimiter = {
  requests: [] as number[],
  maxRequests: 10,
  windowMs: 60000, // 1 minute

  canMakeRequest(): boolean {
    const now = Date.now()
    this.requests = this.requests.filter(time => now - time < this.windowMs)
    return this.requests.length < this.maxRequests
  },

  recordRequest() {
    this.requests.push(Date.now())
  },

  getTimeUntilReset(): number {
    if (this.requests.length === 0) return 0
    const oldestRequest = Math.min(...this.requests)
    return Math.max(0, this.windowMs - (Date.now() - oldestRequest))
  }
}

// Get current month and year for search queries
function getRecentDateRange(): { currentMonth: string; currentYear: number; lastMonth: string } {
  const now = new Date()
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const currentMonth = months[now.getMonth()]
  const currentYear = now.getFullYear()
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonth = months[lastMonthDate.getMonth()]
  return { currentMonth, currentYear, lastMonth }
}

// Fetch recent news about a company using web search
async function fetchCompanyNews(companyName: string, apiKey: string): Promise<string | null> {
  try {
    const { currentMonth, currentYear, lastMonth } = getRecentDateRange()

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        thinking: {
          type: 'enabled',
          budget_tokens: 5000
        },
        tools: [{
          type: 'web_search',
          name: 'web_search',
          max_uses: 5
        }],
        messages: [{
          role: 'user',
          content: `Search for recent news about "${companyName}" company from the last 1-3 months (${lastMonth} - ${currentMonth} ${currentYear}).

DO THESE SEARCHES:
1. "${companyName} news ${currentMonth} ${currentYear}"
2. "${companyName} announcement funding launch ${currentYear}"

Find: funding rounds, product launches, partnerships, acquisitions, leadership changes, or major milestones.

OUTPUT FORMAT (be concise - 3-4 bullet points max):
- [Date] What happened (source)

If no recent news found, say "No recent news found."`
        }]
      })
    })

    if (!response.ok) return null

    const data = await response.json()

    // Extract text from response (may have thinking blocks)
    let content = ''
    for (const block of data.content || []) {
      if (block.type === 'text') {
        content += block.text + '\n'
      }
    }
    content = content.trim()

    if (content && !content.toLowerCase().includes('no recent news')) {
      return content
    }

    return null
  } catch (e) {
    console.error('Failed to fetch company news:', e)
    return null
  }
}

// Fetch recent activity/posts context about a person using web search
async function fetchPersonActivity(name: string, headline: string | null, company: string | null, apiKey: string): Promise<string | null> {
  try {
    const personContext = [
      name,
      headline ? `(${headline})` : '',
      company ? `at ${company}` : ''
    ].filter(Boolean).join(' ')

    const { currentYear } = getRecentDateRange()

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        thinking: {
          type: 'enabled',
          budget_tokens: 5000
        },
        tools: [{
          type: 'web_search',
          name: 'web_search',
          max_uses: 4
        }],
        messages: [{
          role: 'user',
          content: `Search for recent activity by ${personContext}.

DO THESE SEARCHES:
1. "${name} LinkedIn"
2. "${name} ${company || ''} ${currentYear}"

Find: Recent posts, articles, podcast appearances, conference talks, or notable achievements.

OUTPUT FORMAT (be concise - 2-3 bullet points max):
- What they've been talking about or doing recently

If nothing specific found, say "No recent activity found."`
        }]
      })
    })

    if (!response.ok) return null

    const data = await response.json()

    // Extract text from response (may have thinking blocks)
    let content = ''
    for (const block of data.content || []) {
      if (block.type === 'text') {
        content += block.text + '\n'
      }
    }
    content = content.trim()

    if (content && !content.toLowerCase().includes('no recent activity found')) {
      return content
    }

    return null
  } catch (e) {
    console.error('Failed to fetch person activity:', e)
    return null
  }
}

const handler: PlasmoMessaging.MessageHandler<GenerateReplyRequest, GenerateReplyResponse> = async (req, res) => {
  const storage = new Storage()

  try {
    // Check rate limit
    if (!rateLimiter.canMakeRequest()) {
      const waitTime = Math.ceil(rateLimiter.getTimeUntilReset() / 1000)
      return res.send({
        suggestions: [],
        error: `Rate limit reached. Please wait ${waitTime} seconds before trying again.`
      })
    }

    // Get API key from storage
    const apiKey = await storage.get<string>('claude_api_key')
    if (!apiKey) {
      return res.send({
        suggestions: [],
        error: 'API key not configured. Please set your Claude API key in the extension popup.'
      })
    }

    // Get user preferences
    const tone = (await storage.get<ToneType>('tone')) || 'professional'
    const userContext = await storage.get<string>('user_context')
    const customInstructions = await storage.get<string>('custom_instructions')
    const meetingLink = await storage.get<string>('meeting_link')

    const {
      conversationHistory,
      conversationSummary,
      currentUser,
      recipient,
      lastMessageSender,
      lastMessageTime,
      isActiveConversation,
      actionType = 'reply',
      customPrompt
    } = req.body

    if (!conversationHistory || conversationHistory === 'No messages in conversation yet.') {
      return res.send({
        suggestions: [],
        error: 'No messages found in the conversation. Open a chat thread with messages first.'
      })
    }

    // Try to get company news if recipient has a company
    let companyNews: string | null = null
    let personActivity: string | null = null

    // Fetch research in parallel
    const researchPromises: Promise<void>[] = []

    if (recipient?.company) {
      researchPromises.push(
        fetchCompanyNews(recipient.company, apiKey)
          .then(news => { companyNews = news })
          .catch(() => {})
      )
    }

    if (recipient?.name) {
      researchPromises.push(
        fetchPersonActivity(recipient.name, recipient.headline, recipient.company, apiKey)
          .then(activity => { personActivity = activity })
          .catch(() => {})
      )
    }

    // Wait for research (with timeout - extended for web search)
    await Promise.race([
      Promise.all(researchPromises),
      new Promise(resolve => setTimeout(resolve, 30000)) // 30s timeout for web search
    ])

    // Build prompts with full context
    const systemPrompt = buildSystemPrompt(tone)
    const userPrompt = buildUserPrompt({
      tone,
      currentUser,
      recipient,
      conversationHistory,
      conversationSummary,
      lastMessageSender,
      lastMessageTime,
      isActiveConversation,
      userContext: userContext || null,
      customInstructions: customInstructions || null,
      actionType,
      customPrompt: customPrompt || null,
      companyNews,
      personActivity,
      meetingLink: meetingLink || null
    })

    // Record the request for rate limiting
    rateLimiter.recordRequest()

    // Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt
          }
        ]
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error?.message || `API error: ${response.status}`

      if (response.status === 401) {
        return res.send({
          suggestions: [],
          error: 'Invalid API key. Please check your Claude API key in the extension settings.'
        })
      }

      if (response.status === 429) {
        return res.send({
          suggestions: [],
          error: 'Claude API rate limit reached. Please wait a moment and try again.'
        })
      }

      if (response.status === 400) {
        return res.send({
          suggestions: [],
          error: 'Invalid request. The conversation may be too long or contain invalid content.'
        })
      }

      return res.send({
        suggestions: [],
        error: errorMessage
      })
    }

    const data = await response.json()
    const content = data.content?.[0]?.text || ''

    const suggestions = parseReplySuggestions(content)

    if (suggestions.length === 0 || (suggestions.length === 1 && suggestions[0].includes('Unable to generate'))) {
      return res.send({
        suggestions: [],
        error: 'Could not generate suggestions. Please try again.'
      })
    }

    return res.send({ suggestions })
  } catch (error) {
    console.error('Generate reply error:', error)

    // Handle specific error types
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return res.send({
        suggestions: [],
        error: 'Network error. Please check your internet connection.'
      })
    }

    return res.send({
      suggestions: [],
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    })
  }
}

export default handler
